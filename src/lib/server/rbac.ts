import 'server-only';
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
import { requireUser } from './auth';
import { DEFAULT_ROLES, LEGACY_RANK, LEGACY_ROLE_KEY, PERMISSIONS, PERMISSION_CODES } from '@/lib/system/permissions';

type Db = Prisma.TransactionClient | typeof prisma;
let seeded = false;
/** Databases built from the migration files already hold the default roles. A database built another way (the test schemas) gets them here, once, the first time roles are needed. */
export async function ensureRbacSeed() {
  if (seeded) return;
  if (await prisma.role.count() === 0) {
    await prisma.permission.createMany({ data: PERMISSIONS.map(p => ({ id: 'perm_' + p.code.replace('.', '_'), code: p.code, groupKey: p.group, nameAr: p.code, nameEn: p.code, sensitive: p.sensitive })), skipDuplicates: true });
    const perms = new Map((await prisma.permission.findMany()).map(p => [p.code, p.id]));
    await prisma.role.createMany({ data: DEFAULT_ROLES.map(r => ({ id: 'role_' + r.key, key: r.key, nameAr: r.nameAr, nameEn: r.nameEn, isSystem: r.isSystem, legacyRole: r.legacyRole, selfRegistration: r.selfRegistration, requiresApproval: r.requiresApproval, sortOrder: r.sortOrder })), skipDuplicates: true });
    await prisma.rolePermission.createMany({ data: DEFAULT_ROLES.flatMap(r => (r.permissions === 'all' ? PERMISSION_CODES : r.permissions).map(c => ({ roleId: 'role_' + r.key, permissionId: perms.get(c)! }))), skipDuplicates: true });
  }
  seeded = true;
}

type AccessUser = { id: string; role: string; approvalStatus?: string | null };

/** The role keys a person holds. Accounts created by scripts or older code have no rows yet, so they fall back to the role that matches their legacy access class. */
export async function roleKeysOf(user: AccessUser, db: Db = prisma): Promise<string[]> {
  await ensureRbacSeed();
  const rows = await db.userRoleAssignment.findMany({ where: { userId: user.id, role: { active: true } }, select: { role: { select: { key: true } } } });
  if (rows.length) return rows.map(r => r.role.key);
  const anyRow = await db.userRoleAssignment.count({ where: { userId: user.id } });   // roles exist but are all disabled: no fallback, no access
  return anyRow ? [] : [LEGACY_ROLE_KEY[user.role] ?? 'client'];
}

/**
 * Effective permissions: the union over the person's active roles. The system administrator (legacy SUPER_ADMIN) always holds every permission, so a
 * mistake in role editing can never lock the whole platform out. A pending or rejected account holds none until it is approved.
 */
export async function permissionsOf(user: AccessUser, db: Db = prisma): Promise<Set<string>> {
  if (user.approvalStatus && user.approvalStatus !== 'ACTIVE') return new Set();
  if (user.role === 'SUPER_ADMIN') return new Set(PERMISSION_CODES);
  const keys = await roleKeysOf(user, db);
  if (!keys.length) return new Set();
  const rows = await db.rolePermission.findMany({ where: { role: { key: { in: keys }, active: true } }, select: { permission: { select: { code: true } } } });
  return new Set(rows.map(r => r.permission.code));
}
export async function can(user: AccessUser, code: string) { return (await permissionsOf(user)).has(code); }

/** Route guard: the signed-in user must hold at least one of the listed permissions. */
export async function requirePermission(...codes: string[]) {
  const user = await requireUser();
  const held = await permissionsOf(user);
  if (!codes.some(c => held.has(c))) throw new HttpError(403, 'لا تملك صلاحية تنفيذ هذا الإجراء');
  return { user, held };
}

/** The legacy `User.role` mirrors the strongest role a person holds (system administrator > administrator > vendor > customer). */
export async function syncLegacyRole(tx: Db, userId: string) {
  const rows = await tx.userRoleAssignment.findMany({ where: { userId }, select: { role: { select: { legacyRole: true, active: true } } } });
  const best = rows.filter(r => r.role.active).map(r => r.role.legacyRole || 'CLIENT').sort((a, b) => (LEGACY_RANK[b] ?? 0) - (LEGACY_RANK[a] ?? 0))[0] ?? 'CLIENT';
  await tx.user.update({ where: { id: userId }, data: { role: best as any } });
  return best;
}

/** Keeps the role rows consistent when old code paths still set `User.role` directly (admin user editor, scripts). */
export async function assignLegacyRole(tx: Db, userId: string, legacy: string, assignedBy?: string) {
  const roleKey = LEGACY_ROLE_KEY[legacy] ?? 'client';
  const role = await tx.role.findUnique({ where: { key: roleKey } });
  if (!role) return;
  await tx.userRoleAssignment.deleteMany({ where: { userId, role: { legacyRole: { in: ['CLIENT', 'VENDOR', 'ADMIN', 'SUPER_ADMIN'] } } } });
  await tx.userRoleAssignment.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, create: { userId, roleId: role.id, assignedBy }, update: {} });
}

/** Gives a new account its starting role. Returns whether the role asks for approval first. */
export async function grantInitialRole(tx: Db, userId: string, roleKey: string, assignedBy?: string) {
  await ensureRbacSeed();
  const role = await tx.role.findUnique({ where: { key: roleKey } });
  if (!role || !role.active) throw new HttpError(400, 'نوع الحساب غير متاح');
  await tx.userRoleAssignment.upsert({ where: { userId_roleId: { userId, roleId: role.id } }, create: { userId, roleId: role.id, assignedBy }, update: {} });
  if (role.requiresApproval) await tx.user.update({ where: { id: userId }, data: { approvalStatus: 'PENDING' } });
  await syncLegacyRole(tx, userId);
  return { requiresApproval: role.requiresApproval, role };
}

/** Roles a visitor may pick when creating an account: active, self-registration on, and not a vendor (vendors register through the business form that collects their details). */
export async function selfRegistrationRoles() {
  await ensureRbacSeed();
  const roles = await prisma.role.findMany({ where: { active: true, selfRegistration: true, isSystem: false, key: { not: 'system_admin' } }, orderBy: { sortOrder: 'asc' } });
  const client = await prisma.role.findFirst({ where: { key: 'client', active: true, selfRegistration: true } });
  return [...(client ? [client] : []), ...roles.filter(r => r.legacyRole !== 'VENDOR' && r.legacyRole !== 'ADMIN' && r.legacyRole !== 'SUPER_ADMIN' && r.key !== 'client')]
    .map(r => ({ key: r.key, nameAr: r.nameAr, nameEn: r.nameEn, requiresApproval: r.requiresApproval }));
}

/** Profile fields the front end needs to show or hide screens. The server still enforces every permission itself. */
export async function accessOf(user: AccessUser) {
  const [roleKeys, permissions] = await Promise.all([roleKeysOf(user), permissionsOf(user)]);
  return { roleKeys, permissions: [...permissions].sort(), approvalStatus: user.approvalStatus || 'ACTIVE' };
}
