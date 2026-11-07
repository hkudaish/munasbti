import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
import { DEFAULT_PRICING, sanitizePricing, type InvitationPricing } from '@/lib/invitations/pricing';

/** Stored as one JSON row in the shared key/value settings table, so no schema change is needed. */
const KEY = 'invitation_pricing';

export async function readInvitationPricing(): Promise<InvitationPricing> {
  // The public calculator must keep working when the setting is missing, malformed or the database is briefly unreachable.
  try {
    const row = await prisma.authSetting.findUnique({ where: { key: KEY } });
    return row?.value ? sanitizePricing(row.value) : DEFAULT_PRICING;
  } catch { return DEFAULT_PRICING; }
}

export async function saveInvitationPricing(actorId: string, input: unknown): Promise<InvitationPricing> {
  let next: InvitationPricing;
  try { next = sanitizePricing(input); } catch (e) { throw new HttpError(400, e instanceof Error ? e.message : 'بيانات الأسعار غير صالحة'); }
  const previous = await readInvitationPricing();
  await prisma.authSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: next as any }, update: { value: next as any } });
  await prisma.systemAuditLog.create({ data: { actorId, action: 'INVITATION_PRICING_SAVED', targetId: KEY, details: { previous, next } as any } });
  return next;
}
