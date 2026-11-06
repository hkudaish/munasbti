import { prisma } from '@/lib/db';
import { api, body, HttpError, text } from '@/lib/server/http';
import { clientIp, hashPassword } from '@/lib/server/auth';
import { ensureRbacSeed, requirePermission, roleKeysOf, syncLegacyRole } from '@/lib/server/rbac';
import { authSettings, parseAuthSettings, saveAuthSettings, oauthConfigured } from '@/lib/server/auth-settings';
import { providerCatalog } from '@/lib/server/notify';
import { securityLog } from '@/lib/server/security-log';
import { normaliseTarget, phoneVariants } from '@/lib/server/otp';
import { SECURITY_EVENTS, STAFF_ROLE_KEYS, PERMISSION_GROUPS } from '@/lib/system/permissions';
export const dynamic = 'force-dynamic';

/**
 * Users, roles and sign-in settings. Every action asks for a specific permission; nothing here checks a role name except two protections that exist
 * to stop privilege escalation:
 *  - only the system administrator touches administrators / the system administrator, and nobody may grant a role holding a permission they lack themselves;
 *  - the last active system administrator can never be removed, disabled or demoted.
 */
const USER_SCOPE_OK = new Set([...STAFF_ROLE_KEYS, 'client']);

type Actor = { id: string; role: string };
const isSysAdmin = (a: Actor) => a.role === 'SUPER_ADMIN';

async function assertCanManage(actor: Actor, held: Set<string>, targetId: string, newRoleKeys?: string[]) {
  if (isSysAdmin(actor)) return;
  if (targetId === actor.id) throw new HttpError(403, 'لا يمكنك تعديل حسابك من هنا');
  if (!held.has('users.manage_staff') && !held.has('users.edit') && !held.has('users.disable') && !held.has('users.approve')) throw new HttpError(403, 'لا تملك صلاحية إدارة هذا الحساب');
  const target = await prisma.user.findUnique({ where: { id: targetId } });
  if (!target) throw new HttpError(404, 'الحساب غير موجود');
  const keys = await roleKeysOf(target);
  if (target.role === 'SUPER_ADMIN' || target.role === 'ADMIN' || keys.some(k => !USER_SCOPE_OK.has(k) && k !== 'vendor')) throw new HttpError(403, 'لا يمكنك إدارة حساب بهذا المستوى');
  if (newRoleKeys && !newRoleKeys.every(k => USER_SCOPE_OK.has(k))) throw new HttpError(403, 'يمكنك إسناد أدوار المشرفين والمسوقين والمنسقين والعملاء فقط');
}
async function assertNotLastSysAdmin(tx: any, userId: string) {
  const sys = await tx.userRoleAssignment.findMany({ where: { role: { key: 'system_admin' }, user: { isActive: true } }, select: { userId: true } });
  const legacy = await tx.user.findMany({ where: { role: 'SUPER_ADMIN', isActive: true }, select: { id: true } });
  const ids = new Set([...sys.map((s: any) => s.userId), ...legacy.map((l: any) => l.id)]);
  if (ids.has(userId) && ids.size <= 1) throw new HttpError(409, 'يجب الإبقاء على مدير نظام واحد نشط على الأقل');
}
/** Escalation rule: nobody can hand out a SENSITIVE permission they do not hold themselves. Ordinary permissions may be delegated freely, which is what lets an administrator staff the supervisor, marketer and coordinator roles. */
const escalates = (actor: Actor, held: Set<string>, perms: { code: string; sensitive: boolean }[]) => !isSysAdmin(actor) && perms.some(p => p.sensitive && !held.has(p.code));
const roleKeyList = (v: unknown) => { if (!Array.isArray(v) || v.length > 12 || !v.every(k => typeof k === 'string' && /^[a-z][a-z0-9_]{1,40}$/.test(k))) throw new HttpError(400, 'قائمة الأدوار غير صالحة'); return [...new Set(v as string[])]; };

