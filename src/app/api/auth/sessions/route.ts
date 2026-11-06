import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { clientIp, currentSessionHash, digest, requireUser } from '@/lib/server/auth';
import { securityLog } from '@/lib/server/security-log';
export const dynamic = 'force-dynamic';
const publicId = (tokenHash: string) => digest('session-id:' + tokenHash).slice(0, 20);   // the stored hash is the credential, so it is never sent to the browser

/** The signed-in person's own devices. */
export const GET = api(async () => {
  const user = await requireUser(); const current = await currentSessionHash();
  const rows = await prisma.authSession.findMany({ where: { userId: user.id, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  return { sessions: rows.map(r => ({ id: publicId(r.tokenHash), current: r.tokenHash === current, method: r.method, ip: r.ip, userAgent: r.userAgent, createdAt: r.createdAt, lastSeenAt: r.lastSeenAt, expiresAt: r.expiresAt })) };
});

/** End one session ({id}) or every session except this one ({others:true}). */
export const DELETE = api(async request => {
  const user = await requireUser(); const data = await body(request, 1024); const current = await currentSessionHash();
  const rows = await prisma.authSession.findMany({ where: { userId: user.id }, select: { tokenHash: true } });
  const targets = data.others === true ? rows.filter(r => r.tokenHash !== current) : rows.filter(r => r.tokenHash !== current && publicId(r.tokenHash) === data.id);
  if (data.others !== true && !targets.length) throw new HttpError(404, 'الجلسة غير موجودة أو هي جلستك الحالية');
  if (targets.length) await prisma.authSession.deleteMany({ where: { userId: user.id, tokenHash: { in: targets.map(t => t.tokenHash) } } });
  await securityLog('session.revoked', { actor: user.id, target: user.id, ip: clientIp(request), details: { count: targets.length } });
  return { success: true, revoked: targets.length };
});
