import { api, body, HttpError, text } from '@/lib/server/http';
import { clientIp, profile, rateLimit } from '@/lib/server/auth';
import { checkCode, normaliseTarget } from '@/lib/server/otp';
import { completeSignIn, peekAccount, resolveIdentity, type VerifiedIdentity } from '@/lib/server/identity';
import { accessOf, selfRegistrationRoles } from '@/lib/server/rbac';
import { checkSecondFactor, totpEnabled } from '@/lib/server/totp';
import { securityLog } from '@/lib/server/security-log';

/**
 * One endpoint for sign-in and sign-up by code. The code proves the phone or mailbox; then:
 *   - a known identity or a matching verified contact signs in (linking, never duplicating, the account);
 *   - an unknown one needs a name (and an account type) first: the answer is {needsProfile:true} and the code stays valid for that second call;
 *   - an account with an authenticator app also needs its current code: the answer is {mfaRequired:true} and the code stays valid for that second call.
 */
export const POST = api(async request => {
  const data = await body(request, 2048); const ip = clientIp(request);
  const channel = data.channel as 'sms' | 'whatsapp' | 'email';
  if (!['sms', 'whatsapp', 'email'].includes(channel)) throw new HttpError(400, 'قناة التحقق غير صالحة');
  const name = text(data.name, 120), roleKey = text(data.roleKey, 40), totp = typeof data.totp === 'string' ? data.totp.trim() : '';
  const target = normaliseTarget(channel, data.target);
  const identity: VerifiedIdentity = channel === 'email' ? { provider: 'EMAIL', providerUserId: target, email: target, emailVerified: true } : { provider: 'PHONE', providerUserId: target, phone: target };
  const accountId = await peekAccount(identity);
  const needSecond = !!accountId && await totpEnabled(accountId);
  // A sign-up that will be refused must not spend the code: check the chosen account type first.
  if (!accountId && name && !(await selfRegistrationRoles()).some(r => r.key === (roleKey || 'client'))) throw new HttpError(403, 'التسجيل الذاتي غير متاح لهذا النوع من الحسابات');
  // The code is spent only when this call can finish the sign-in; otherwise it is checked and kept for the follow-up call.
  await checkCode(channel, target, data.code, ip, { keep: (!accountId && !name) || (needSecond && !totp) });
  if (needSecond) {
    if (!totp) return { success: false, mfaRequired: true };
    await rateLimit(`otp-totp:${accountId}`, 10, 900000);
    if (!await checkSecondFactor(accountId!, totp)) { await securityLog('login.failed', { actor: accountId!, target: accountId!, ip, details: { method: channel, reason: 'second_factor' } }); throw new HttpError(401, 'رمز التحقق غير صحيح أو مستخدم من قبل'); }
  }
  const outcome = await resolveIdentity(identity, { name, roleKey: roleKey || undefined, ip });
  if (outcome.status === 'needsProfile') return { success: false, needsProfile: true, roles: outcome.roles };
  const user = await completeSignIn(request, outcome.userId, channel);
  return { success: true, created: outcome.created, user: { ...profile(user), ...await accessOf(user) } };
});
