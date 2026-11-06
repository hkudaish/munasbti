import { api, body, HttpError } from '@/lib/server/http';
import { clientIp } from '@/lib/server/auth';
import { verifyCaptcha } from '@/lib/server/captcha';
import { requestCode } from '@/lib/server/otp';
export const POST = api(async request => {
  const data = await body(request, 2048); const ip = clientIp(request);
  if (!['sms', 'whatsapp', 'email'].includes(data.channel)) throw new HttpError(400, 'قناة التحقق غير صالحة');
  await verifyCaptcha(data.captchaToken, ip);   // a code costs money and reaches a third party: CAPTCHA first (passes when Turnstile is not configured)
  return { success: true, ...await requestCode(data.channel, data.target, ip) };   // identical answer for known and unknown targets
});
