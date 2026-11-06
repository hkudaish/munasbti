import 'server-only';
import { randomBytes, createHash, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
const scrypt = promisify(scryptCallback);
const COOKIE = 'munasabati_session';
export async function hashPassword(password: string) {
  if (typeof password !== 'string' || password.length < 12 || password.length > 128) throw new HttpError(400, 'استخدم كلمة مرور من 12 إلى 128 حرفاً');
  const salt = randomBytes(16).toString('hex');
  return `scrypt:${salt}:${(await scrypt(password, salt, 64) as Buffer).toString('hex')}`;
}
export async function verifyPassword(password: string, hash: string | null) {
  // Run the same expensive operation for unknown/legacy accounts.
  const [, salt, expected] = (hash || `scrypt:${'0'.repeat(32)}:${'0'.repeat(128)}`).split(':');
  const actual = await scrypt(typeof password === 'string' && password.length <= 128 ? password : '', salt, 64) as Buffer;
  const target = Buffer.from(expected, 'hex');
  return !!hash && actual.length === target.length && timingSafeEqual(actual, target);
}
export const digest = (value: string) => createHash('sha256').update(value).digest('hex');
export async function createSession(userId: string) {
  const token = randomBytes(32).toString('base64url'); const expiresAt = new Date(Date.now() + 7 * 86400000);
  await prisma.authSession.create({ data: { tokenHash: digest(token), userId, expiresAt } });
  // Keep a person's session list short: drop expired ones and everything beyond the ten newest.
  await prisma.authSession.deleteMany({ where: { userId, expiresAt: { lte: new Date() } } });
  const stale = await prisma.authSession.findMany({ where: { userId }, orderBy: { createdAt: 'desc' }, skip: 10, select: { tokenHash: true } });
  if (stale.length) await prisma.authSession.deleteMany({ where: { tokenHash: { in: stale.map(s => s.tokenHash) } } });
  (await cookies()).set(COOKIE, token, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', expires: expiresAt });
}
export async function sessionUser() {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.authSession.findUnique({ where: { tokenHash: digest(token) }, include: { user: { include: { vendorProfile: true } } } });
  return session && session.user.isActive && session.expiresAt > new Date() ? session.user : null;
}
export async function requireUser() { const user = await sessionUser(); if (!user) throw new HttpError(401, 'يرجى تسجيل الدخول'); return user; }
export async function logout() { const token = (await cookies()).get(COOKIE)?.value; if (token) await prisma.authSession.deleteMany({ where: { tokenHash: digest(token) } }); (await cookies()).delete(COOKIE); }
export function profile(user: any) {
  return { id: user.id, name: user.name, phone: user.phone, email: user.email, emailVerified: !!user.emailVerifiedAt, cityId: user.cityId, createdAt: user.createdAt, avatar: user.avatar, role: ['ADMIN','SUPER_ADMIN'].includes(user.role) ? 'admin' : user.role === 'VENDOR' ? 'vendor' : 'client', hasSystemAccess: user.role === 'SUPER_ADMIN', hasAdminAccess: ['ADMIN','SUPER_ADMIN'].includes(user.role), vendorId: user.vendorProfile?.id, businessName: user.vendorProfile?.businessName };
}
/**
 * The visitor's address, read only from a header the hosting layer controls:
 *  - on Netlify (NETLIFY is set at runtime) its own header, which the client cannot set;
 *  - anywhere else (Hostinger behind LiteSpeed/Nginx, a VPS) the entry of X-Forwarded-For that the LAST trusted proxy appended, counted from the right.
 *    The leftmost entries are written by the client, so trusting them would let anyone rotate addresses to dodge every per-address limit.
 *    TRUSTED_PROXY_HOPS is the number of proxies in front of the app (default 1); 0 means no proxy, so no forwarded header is trusted.
 */
export function clientIp(request: Request) {
  if (process.env.NETLIFY) { const nf = request.headers.get('x-nf-client-connection-ip'); if (nf) return nf; }
  const hops = Math.max(0, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? '1', 10) || 0);
  const list = hops > 0 ? (request.headers.get('x-forwarded-for') ?? '').split(',').map(part => part.trim()).filter(Boolean) : [];
  return list.length ? list[Math.max(0, list.length - hops)] : 'local';
}
export async function rateLimit(key: string, limit = 20, windowMs = 900000) {
  const hashed = digest(key); const now = new Date();
  await prisma.authAttempt.deleteMany({ where: { key: hashed, expiresAt: { lte: now } } });
  const attempt = await prisma.authAttempt.upsert({ where: { key: hashed }, create: { key: hashed, expiresAt: new Date(Date.now() + windowMs) }, update: { count: { increment: 1 } } });
  if (attempt.count > limit) throw new HttpError(429, 'طلبات كثيرة؛ حاول بعد قليل');
}

const FAIL_PAIR_LIMIT = 5, FAIL_ACCOUNT_LIMIT = 20, FAIL_WINDOW = 900000, FAIL_ACCOUNT_WINDOW = 3600000, LOCK_BASE = 900000, LOCK_MAX = 86400000;
const failKeys = (ip: string, identifier: string) => ({ pair: digest(`fail:${ip}:${identifier}`), account: digest(`fail-id:${identifier}`), tier: digest(`lock-tier:${identifier}`) });
/** Refuses a sign-in while the device or the account is locked after repeated wrong passwords. Checking never counts as an attempt, so a locked-out attacker cannot extend a victim's lock. */
export async function assertLoginAllowed(ip: string, identifier: string, options: { ignoreAccountLock?: boolean } = {}) {
  const k = failKeys(ip, identifier); const now = new Date();
  const rows = await prisma.authAttempt.findMany({ where: { key: { in: [k.pair, k.account] }, expiresAt: { gt: now } } });
  const locked = rows.filter(r => (r.key === k.pair || !options.ignoreAccountLock) && r.count >= (r.key === k.pair ? FAIL_PAIR_LIMIT : FAIL_ACCOUNT_LIMIT)).sort((a, b) => b.expiresAt.getTime() - a.expiresAt.getTime())[0];
  if (locked) {
    const retryAfter = Math.max(1, Math.ceil((locked.expiresAt.getTime() - now.getTime()) / 1000)), minutes = Math.ceil(retryAfter / 60);
    throw new HttpError(429, `تم إيقاف تسجيل الدخول مؤقتاً بعد محاولات خاطئة متكررة. حاول بعد ${minutes >= 120 ? Math.ceil(minutes / 60) + ' ساعات' : minutes + ' دقيقة'}`, { retryAfter });
  }
}
/** Counts a wrong password. Reaching the limit locks that device on that account, then the whole account, for 15 minutes the first time and twice as long for each later lock within a day (at most 24 hours). */
export async function recordLoginFailure(ip: string, identifier: string) {
  const k = failKeys(ip, identifier);
  for (const [key, limit, window] of [[k.pair, FAIL_PAIR_LIMIT, FAIL_WINDOW], [k.account, FAIL_ACCOUNT_LIMIT, FAIL_ACCOUNT_WINDOW]] as const) {
    await prisma.authAttempt.deleteMany({ where: { key, expiresAt: { lte: new Date() } } });
    const row = await prisma.authAttempt.upsert({ where: { key }, create: { key, expiresAt: new Date(Date.now() + window) }, update: { count: { increment: 1 } } });
    if (row.count === limit) {
      await prisma.authAttempt.deleteMany({ where: { key: k.tier, expiresAt: { lte: new Date() } } });
      const tier = await prisma.authAttempt.upsert({ where: { key: k.tier }, create: { key: k.tier, expiresAt: new Date(Date.now() + 86400000) }, update: { count: { increment: 1 } } });
      await prisma.authAttempt.update({ where: { key }, data: { expiresAt: new Date(Date.now() + Math.min(LOCK_BASE * 2 ** (tier.count - 1), LOCK_MAX)) } });
    }
  }
}
/** A correct password clears this device's failures; the account-wide count is left to expire so a guesser cannot reset it. */
export async function clearLoginFailures(ip: string, identifier: string) { await prisma.authAttempt.deleteMany({ where: { key: failKeys(ip, identifier).pair } }); }

export async function requireSystemAdmin() { const user = await requireUser(); if (user.role !== 'SUPER_ADMIN') throw new HttpError(403, 'هذه الصلاحية مخصصة لمدير النظام'); return user; }
export async function requireAdmin() { const user = await requireUser(); if (!['ADMIN','SUPER_ADMIN'].includes(user.role)) throw new HttpError(403, 'هذه الصلاحية مخصصة للإدارة'); return user; }

/** After a few wrong passwords from this device (or many across the account) the sign-in form must carry a CAPTCHA token. */
export async function loginNeedsCaptcha(ip: string, identifier: string) {
  const k = failKeys(ip, identifier);
  const rows = await prisma.authAttempt.findMany({ where: { key: { in: [k.pair, k.account] }, expiresAt: { gt: new Date() } } });
  return rows.some(r => r.count >= (r.key === k.pair ? 3 : 10));
}
/** A password reset proves the owner controls the e-mail address, so it also lifts the account-wide lock left by earlier wrong guesses. */
export async function clearAccountLock(identifiers: (string | null | undefined)[]) {
  const keys = identifiers.filter((v): v is string => !!v).flatMap(id => { const k = failKeys('', id.toLowerCase()); return [k.account, k.tier]; });
  if (keys.length) await prisma.authAttempt.deleteMany({ where: { key: { in: keys } } });
}
