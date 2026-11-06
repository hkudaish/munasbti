import 'server-only';
import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { digest } from './auth';
import { mailConfigured, sendMail } from './mailer';

export type TokenPurpose = 'RESET' | 'VERIFY_EMAIL';
const TTL: Record<TokenPurpose, number> = { RESET: 60 * 60 * 1000, VERIFY_EMAIL: 3 * 86400000 };

/** Links always point at the configured public address, never at the Host header (which an attacker can set to poison a reset e-mail). */
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

/** A new one-time token; earlier unused tokens of the same kind stop working. Only the hash is stored. */
export async function issueToken(userId: string, purpose: TokenPurpose) {
  const token = randomBytes(32).toString('base64url');
  await prisma.$transaction([
    prisma.accountToken.deleteMany({ where: { userId, purpose, usedAt: null } }),
    prisma.accountToken.create({ data: { userId, purpose, tokenHash: digest(token), expiresAt: new Date(Date.now() + TTL[purpose]) } }),
  ]);
  return token;
}

/** Spends a token exactly once (the update is conditional, so two simultaneous uses cannot both succeed). Returns the user id or null. */
export async function consumeToken(token: unknown, purpose: TokenPurpose): Promise<string | null> {
  if (typeof token !== 'string' || token.length < 20 || token.length > 128) return null;
  const tokenHash = digest(token), now = new Date();
  const spent = await prisma.accountToken.updateMany({ where: { tokenHash, purpose, usedAt: null, expiresAt: { gt: now } }, data: { usedAt: now } });
  if (spent.count !== 1) return null;
  return (await prisma.accountToken.findUnique({ where: { tokenHash }, select: { userId: true } }))?.userId ?? null;
}

const box = (title: string, body: string, link: string, button: string) =>
  `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:480px;margin:auto;padding:24px"><h2 style="color:#14532d">${title}</h2><p>${body}</p><p><a href="${link}" style="display:inline-block;background:#14532d;color:#fff;padding:12px 22px;border-radius:10px;text-decoration:none">${button}</a></p><p style="color:#666;font-size:13px">إذا لم تطلب ذلك فتجاهل هذه الرسالة؛ لن يتغير شيء.</p></div>`;

export async function sendPasswordReset(user: { id: string; email: string | null; name: string }) {
  if (!user.email) return false;
  const link = `${appUrl()}/reset-password?token=${await issueToken(user.id, 'RESET')}`;
  return sendMail({ to: user.email, subject: 'إعادة تعيين كلمة المرور - مناسبتـي', text: `مرحباً ${user.name}\nلإعادة تعيين كلمة المرور افتح الرابط (صالح لمدة ساعة):\n${link}\nإذا لم تطلب ذلك فتجاهل الرسالة.`, html: box('إعادة تعيين كلمة المرور', `مرحباً ${escapeHtml(user.name)}، الرابط التالي صالح لمدة ساعة ويعمل مرة واحدة.`, link, 'تعيين كلمة مرور جديدة') });
}

export async function sendEmailVerification(user: { id: string; email: string | null; name: string }) {
  if (!user.email || !mailConfigured()) return false;
  const link = `${appUrl()}/verify-email?token=${await issueToken(user.id, 'VERIFY_EMAIL')}`;
  return sendMail({ to: user.email, subject: 'تأكيد البريد الإلكتروني - مناسبتـي', text: `مرحباً ${user.name}\nلتأكيد بريدك الإلكتروني افتح الرابط:\n${link}`, html: box('تأكيد البريد الإلكتروني', `مرحباً ${escapeHtml(user.name)}، اضغط الزر لتأكيد بريدك الإلكتروني.`, link, 'تأكيد البريد') });
}
const escapeHtml = (v: string) => v.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));

// ---- Known devices -----------------------------------------------------------------------------
// A signed cookie set after a successful sign-in. While an account is locked by a flood of wrong guesses from elsewhere, the real owner on a
// device that has signed in before still gets in with the correct password, so guessing can no longer be used to lock someone out.
const DEVICE_COOKIE = 'munasabati_device';
const deviceSecret = () => process.env.SESSION_SECRET || process.env.AUTH_ENCRYPTION_KEY || process.env.CHANNEL_ENCRYPTION_KEY || '';
const sign = (userId: string) => createHmac('sha256', deviceSecret()).update('device:' + userId).digest('base64url');
export async function rememberDevice(userId: string) {
  if (!deviceSecret()) return;
  (await cookies()).set(DEVICE_COOKIE, `${userId}.${sign(userId)}`, { httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', path: '/', maxAge: 180 * 86400 });
}
export async function isKnownDevice(userId: string) {
  if (!deviceSecret()) return false;
  const value = (await cookies()).get(DEVICE_COOKIE)?.value ?? '', at = value.lastIndexOf('.');
  if (at < 1 || value.slice(0, at) !== userId) return false;
  const given = Buffer.from(value.slice(at + 1)), want = Buffer.from(sign(userId));
  return given.length === want.length && timingSafeEqual(given, want);
}
