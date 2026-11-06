import { prisma } from '@/lib/db';
import { api, body, HttpError } from '@/lib/server/http';
import { clearAccountLock, clientIp, hashPassword, rateLimit } from '@/lib/server/auth';
import { consumeToken } from '@/lib/server/account-security';
export const dynamic = 'force-dynamic';
export const POST = api(async request => {
  const data = await body(request, 2048);
  await rateLimit(`reset-ip:${clientIp(request)}`, 20, 3600000);
  const passwordHash = await hashPassword(data.password);   // the 12-128 character policy applies before the token is spent
  const userId = await consumeToken(data.token, 'RESET');
  if (!userId) throw new HttpError(400, 'الرابط غير صالح أو منتهي؛ اطلب رابطاً جديداً');
  const user = await prisma.user.update({ where: { id: userId }, data: { passwordHash, emailVerifiedAt: new Date() }, select: { phone: true, email: true } });
  // Every signed-in device is signed out: whoever knew the old password (or held a stolen session) loses access.
  await prisma.authSession.deleteMany({ where: { userId } });
  await clearAccountLock([user.phone, user.email]);
  return { success: true };
});