export const GET = api(async request => {
  const { user, held } = await requirePermission('users.view', 'roles.view', 'auth.settings', 'audit.view');
  await ensureRbacSeed();
  const url = new URL(request.url); const out: Record<string, unknown> = { me: { id: user.id, role: user.role, permissions: [...held].sort() } };
  const roles = await prisma.role.findMany({ orderBy: [{ sortOrder: 'asc' }, { createdAt: 'asc' }], include: { permissions: { select: { permission: { select: { code: true } } } }, _count: { select: { users: true } } } });
  out.roles = roles.map(r => ({ id: r.id, key: r.key, nameAr: r.nameAr, nameEn: r.nameEn, description: r.description, active: r.active, isSystem: r.isSystem, legacyRole: r.legacyRole, selfRegistration: r.selfRegistration, requiresApproval: r.requiresApproval, users: r._count.users, permissions: held.has('roles.view') || isSysAdmin(user) ? r.permissions.map(p => p.permission.code).sort() : undefined }));
  if (held.has('roles.view')) out.permissions = (await prisma.permission.findMany({ orderBy: [{ groupKey: 'asc' }, { code: 'asc' }] })).map(p => ({ code: p.code, group: p.groupKey, nameAr: p.nameAr, sensitive: p.sensitive }));
  out.groups = PERMISSION_GROUPS;

  if (held.has('users.view')) {
    const q = (url.searchParams.get('q') || '').slice(0, 120), page = Math.max(0, Math.min(100000, Number(url.searchParams.get('page')) || 0));
    const roleKey = url.searchParams.get('role') || '', status = url.searchParams.get('status') || '';
    const where: any = { AND: [
      ...(q ? [{ OR: [{ name: { contains: q, mode: 'insensitive' } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' } }] }] : []),
      ...(roleKey ? [{ roleAssignments: { some: { role: { key: roleKey } } } }] : []),
      ...(status === 'DISABLED' ? [{ isActive: false }] : ['ACTIVE', 'PENDING', 'REJECTED'].includes(status) ? [{ approvalStatus: status, isActive: true }] : []),
    ] };
    const users = await prisma.user.findMany({ where, orderBy: { createdAt: 'desc' }, skip: page * 50, take: 50, select: { id: true, name: true, email: true, phone: true, role: true, isActive: true, approvalStatus: true, emailVerifiedAt: true, phoneVerifiedAt: true, registeredVia: true, lastLoginAt: true, createdAt: true, roleAssignments: { select: { role: { select: { key: true, nameAr: true } } } }, loginIdentities: { select: { provider: true, verifiedAt: true } } } });
    out.users = users.map(u => ({ id: u.id, name: u.name, email: u.email, phone: u.phone, isActive: u.isActive, approvalStatus: u.approvalStatus, emailVerified: !!u.emailVerifiedAt, phoneVerified: !!u.phoneVerifiedAt, registeredVia: u.registeredVia, lastLoginAt: u.lastLoginAt, createdAt: u.createdAt,
      roleKeys: u.roleAssignments.length ? u.roleAssignments.map(a => a.role.key) : [({ SUPER_ADMIN: 'system_admin', ADMIN: 'admin', VENDOR: 'vendor', CLIENT: 'client' } as Record<string, string>)[u.role]],
      identities: [...new Set(u.loginIdentities.filter(i => i.verifiedAt).map(i => i.provider))] }));
    out.page = page; out.totalUsers = await prisma.user.count({ where });
    out.pending = await prisma.user.count({ where: { approvalStatus: 'PENDING', isActive: true } });
  }
  if (held.has('auth.settings')) {
    out.settings = await authSettings(); out.providers = providerCatalog();
    out.oauth = { google: oauthConfigured('google'), apple: oauthConfigured('apple') };
  }
  if (held.has('audit.view')) {
    const event = url.searchParams.get('event') || '';
    out.audit = await prisma.systemAuditLog.findMany({ where: event && SECURITY_EVENTS[event] ? { action: event } : { action: { in: Object.keys(SECURITY_EVENTS) } }, orderBy: { createdAt: 'desc' }, take: 100 });
    out.events = SECURITY_EVENTS;
  }
  return out;
});

export const POST = api(async request => {
  const d = await body(request, 20000); const ip = clientIp(request);
  const action = String(d.action || '');

  // ---- sign-in settings --------------------------------------------------------------------------------------------------
  if (action === 'saveSettings') {
    const { user } = await requirePermission('auth.settings');
    const next = await parseAuthSettings(d.settings || {});
    await saveAuthSettings(next); await securityLog('settings.changed', { actor: user.id, ip, details: { ...next, providers: next.providers } });
    return { success: true, settings: next };
  }

  // ---- roles -------------------------------------------------------------------------------------------------------------
  if (['roleCreate', 'roleUpdate', 'rolePermissions', 'roleDelete'].includes(action)) {
    const { user, held } = await requirePermission('roles.manage');
    const permissionsGuard = async (codes: string[], role: { selfRegistration: boolean; requiresApproval: boolean }) => {
      const known = await prisma.permission.findMany({ where: { code: { in: codes } } });
      if (known.length !== new Set(codes).size) throw new HttpError(400, 'صلاحية غير معروفة');
      if (escalates(user, held, known)) throw new HttpError(403, 'لا يمكنك منح صلاحية حساسة لا تملكها');
      if (role.selfRegistration && !role.requiresApproval && known.some(p => p.sensitive)) throw new HttpError(409, 'الدور المتاح للتسجيل الذاتي دون اعتماد لا يمكن أن يحمل صلاحيات حساسة؛ فعّل شرط الاعتماد أو أزل الصلاحية');
      return known;
    };
    if (action === 'roleCreate') {
      const key = text(d.key, 40, true).toLowerCase();
      if (!/^[a-z][a-z0-9_]{2,31}$/.test(key)) throw new HttpError(400, 'معرّف الدور: أحرف إنجليزية صغيرة وأرقام و_ (3 إلى 32)');
      const flags = { selfRegistration: d.selfRegistration === true, requiresApproval: d.requiresApproval === true };
      const codes = Array.isArray(d.permissions) ? [...new Set<string>(d.permissions.filter((c: unknown): c is string => typeof c === 'string'))] : [];
      const known = await permissionsGuard(codes, flags);
      const role = await prisma.$transaction(async tx => {
        const r = await tx.role.create({ data: { id: 'role_' + key, key, nameAr: text(d.nameAr, 80, true), nameEn: text(d.nameEn, 80), description: text(d.description, 300), active: true, isSystem: false, legacyRole: null, sortOrder: 100, ...flags } });
        if (known.length) await tx.rolePermission.createMany({ data: known.map(p => ({ roleId: r.id, permissionId: p.id })) });
        return r;
      });
      await securityLog('role.created', { actor: user.id, target: role.id, ip, details: { key } });
      return { success: true, id: role.id };
    }
    const role = await prisma.role.findUnique({ where: { id: text(d.id, 80, true) }, include: { _count: { select: { users: true } } } });
    if (!role) throw new HttpError(404, 'الدور غير موجود');
    if (role.key === 'system_admin' && action !== 'roleUpdate') throw new HttpError(403, 'دور مدير النظام محمي ولا يمكن تعديل صلاحياته أو حذفه');
    if (action === 'roleDelete') {
      if (role.isSystem) throw new HttpError(409, 'هذا دور أساسي في النظام؛ يمكن تعطيله أو تعديله لكن لا يمكن حذفه');
      if (role._count.users) throw new HttpError(409, 'لا يمكن حذف دور مسند لمستخدمين؛ انقلهم إلى دور آخر أولاً');
      await prisma.role.delete({ where: { id: role.id } }); await securityLog('role.deleted', { actor: user.id, target: role.id, ip, details: { key: role.key } });
      return { success: true };
    }
    if (action === 'roleUpdate') {
      const protectedRole = role.key === 'system_admin';
      const next = { nameAr: text(d.nameAr, 80, true), nameEn: text(d.nameEn, 80), description: text(d.description, 300),
        active: protectedRole ? true : d.active !== false, selfRegistration: protectedRole ? false : d.selfRegistration === true, requiresApproval: protectedRole ? false : d.requiresApproval === true };
      if (next.selfRegistration && !next.requiresApproval && await prisma.rolePermission.count({ where: { roleId: role.id, permission: { sensitive: true } } })) throw new HttpError(409, 'الدور يحمل صلاحيات حساسة؛ لا يصح فتح التسجيل الذاتي له دون اشتراط الاعتماد');
      if (!next.active && role.active && role._count.users && ['client'].includes(role.key)) throw new HttpError(409, 'لا يمكن تعطيل دور العملاء وهو مسند لمستخدمين');
      await prisma.role.update({ where: { id: role.id }, data: next });
      await securityLog('role.updated', { actor: user.id, target: role.id, ip, details: { key: role.key, ...next } });
      return { success: true };
    }
    // rolePermissions
    const codes = Array.isArray(d.permissions) ? [...new Set<string>(d.permissions.filter((c: unknown): c is string => typeof c === 'string'))] : [];
    const known = await permissionsGuard(codes, role);
    const beforeRows = (await prisma.rolePermission.findMany({ where: { roleId: role.id }, select: { permission: { select: { code: true, sensitive: true } } } })).map(r => r.permission), before = beforeRows.map(p => p.code);
    // Without holding a sensitive permission, an editor cannot remove it from a role either (that would let them quietly reshape roles above them).
    if (escalates(user, held, beforeRows.filter(p => !codes.includes(p.code)))) throw new HttpError(403, 'لا يمكنك تعديل دور يحمل صلاحيات حساسة لا تملكها');
    await prisma.$transaction([prisma.rolePermission.deleteMany({ where: { roleId: role.id } }), prisma.rolePermission.createMany({ data: known.map(p => ({ roleId: role.id, permissionId: p.id })) })]);
    await securityLog('role.permissions_changed', { actor: user.id, target: role.id, ip, details: { key: role.key, added: codes.filter(c => !before.includes(c)), removed: before.filter(c => !codes.includes(c)) } });
    return { success: true };
  }

  // ---- users -------------------------------------------------------------------------------------------------------------
  const userId = text(d.userId, 100);
  if (action === 'createUser') {
    const { user, held } = await requirePermission('users.create');
    const roleKeys = roleKeyList(d.roleKeys ?? ['client']);
    if (!isSysAdmin(user)) { if (!roleKeys.every(k => USER_SCOPE_OK.has(k))) throw new HttpError(403, 'يمكنك إنشاء حسابات المشرفين والمسوقين والمنسقين والعملاء فقط'); }
    const roles = await prisma.role.findMany({ where: { key: { in: roleKeys }, active: true }, include: { permissions: { select: { permission: { select: { code: true, sensitive: true } } } } } });
    if (roles.length !== roleKeys.length) throw new HttpError(400, 'دور غير موجود أو معطل');
    if (roles.some(r => r.legacyRole === 'VENDOR')) throw new HttpError(400, 'حساب المورد يُنشأ من نموذج تسجيل المورد لأنه يحتاج بيانات المنشأة');
    if (roles.some(r => escalates(user, held, r.permissions.map(p => p.permission)))) throw new HttpError(403, 'لا يمكنك منح دور يحمل صلاحيات حساسة لا تملكها');
    const email = text(d.email, 254).toLowerCase() || null, phoneInput = text(d.phone, 20);
    const phone = phoneInput ? normaliseTarget('sms', phoneInput) : null;
    if (!email && !phone) throw new HttpError(400, 'أدخل الجوال أو البريد الإلكتروني');
    if (email) normaliseTarget('email', email);
    if (await prisma.user.findFirst({ where: { OR: [...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []), ...(phone ? [{ phone: { in: phoneVariants(phone) } }] : [])] } })) throw new HttpError(409, 'الجوال أو البريد مسجل مسبقاً');
    const passwordHash = d.password ? await hashPassword(d.password) : null;
    const created = await prisma.$transaction(async tx => {
      const u = await tx.user.create({ data: { name: text(d.name, 120, true), email, phone, passwordHash, registeredVia: 'admin', role: 'CLIENT', approvalStatus: 'ACTIVE' } });
      await tx.userRoleAssignment.createMany({ data: roles.map(r => ({ userId: u.id, roleId: r.id, assignedBy: user.id })) });
      await syncLegacyRole(tx, u.id); return u;
    });
    await securityLog('account.created', { actor: user.id, target: created.id, ip, details: { via: 'admin', roles: roleKeys } });
    return { success: true, id: created.id };
  }
  if (!userId) throw new HttpError(400, 'المستخدم مطلوب');

  if (action === 'setUserRoles') {
    const { user, held } = await requirePermission('users.manage_staff', 'users.edit');
    const roleKeys = roleKeyList(d.roleKeys);
    if (!roleKeys.length) throw new HttpError(400, 'اختر دوراً واحداً على الأقل');
    await assertCanManage(user, held, userId, roleKeys);
    const roles = await prisma.role.findMany({ where: { key: { in: roleKeys }, active: true }, include: { permissions: { select: { permission: { select: { code: true, sensitive: true } } } } } });
    if (roles.length !== roleKeys.length) throw new HttpError(400, 'دور غير موجود أو معطل');
    if (roles.some(r => escalates(user, held, r.permissions.map(p => p.permission)))) throw new HttpError(403, 'لا يمكنك منح دور يحمل صلاحيات حساسة لا تملكها');
    const target = await prisma.user.findUnique({ where: { id: userId }, include: { vendorProfile: { select: { id: true } } } });
    if (!target) throw new HttpError(404, 'الحساب غير موجود');
    if (roles.some(r => r.legacyRole === 'VENDOR') && !target.vendorProfile) throw new HttpError(400, 'لا يمكن إسناد دور المورد لحساب بلا ملف منشأة؛ يسجل المورد من نموذج التسجيل');
    const before = await roleKeysOf(target);
    await prisma.$transaction(async tx => {
      if (before.includes('system_admin') && !roleKeys.includes('system_admin')) await assertNotLastSysAdmin(tx, userId);
      await tx.userRoleAssignment.deleteMany({ where: { userId } });
      await tx.userRoleAssignment.createMany({ data: roles.map(r => ({ userId, roleId: r.id, assignedBy: user.id })) });
      await syncLegacyRole(tx, userId);
      await tx.authSession.deleteMany({ where: { userId } });   // a changed role takes effect at once, on every device
    });
    await securityLog('user.roles_changed', { actor: user.id, target: userId, ip, details: { before, after: roleKeys } });
    return { success: true };
  }

  if (action === 'setUserStatus') {
    const op = String(d.status || '');
    if (!['enable', 'disable', 'approve', 'reject'].includes(op)) throw new HttpError(400, 'الإجراء غير صالح');
    const { user, held } = await requirePermission(op === 'approve' || op === 'reject' ? 'users.approve' : 'users.disable');
    await assertCanManage(user, held, userId);
    if (userId === user.id) throw new HttpError(403, 'لا يمكنك تغيير حالة حسابك');
    await prisma.$transaction(async tx => {
      if (op === 'disable' || op === 'reject') await assertNotLastSysAdmin(tx, userId);
      await tx.user.update({ where: { id: userId }, data: op === 'enable' ? { isActive: true } : op === 'disable' ? { isActive: false } : op === 'approve' ? { approvalStatus: 'ACTIVE' } : { approvalStatus: 'REJECTED' } });
      if (op === 'disable' || op === 'reject') await tx.authSession.deleteMany({ where: { userId } });
    });
    await securityLog(op === 'enable' ? 'user.enabled' : op === 'disable' ? 'user.disabled' : op === 'approve' ? 'user.approved' : 'user.rejected', { actor: user.id, target: userId, ip });
    return { success: true };
  }

  if (action === 'updateContact') {
    const { user, held } = await requirePermission('users.edit');
    await assertCanManage(user, held, userId);
    const email = text(d.email, 254).toLowerCase() || null, phoneInput = text(d.phone, 20), phone = phoneInput ? normaliseTarget('sms', phoneInput) : null;
    if (email) normaliseTarget('email', email);
    const target = await prisma.user.findUnique({ where: { id: userId } });
    if (!target) throw new HttpError(404, 'الحساب غير موجود');
    const clash = await prisma.user.findFirst({ where: { id: { not: userId }, OR: [...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []), ...(phone ? [{ phone: { in: phoneVariants(phone) } }] : [])] } });
    if (clash) throw new HttpError(409, 'الجوال أو البريد مستخدم في حساب آخر');
    const emailChanged = (target.email || '').toLowerCase() !== (email || ''), phoneChanged = !!phone && !phoneVariants(phone).includes(target.phone || '');
    await prisma.$transaction(async tx => {
      await tx.user.update({ where: { id: userId }, data: { name: text(d.name, 120, true), ...(emailChanged ? { email, emailVerifiedAt: null } : {}), ...(phoneChanged ? { phone, phoneVerifiedAt: null } : {}) } });
      // A contact detail that changed no longer proves anything: drop its identity and the sessions that relied on it.
      if (emailChanged) await tx.loginIdentity.deleteMany({ where: { userId, provider: 'EMAIL' } });
      if (phoneChanged) await tx.loginIdentity.deleteMany({ where: { userId, provider: 'PHONE' } });
      if (emailChanged || phoneChanged) await tx.authSession.deleteMany({ where: { userId } });
    });
    if (emailChanged || phoneChanged) await securityLog('contact.changed', { actor: user.id, target: userId, ip, details: { email: emailChanged, phone: phoneChanged } });
    return { success: true };
  }
  throw new HttpError(400, 'الإجراء غير معروف');
});
