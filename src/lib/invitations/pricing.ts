/** Price estimate for sending digital invitations: how many, which plan, and how many companions each guest may bring.
 *  The prices below are TEMPORARY DEFAULTS for testing; they are not final business prices. */

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

export const MIN_INVITATIONS = 10;
export const MAX_INVITATIONS = 1000;
export const MAX_COMPANIONS = 10;
/** Price added for each companion allowed per guest, per invitation, on the QR plans (the code admits several people). */
export const COMPANION_PRICE = 0.4;

export const INVITATION_PLANS: InvitationPlan[] = [
  { id: 'free', nameAr: 'باقة مجانية', descAr: 'رابط دعوة تشاركه بنفسك، دون إرسال تلقائي', perInvitation: 0, checkInFee: 0, qr: false },
  { id: 'whatsapp', nameAr: 'واتساب فقط', descAr: 'إرسال الدعوة لكل ضيف عبر واتساب، دون رمز دخول', perInvitation: 0.6, checkInFee: 0, qr: false },
  { id: 'whatsapp_qr', nameAr: 'واتساب + رمز QR', descAr: 'إرسال عبر واتساب مع رمز QR فريد وتأكيد الحضور', perInvitation: 1, checkInFee: 60, qr: true, recommended: true },
  { id: 'qr_system', nameAr: 'نظام الدخول بالرمز', descAr: 'رمز QR وتأكيد حضور وماسح البوابة، لتوزيعك بنفسك أو طباعتك', perInvitation: 0.5, checkInFee: 90, qr: true },
];

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

const round2 = (n: number) => Math.round(n * 100) / 100;
const clampInt = (n: unknown, min: number, max: number) => {
  const v = Math.floor(Number(n));
  return Number.isFinite(v) ? Math.min(max, Math.max(min, v)) : min;
};

export function quoteInvitations(planId: InvitationPlanId, invitations: number, companions: number): InvitationQuote {
  const plan = INVITATION_PLANS.find(p => p.id === planId) ?? INVITATION_PLANS[0];
  const count = clampInt(invitations, MIN_INVITATIONS, MAX_INVITATIONS);
  const comp = clampInt(companions, 0, MAX_COMPANIONS);
  const baseTotal = round2(count * plan.perInvitation);
  const companionTotal = plan.qr ? round2(count * comp * COMPANION_PRICE) : 0;
  const checkInFee = plan.checkInFee;
  return { plan, invitations: count, companions: comp, baseTotal, companionTotal, checkInFee, total: round2(baseTotal + companionTotal + checkInFee), maxAttendees: count * (1 + comp) };
}
