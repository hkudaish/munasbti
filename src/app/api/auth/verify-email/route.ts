import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { clientIp, rateLimit, requireUser } from '@/lib/server/auth';
import { consumeToken, sendEmailVerification } from '@/lib/server/account-security';
export const dynamic = 'force-dynamic';
/** POST { token } confirms the address; POST {} (signed in) sends a new link. */
export const POST = api(async request => {
  const data = await body(request, 2048);
  if (data.token !== undefined) {
    await rateLimit(`verify-ip:${clientIp(request)}`, 30, 3600000);
    const userId = await consumeToken(data.token, 'VERIFY_EMAIL');
    if (!userId) throw new HttpError(400, 'الرابط غير صالح أو منتهي؛ اطلب رابطاً جديداً من حسابك');
    await prisma.user.update({ where: { id: userId }, data: { emailVerifiedAt: new Date() } });
    return { success: true };
  }
  const user = await requireUser();
  if (!user.email) throw new HttpError(400, 'لا يوجد بريد إلكتروني في حسابك');
  if (user.emailVerifiedAt) return { success: true, alreadyVerified: true };
  await rateLimit(`verify-resend:${user.id}`, 3, 3600000);
  return { success: await sendEmailVerification(user) };
});
