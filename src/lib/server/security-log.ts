import 'server-only';
import { prisma } from '@/lib/db';

/** Masks a phone number or e-mail so the log shows enough to recognise it but is not a list of contact details. */
export function maskTarget(value: string) {
  if (value.includes('@')) { const [name, domain] = value.split('@'); return `${name.slice(0, 2)}***@${domain}`; }
  return value.length > 6 ? `${value.slice(0, 4)}****${value.slice(-2)}` : '****';
}

/**
 * Security-relevant events go to the system audit table: who (actor, or "anonymous"), what, about whom, plus address and details.
 * Logging must never break a sign-in, so a write failure is swallowed (and reported on the server console without personal data).
 * Never pass a code, token, password or full contact detail in `details`.
 */
export async function securityLog(action: string, entry: { actor?: string | null; target?: string | null; ip?: string; details?: Record<string, unknown> }) {
  try {
    await prisma.systemAuditLog.create({ data: { actorId: entry.actor || 'anonymous', action, targetId: entry.target || entry.actor || 'none', details: { ...(entry.ip ? { ip: entry.ip } : {}), ...(entry.details || {}) } as any } });
  } catch { console.error('security log write failed:', action); }
}
