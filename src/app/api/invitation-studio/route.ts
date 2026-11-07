import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/db';
import { api, body, HttpError, integer, text } from '@/lib/server/http';
import { requireUser, sessionUser } from '@/lib/server/auth';
import { ownOccasion } from '@/lib/server/invitations';
import { BUILTIN_TEMPLATES, validateDesign, validateTemplate } from '@/lib/invitations/catalog';
import { LIBRARY_TEMPLATES } from '@/lib/invitations/library';
import { normalizeInvitationOrigin } from '@/lib/invitations/link';
const isAdmin = (role: string) => ['ADMIN', 'SUPER_ADMIN'].includes(role);
async function templates(userId: string, role: string) {
  const rows = await prisma.invitationTemplate.findMany({ where: isAdmin(role) ? {} : { OR: [{ ownerId: userId }, { status: 'published' }] }, orderBy: { updatedAt: 'desc' }, take: 500 });
  return rows.map(t => ({ ...(t.data as object), id: t.id, ownerId: t.ownerId, status: t.status, version: t.version, updatedAt: t.updatedAt.toISOString() }));
}
export const dynamic = 'force-dynamic';
export const GET = api(async request => {
  const id = new URL(request.url).searchParams.get('occasionId') || '';
  if (!id) {
    // the direct "digital cards" service: no occasion, so no draft or guest link; a visitor still sees the library
    const user = await sessionUser();
    if (!user) return { records: [], draft: null, version: 0, shareOrigin: '', favorites: [] };
    return { records: await templates(user.id, user.role), draft: null, version: 0, shareOrigin: '', favorites: (await prisma.invitationFavorite.findMany({ where: { userId: user.id } })).map(f => f.templateId) };
  }
  const user = await requireUser();
  const o = await ownOccasion(id, user.id);
  return { records: await templates(user.id, user.role), draft: o.invitationDraft, version: o.draftVersion, shareOrigin: o.shareOrigin, favorites: (await prisma.invitationFavorite.findMany({ where: { userId: user.id } })).map(f => f.templateId) };
});
export const POST = api(async request => {
  const user = await requireUser(); const d = await body(request); const admin = isAdmin(user.role);
  if (d.action === 'draft') {
    await ownOccasion(text(d.occasionId, 100, true), user.id);
    let design; try { design = validateDesign(d.design); } catch { throw new HttpError(400, 'تصميم غير صالح'); }
    const version = integer(d.version, 2147483646);
    let origin: string | undefined;
    if (d.shareOrigin) { try { origin = normalizeInvitationOrigin(d.shareOrigin); } catch { throw new HttpError(400, 'عنوان الموقع غير صالح'); } }
    const updated = await prisma.occasion.updateMany({ where: { id: d.occasionId, userId: user.id, draftVersion: version }, data: { invitationDraft: design as unknown as Prisma.InputJsonValue, draftVersion: { increment: 1 }, ...(origin ? { shareOrigin: origin } : {}) } });
    if (!updated.count) throw new HttpError(409, 'تم تعديل المسودة من جهاز آخر؛ أعد التحميل قبل الحفظ');
    return { version: version + 1 };
  }
  if (d.action === 'favorite') {
    const templateId = text(d.templateId, 100, true);
    if (!BUILTIN_TEMPLATES.some(t => t.id === templateId) && !LIBRARY_TEMPLATES.some(t => t.id === templateId) && !await prisma.invitationTemplate.findFirst({ where: { id: templateId, OR: [{ ownerId: user.id }, { status: 'published' }] } })) throw new HttpError(404, 'القالب غير متاح');
    if (d.selected === true) await prisma.invitationFavorite.upsert({ where: { userId_templateId: { userId: user.id, templateId } }, create: { userId: user.id, templateId }, update: {} });
    else await prisma.invitationFavorite.deleteMany({ where: { userId: user.id, templateId } });
    return { success: true };
  }
  if (d.action === 'template') {
    let t; try { t = validateTemplate(d.template); } catch { throw new HttpError(400, 'القالب غير صالح'); }
    const existing = await prisma.invitationTemplate.findUnique({ where: { id: t.id } });
    if (!existing) {
      if (t.ownerId !== user.id || t.status !== 'private') throw new HttpError(403, 'يمكن إنشاء قالب خاص بك فقط');
      await prisma.invitationTemplate.create({ data: { id: t.id, ownerId: user.id, status: 'private', version: 1, data: t as unknown as Prisma.InputJsonValue } });
    } else {
      const own = existing.ownerId === user.id;
      const from = existing.status, to = t.status;
      const editable = own && ['private','rejected'].includes(from);
      const allowed = (editable && ['private','pending','archived'].includes(to)) || (admin && from === 'pending' && ['published','rejected'].includes(to)) || (admin && to === 'archived');
      if (!allowed) throw new HttpError(403, 'لا تملك صلاحية هذا التعديل');
      if (to === 'rejected' && !t.reviewNote?.trim()) throw new HttpError(400, 'سبب طلب التعديل مطلوب');
      const content = to === 'private' && editable ? t : { ...(existing.data as object), reviewNote: to === 'rejected' ? t.reviewNote : undefined };
      const changed = await prisma.invitationTemplate.updateMany({ where: { id: t.id, version: integer(d.expectedVersion, 2147483646) }, data: { status: to, version: { increment: 1 }, data: JSON.parse(JSON.stringify(content)) } });
      if (!changed.count) throw new HttpError(409, 'تم تعديل القالب من جهاز آخر؛ أعد التحميل');
    }
    return { records: await templates(user.id, user.role) };
  }
  throw new HttpError(400, 'عملية غير صالحة');
});
