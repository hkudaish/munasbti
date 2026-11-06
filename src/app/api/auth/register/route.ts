import { prisma } from '@/lib/db';
import { api, body, text, HttpError } from '@/lib/server/http';
import { clientIp, createSession, hashPassword, profile, rateLimit } from '@/lib/server/auth';
import { onVendorRegistered } from '@/lib/server/vendor-approval';
import { verifyCaptcha } from '@/lib/server/captcha';
import { sendEmailVerification } from '@/lib/server/account-security';
export const POST = api(async request => {
  const data = await body(request, 12000);
  if (!['client', 'vendor'].includes(data.userType)) throw new HttpError(400, 'نوع الحساب غير صالح');
  const vendor = data.userType === 'vendor'; const input = vendor ? data.vendorData : data.customerData;
  if (!input) throw new HttpError(400, 'بيانات التسجيل مطلوبة');
  const phone = text(vendor ? input.contactPhone : input.phone, 20, true);
  if (!/^\+?\d{9,15}$/.test(phone)) throw new HttpError(400, 'رقم الجوال غير صالح');
  await rateLimit(`register:${phone}`, 5);
  await verifyCaptcha(data.captchaToken, clientIp(request));   // before the expensive password hash; passes when Turnstile is not configured
  await rateLimit(`register-ip:${clientIp(request)}`, 10, 3600000); // mass account creation: ten sign-ups an hour per address
  const passwordHash = await hashPassword(input.password);
  const email = text(input.email, 254).toLowerCase() || null;
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new HttpError(400, 'البريد الإلكتروني غير صالح');
  const cityId = text(input.cityId, 80, true);
  const user = await prisma.$transaction(async tx => {
    const user = await tx.user.create({ data: { name: text(vendor ? input.contactName || input.businessName : input.name, 120, true), phone, email, passwordHash, role: vendor ? 'VENDOR' : 'CLIENT', cityId } });
    const created = vendor ? await tx.vendor.create({ data: { userId: user.id, businessName: text(input.businessName, 160, true), businessNameEn: text(input.businessNameEn, 160), categoryId: text(input.categoryId, 80, true), cityId, neighborhood: text(input.neighborhood, 160), logo: '', bannerImage: '', bioAr: text(input.bioAr, 4000), cancellationPolicyAr: '', contactPhone: phone, whatsappNumber: text(input.whatsappNumber || phone, 20), status: 'UNDER_REVIEW', verified: false } }) : null;
    if (created) await onVendorRegistered(tx, created);
    return tx.user.findUniqueOrThrow({ where: { id: user.id }, include: { vendorProfile: true } });
  });
  await createSession(user.id);
  void sendEmailVerification(user);   // a confirmation link when an address was given; the account works meanwhile
  return { success: true, user: profile(user) };
});
