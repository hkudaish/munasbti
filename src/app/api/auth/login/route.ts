import { prisma } from '@/lib/db';
import { checkSecondFactor, totpEnabled } from '@/lib/server/totp';
import { api, body, text, HttpError } from '@/lib/server/http';
import { assertLoginAllowed, clearLoginFailures, clientIp, createSession, loginNeedsCaptcha, profile, rateLimit, recordLoginFailure, verifyPassword } from '@/lib/server/auth';
import { isKnownDevice, rememberDevice } from '@/lib/server/account-security';
import { captchaEnabled, verifyCaptcha } from '@/lib/server/captcha';
export const POST = api(async request => {
  const data = await body(request, 4096); const identifier = text(data.identifier, 254, true).toLowerCase();
  // Three keys, so one person cannot lock another out: the same device on the same account is limited tightly, a single address is limited across accounts
  // (credential stuffing), and an account is limited loosely across all addresses (a distributed guess).
  const ip = clientIp(request);
  await rateLimit(`login:${ip}:${identifier}`, 8); await rateLimit(`login-ip:${ip}`, 40); await rateLimit(`login-id:${identifier}`, 60);
  const user = await prisma.user.findFirst({ where: { OR: [{ phone: identifier }, { email: identifier }] }, include: { vendorProfile: true } });
  // A device that has signed in to this account before is not locked out by wrong guesses made elsewhere (it still counts its own failures).
  await assertLoginAllowed(ip, identifier, { ignoreAccountLock: !!user && await isKnownDevice(user.id) });
  // After a few wrong passwords the form must carry a CAPTCHA token (when Turnstile is configured); the first attempts stay frictionless.
  if (captchaEnabled() && await loginNeedsCaptcha(ip, identifier)) await verifyCaptcha(data.captchaToken, ip);
  if (!await verifyPassword(data.password, user?.passwordHash || null) || !user || !user.isActive) { await recordLoginFailure(ip, identifier); throw new HttpError(401, 'بيانات الدخول غير صحيحة؛ الحسابات القديمة تحتاج تهيئة كلمة مرور من مسؤول النظام', captchaEnabled() && await loginNeedsCaptcha(ip, identifier) ? { captchaRequired: true } : undefined); }
  // Accounts that enrolled an authenticator also need a current code (or a recovery code); a wrong one counts toward the same lockout as a wrong password.
  if (await totpEnabled(user.id)) {
    if (typeof data.code !== 'string' || !data.code.trim()) return { success: false, mfaRequired: true };
    if (!await checkSecondFactor(user.id, data.code)) { await recordLoginFailure(ip, identifier); throw new HttpError(401, 'رمز التحقق غير صحيح أو مستخدم من قبل'); }
  }
  await clearLoginFailures(ip, identifier);
  await createSession(user.id);
  await rememberDevice(user.id);
  return { success: true, user: profile(user) };
});
