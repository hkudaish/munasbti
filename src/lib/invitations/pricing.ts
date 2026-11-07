/** Price estimate for sending digital invitations: how many, which plan, and how many companions each guest may bring.
 *  The numbers live in `InvitationPricing`, which the system admin edits; DEFAULT_PRICING is what applies until they save their own. */

export type InvitationPlanId = 'free' | 'whatsapp' | 'whatsapp_qr' | 'qr_system';

export interface InvitationPlan {
  id: InvitationPlanId;
  nameAr: string;
  /** Short description of what the plan includes. */
  descAr: string;
  /** Price per invitation sent, in SAR. */
  perInvitation: number;
  /** One-off fee for the QR check-in and RSVP service (0 when the plan has none), in SAR. */
  checkInFee: number;
  /** Plans that deliver a QR code per guest, so companions are counted against the entry code. */
  qr: boolean;
  recommended?: boolean;
}

export interface InvitationPricing {
  minInvitations: number;
  maxInvitations: number;
  maxCompanions: number;
  /** Price added for each companion allowed per guest, per invitation, on the QR plans (the code admits several people). */
  companionPrice: number;
  plans: InvitationPlan[];
}

export const DEFAULT_PRICING: InvitationPricing = {
  minInvitations: 10, maxInvitations: 1000, maxCompanions: 10, companionPrice: 0.4,
  plans: [
    { id: 'free', nameAr: 'باقة مجانية', descAr: 'رابط دعوة تشاركه بنفسك، دون إرسال تلقائي', perInvitation: 0, checkInFee: 0, qr: false, recommended: false },
    { id: 'whatsapp', nameAr: 'واتساب فقط', descAr: 'إرسال الدعوة لكل ضيف عبر واتساب، دون رمز دخول', perInvitation: 0.6, checkInFee: 0, qr: false, recommended: false },
    { id: 'whatsapp_qr', nameAr: 'واتساب + رمز QR', descAr: 'إرسال عبر واتساب مع رمز QR فريد وتأكيد الحضور', perInvitation: 1, checkInFee: 60, qr: true, recommended: true },
    { id: 'qr_system', nameAr: 'نظام الدخول بالرمز', descAr: 'رمز QR وتأكيد حضور وماسح البوابة، لتوزيعك بنفسك أو طباعتك', perInvitation: 0.5, checkInFee: 90, qr: true, recommended: false },
  ],
};

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampInt = (n: unknown, min: number, max: number) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
};
const isMoney = (n: unknown): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 100000;

/** Checks admin input and returns clean pricing. Plan ids, the QR flag and the plan set are fixed; the admin edits names, descriptions, prices, limits and the recommended plan.
 *  Throws an Error with an Arabic message the screen shows as is. */
export function sanitizePricing(input: any): InvitationPricing {
  const fail = (msg: string): never => { throw new Error(msg); };
  if (!input || typeof input !== 'object') fail('بيانات الأسعار غير صالحة');
  const int = (v: unknown, min: number, max: number, label: string) => { if (!Number.isInteger(v) || (v as number) < min || (v as number) > max) fail(`${label}: أدخل رقماً صحيحاً بين ${min} و${max}`); return v as number; };
  const minInvitations = int(input.minInvitations, 1, 100000, 'الحد الأدنى للدعوات');
  const maxInvitations = int(input.maxInvitations, 1, 100000, 'الحد الأقصى للدعوات');
  if (minInvitations > maxInvitations) fail('الحد الأدنى للدعوات يجب ألا يزيد على الحد الأقصى');
  const maxCompanions = int(input.maxCompanions, 0, 50, 'الحد الأقصى للمرافقين');
  if (!isMoney(input.companionPrice)) fail('سعر المرافق غير صالح');
  if (!Array.isArray(input.plans) || input.plans.length !== DEFAULT_PRICING.plans.length) fail('يجب تحديد جميع الباقات');
  const plans = DEFAULT_PRICING.plans.map(base => {
    const given = input.plans.find((p: any) => p && p.id === base.id);
    if (!given) fail('باقة ناقصة: ' + base.nameAr);
    const nameAr = typeof given.nameAr === 'string' ? given.nameAr.trim() : '';
    const descAr = typeof given.descAr === 'string' ? given.descAr.trim() : '';
    if (!nameAr || nameAr.length > 60) fail('اسم الباقة مطلوب (حتى 60 حرفاً)');
    if (!descAr || descAr.length > 160) fail('وصف الباقة مطلوب (حتى 160 حرفاً)');
    if (!isMoney(given.perInvitation) || !isMoney(given.checkInFee)) fail('سعر غير صالح في باقة: ' + nameAr);
    return { id: base.id, nameAr, descAr, perInvitation: round2(given.perInvitation), checkInFee: round2(given.checkInFee), qr: base.qr, recommended: given.recommended === true };
  });
  if (plans.filter(p => p.recommended).length > 1) fail('يمكن تمييز باقة واحدة فقط بوصف «الأكثر طلباً»');
  return { minInvitations, maxInvitations, maxCompanions, companionPrice: round2(input.companionPrice as number), plans };
}

export interface InvitationQuote {
  plan: InvitationPlan;
  invitations: number;
  companions: number;
  baseTotal: number;
  companionTotal: number;
  checkInFee: number;
  total: number;
  /** Maximum people who can arrive: every invitation plus its companions. */
  maxAttendees: number;
}

export function quoteInvitations(planId: InvitationPlanId, invitations: number, companions: number, pricing: InvitationPricing = DEFAULT_PRICING): InvitationQuote {
  const plan = pricing.plans.find(p => p.id === planId) ?? pricing.plans[0];
  const count = clampInt(invitations, pricing.minInvitations, pricing.maxInvitations);
  const comp = clampInt(companions, 0, pricing.maxCompanions);
  const baseTotal = round2(count * plan.perInvitation);
  const companionTotal = plan.qr ? round2(count * comp * pricing.companionPrice) : 0;
  const checkInFee = plan.checkInFee;
  return { plan, invitations: count, companions: comp, baseTotal, companionTotal, checkInFee, total: round2(baseTotal + companionTotal + checkInFee), maxAttendees: count * (1 + comp) };
}
