import { prisma } from '@/lib/db';
import { api, body, text } from '@/lib/server/http';
import { clientIp, rateLimit } from '@/lib/server/auth';
import { verifyCaptcha } from '@/lib/server/captcha';
import { sendPasswordReset } from '@/lib/server/account-security';
export const dynamic = 'force-dynamic';
/** Always answers the same way, so the form cannot be used to find out which phone numbers or e-mails have an account. The e-mail goes out in the background. */
export const POST = api(async request => {
  const data = await body(request, 2048), identifier = text(data.identifier, 254, true).toLowerCase(), ip = clientIp(request);
  await verifyCaptcha(data.captchaToken, ip);
  await rateLimit(`forgot-ip:${ip}`, 10, 3600000); await rateLimit(`forgot-id:${identifier}`, 3, 3600000);
  const user = await prisma.user.findFirst({ where: { OR: [{ phone: identifier }, { email: identifier }] }, select: { id: true, email: true, name: true, isActive: true } });
  if (user?.isActive && user.email) void sendPasswordReset(user);
  return { success: true, message: 'إذا كان الحساب مسجلاً ببريد إلكتروني فقد أُرسل إليه رابط إعادة التعيين.' };
});
