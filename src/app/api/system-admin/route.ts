import { prisma } from '@/lib/db';
import { api, body, HttpError, text, integer } from '@/lib/server/http';
import { hashPassword, requireSystemAdmin } from '@/lib/server/auth';
import { FEATURE_CATALOG } from '@/lib/system/feature-catalog';
import { featureStates } from '@/lib/server/features';
import { contact, role, systemMutation, userSelect } from '@/lib/server/system-admin';
import { assignLegacyRole } from '@/lib/server/rbac';
export const dynamic = 'force-dynamic';
export const GET = api(async request => {
  await requireSystemAdmin(); const url = new URL(request.url); const q = (url.searchParams.get('q') || '').slice(0,120);
  const page = Math.max(0, Math.min(100000, Number(url.searchParams.get('page')) || 0));
  if (!Number.isInteger(page)) throw new HttpError(400, 'الصفحة غير صالحة');
  const [users, vendors, userCount, vendorCount, admins, features, audit] = await Promise.all([
    prisma.user.findMany({ where: { AND: [ ...(url.searchParams.get('kind') === 'admins' ? [{ role: { in: ['ADMIN' as const, 'SUPER_ADMIN' as const] } }] : []), ...(q ? [{ OR: [{ name: { contains: q, mode: 'insensitive' as const } }, { phone: { contains: q } }, { email: { contains: q, mode: 'insensitive' as const } }] }] : []) ] }, select: userSelect, orderBy: { createdAt: 'desc' }, skip: page * 50, take: 50 }),
    prisma.vendor.findMany({ where: q ? { businessName: { contains: q, mode: 'insensitive' } } : {}, select: { id: true, businessName: true, userId: true, status: true, verified: true, contactPhone: true, categoryId: true, cityId: true, updatedAt: true }, orderBy: { createdAt: 'desc' }, skip: page * 50, take: 50 }),
    prisma.user.count(), prisma.vendor.count(), prisma.user.count({ where: { role: { in: ['ADMIN','SUPER_ADMIN'] } } }), featureStates(),
    prisma.systemAuditLog.findMany({ orderBy: { createdAt: 'desc' }, take: 30 }),
  ]);
  return { users, vendors, features, audit, totals: { users: userCount, vendors: vendorCount, admins }, page };
});
export const POST = api(async request => {
  const actor = await requireSystemAdmin(); const d = await body(request, 16000);
  if (d.action === 'feature') {
    const definition = FEATURE_CATALOG.find(f => f.id === d.id);
    if (!definition || typeof d.visible !== 'boolean' || typeof d.enabled !== 'boolean') throw new HttpError(400, 'إعدادات الخدمة غير صالحة');
    const version = integer(d.version, 2147483646);
    await systemMutation(actor.id, async tx => {
      if (version === 0) await tx.systemFeature.create({ data: { id: definition.id, visible: d.visible, enabled: d.enabled } });
      else { const result = await tx.systemFeature.updateMany({ where: { id: definition.id, version }, data: { visible: d.visible, enabled: d.enabled, version: { increment: 1 } } }); if (!result.count) throw new HttpError(409, 'تم تعديل الخدمة؛ أعد تحميل الإعدادات'); }
      await tx.systemAuditLog.create({ data: { actorId: actor.id, action: 'FEATURE_UPDATED', targetId: definition.id, details: { visible: d.visible, enabled: d.enabled } } });
    }); return { success: true };
  }
  if (d.action === 'createUser') {
    const data = contact(d); const passwordHash = await hashPassword(d.password); const newRole = role(d.role);
    const user = await systemMutation(actor.id, async tx => {
      const created = await tx.user.create({ data: { ...data, passwordHash, role: newRole, cityId: text(d.cityId, 80) || null } });
      await assignLegacyRole(tx, created.id, newRole, actor.id);
      await tx.systemAuditLog.create({ data: { actorId: actor.id, action: 'USER_CREATED', targetId: created.id, details: { role: newRole } } }); return { id: created.id };
    }); return { success: true, user };
  }
  if (d.action === 'updateUser') {
    const id = text(d.id, 100, true); const data = contact(d); const nextRole = role(d.role);
    if (typeof d.isActive !== 'boolean') throw new HttpError(400, 'حالة الحساب غير صالحة');
    const stamp = new Date(text(d.updatedAt, 80, true)); if (isNaN(stamp.getTime())) throw new HttpError(400, 'إصدار الحساب غير صالح');
    const passwordHash = d.password ? await hashPassword(d.password) : undefined;
    await systemMutation(actor.id, async tx => {
      const target = await tx.user.findUnique({ where: { id } }); if (!target) throw new HttpError(404, 'الحساب غير موجود');
      if (target.role === 'SUPER_ADMIN' && target.isActive && (!d.isActive || nextRole !== 'SUPER_ADMIN') && await tx.user.count({ where: { role: 'SUPER_ADMIN', isActive: true } }) <= 1) throw new HttpError(409, 'يجب الإبقاء على مدير نظام واحد نشط على الأقل');
      const changed = await tx.user.updateMany({ where: { id, updatedAt: stamp }, data: { ...data, role: nextRole, isActive: d.isActive, ...(passwordHash ? { passwordHash } : {}) } });
      if (!changed.count) throw new HttpError(409, 'تم تعديل الحساب؛ أعد تحميل البيانات');
      if (nextRole !== target.role) await assignLegacyRole(tx, id, nextRole, actor.id);
      if (passwordHash || !d.isActive || nextRole !== target.role) await tx.authSession.deleteMany({ where: { userId: id } });
      await tx.systemAuditLog.create({ data: { actorId: actor.id, action: 'USER_UPDATED', targetId: id, details: { role: nextRole, isActive: d.isActive, passwordReset: !!passwordHash } } });
    }); return { success: true };
  }
  if (d.action === 'updateVendor') {
    const id = text(d.id,100,true); const businessName = text(d.businessName,160,true);
    if (!['ACTIVE','UNDER_REVIEW','SUSPENDED'].includes(d.status) || typeof d.verified !== 'boolean') throw new HttpError(400, 'حالة المورد غير صالحة');
    const stamp = new Date(text(d.updatedAt,80,true)); if (isNaN(stamp.getTime())) throw new HttpError(400, 'إصدار المورد غير صالح');
    await systemMutation(actor.id, async tx => {
      const changed = await tx.vendor.updateMany({ where: { id, updatedAt: stamp }, data: { businessName, status: d.status, verified: d.verified } });
      if (!changed.count) throw new HttpError(409, 'تم تعديل المورد؛ أعد تحميل البيانات');
      await (await import('@/lib/server/vendor-approval')).syncApprovalFromStatus(tx as any, id, d.status, actor.id);
      await tx.systemAuditLog.create({ data: { actorId: actor.id, action: 'VENDOR_UPDATED', targetId: id, details: { status: d.status, verified: d.verified } } });
    }); return { success: true };
  }
  throw new HttpError(400, 'العملية غير صالحة');
});
