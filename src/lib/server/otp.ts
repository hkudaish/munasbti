import 'server-only';
import { createHmac, randomInt, timingSafeEqual } from 'node:crypto';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
import { rateLimit } from './auth';
import { authSettings, availableMethods } from './auth-settings';
import { sendOtp, type Channel } from './notify';
import { internationalPhone } from './channels';
import { maskTarget, securityLog } from './security-log';

export const OTP_MINUTES = 10, OTP_MAX_ATTEMPTS = 5;
// The resend delay can be shortened for automated tests, never in production.
const RESEND_SECONDS = process.env.NODE_ENV !== 'production' && process.env.OTP_RESEND_SECONDS ? Number(process.env.OTP_RESEND_SECONDS) : 60;

/** Canonical form of a phone number (+9665...) or e-mail (lower case). Anything else is rejected before a code is sent. */
export function normaliseTarget(channel: Channel, value: unknown): string {
  if (typeof value !== 'string' || value.length > 254) throw new HttpError(400, 'بيانات التحقق غير صالحة');
  if (channel === 'email') { const v = value.trim().toLowerCase(); if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v)) throw new HttpError(400, 'البريد الإلكتروني غير صالح'); return v; }
  return internationalPhone(value.trim());
}
/** Forms in which the same phone may already be stored (older accounts saved it as typed). */
export function phoneVariants(e164: string) {
  const digits = e164.slice(1), set = new Set([e164, digits, digits.startsWith('00') ? digits : '00' + digits]);
  if (digits.startsWith('966') && digits.length === 12) { set.add('0' + digits.slice(3)); set.add(digits.slice(3)); }
  return [...set];
}

// The code is a keyed hash, so a copy of the table cannot be used to recover a six-digit code offline.
const secret = () => process.env.OTP_HMAC_KEY || process.env.SESSION_SECRET || process.env.AUTH_ENCRYPTION_KEY || (process.env.NODE_ENV === 'production' ? '' : 'dev-only-otp-key');
const hashCode = (channel: string, target: string, code: string) => {
  const key = secret(); if (!key) throw new HttpError(503, 'مفتاح التحقق غير مهيأ على الخادم');
  return createHmac('sha256', key).update(`${channel}:${target}:${code}`).digest('hex');
};

/** Sends a code. The response never says whether an account exists for the target, so this cannot be used to look people up. */
export async function requestCode(channel: Channel, rawTarget: unknown, ip: string) {
  const methods = await availableMethods();
  if (!methods.channels.includes(channel)) throw new HttpError(400, 'قناة التحقق هذه غير متاحة');
  const target = normaliseTarget(channel, rawTarget);
  await rateLimit(`otp-ip:${ip}`, 20, 3600000);            // one address: 20 codes an hour
  await rateLimit(`otp-target:${channel}:${target}`, 5, 3600000);   // one phone or mailbox: 5 codes an hour, so nobody can be flooded with messages
  const last = await prisma.verificationCode.findFirst({ where: { channel, target, consumedAt: null }, orderBy: { createdAt: 'desc' } });
  if (last && Date.now() - last.createdAt.getTime() < RESEND_SECONDS * 1000) {
    const retryAfter = Math.ceil((RESEND_SECONDS * 1000 - (Date.now() - last.createdAt.getTime())) / 1000);
    throw new HttpError(429, `انتظر ${retryAfter} ثانية قبل طلب رمز جديد`, { retryAfter });
  }
  const code = String(randomInt(0, 1000000)).padStart(6, '0');
  // A new code replaces every earlier unused one for the same target, so only the latest message works.
  await prisma.$transaction([
    prisma.verificationCode.updateMany({ where: { channel, target, consumedAt: null }, data: { consumedAt: new Date() } }),
    prisma.verificationCode.create({ data: { channel, target, purpose: 'login', codeHash: hashCode(channel, target, code), expiresAt: new Date(Date.now() + OTP_MINUTES * 60000), ip } }),
  ]);
  try { await sendOtp(channel, (await authSettings()).providers[channel], { to: target, code, minutes: OTP_MINUTES }); }
  catch (e) { await securityLog('otp.send_failed', { ip, details: { channel, target: maskTarget(target) } }); throw e; }
  await securityLog('otp.sent', { ip, details: { channel, target: maskTarget(target) } });
  return { sent: true, resendAfter: RESEND_SECONDS, expiresInMinutes: OTP_MINUTES };
}

/**
 * Checks a code. Every call counts as an attempt first (so a parallel flood cannot beat the limit), five wrong tries burn the code, and a correct code is
 * spent with a conditional update so it can be used exactly once. With `keep`, a correct code is verified but not spent (used while the person still has to
 * give a name for a new account).
 */
export async function checkCode(channel: Channel, rawTarget: unknown, rawCode: unknown, ip: string, options: { keep?: boolean } = {}) {
  const target = normaliseTarget(channel, rawTarget);
  if (typeof rawCode !== 'string' || !/^\d{6}$/.test(rawCode.trim())) throw new HttpError(400, 'أدخل الرمز المكون من 6 أرقام');
  await rateLimit(`otp-verify-ip:${ip}`, 60, 3600000);
  const row = await prisma.verificationCode.findFirst({ where: { channel, target, consumedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: 'desc' } });
  const fail = async (event: string): Promise<never> => { await securityLog(event, { ip, details: { channel, target: maskTarget(target) } }); throw new HttpError(400, 'الرمز غير صحيح أو منتهي؛ اطلب رمزاً جديداً'); };
  if (!row) return fail('otp.failed');
  const counted = await prisma.verificationCode.updateMany({ where: { id: row.id, consumedAt: null, attempts: { lt: OTP_MAX_ATTEMPTS } }, data: { attempts: { increment: 1 } } });
  if (counted.count !== 1) return fail('otp.locked');
  const want = Buffer.from(row.codeHash), given = Buffer.from(hashCode(channel, target, rawCode.trim()));
  if (want.length !== given.length || !timingSafeEqual(want, given)) return fail('otp.failed');
  if (options.keep) await prisma.verificationCode.updateMany({ where: { id: row.id }, data: { attempts: { decrement: 1 } } });
  else { const spent = await prisma.verificationCode.updateMany({ where: { id: row.id, consumedAt: null }, data: { consumedAt: new Date() } }); if (spent.count !== 1) return fail('otp.failed'); }
  return { channel, target };
}

/** Housekeeping, called from the scheduled job. */
export async function purgeCodes() {
  const cutoff = new Date(Date.now() - 86400000);
  const [codes, states] = await Promise.all([prisma.verificationCode.deleteMany({ where: { expiresAt: { lt: cutoff } } }), prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } })]);
  return { codes: codes.count, states: states.count };
}
