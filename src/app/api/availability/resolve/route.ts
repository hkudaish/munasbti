import { api, HttpError } from '@/lib/server/http';
import { clientIp } from '@/lib/server/auth';
import { resolve } from '@/lib/availability/resolver';
import { prisma } from '@/lib/db';
import { loadSnapshot } from '@/lib/server/availability/loader';
import { publicDecision } from '@/lib/server/availability/enforce';
import { cappedScopes, chainOf, countByScope, offerFacts, toContext } from '@/lib/server/availability/facts';
import { serviceContext, serviceRows } from '@/lib/server/availability/matrix';

export const dynamic = 'force-dynamic';
// A soft per-address limit (per server instance) so the endpoint cannot be used to hammer the database.
const hits = new Map<string, { n: number; reset: number }>();
function limit(request: Request) {
  const key = clientIp(request);
  const now = Date.now(), entry = hits.get(key);
  if (!entry || entry.reset < now) { hits.set(key, { n: 1, reset: now + 60_000 }); if (hits.size > 5000) hits.clear(); return; }
  if (++entry.n > 120) throw new HttpError(429, 'طلبات كثيرة؛ حاول بعد قليل');
}
/** Public: the decision for one offer or service at the service/event location and date. Also what checkout screens call before enabling the button. */
export const GET = api(async request => {
  limit(request);
  const q = new URL(request.url).searchParams;
  const cityId = q.get('cityId') || null, date = q.get('date') || null, time = q.get('time') || null;
  if (date && !/^\d{4}-\d{2}-\d{2}$/.test(date)) throw new HttpError(400, 'تاريخ غير صالح');
  if (time && !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) throw new HttpError(400, 'وقت غير صالح');
  const quantity = Math.max(1, Math.min(10000, Number(q.get('quantity')) || 1));
  const intent = q.get('intent') === 'VIEW' ? 'VIEW' : 'BOOK';
  const snapshot = await loadSnapshot();
  if (cityId && !snapshot.geo.cities.some(c => c.id === cityId)) throw new HttpError(404, 'المدينة غير موجودة');
  const offerId = q.get('offerId'), serviceId = q.get('serviceId');
  if (offerId) {
    const facts = await offerFacts(prisma, offerId);
    if (!facts || !(await serviceRows()).some(sv => sv.id === facts.serviceId)) throw new HttpError(404, 'العرض غير موجود'); // unpublished services are not visible to the public
    const ctx = toContext(facts, { offeringId: offerId, cityId, date, time, quantity, intent });
    if (date) { const scopes = cappedScopes(snapshot, chainOf(facts)); if (scopes.length) ctx.usedByScope = await countByScope(prisma, scopes, date, facts, ctx); }
    return publicDecision(resolve(snapshot, ctx));
  }
  if (serviceId) {
    const service = (await serviceRows()).find(s => s.id === serviceId);
    if (!service) throw new HttpError(404, 'الخدمة غير موجودة');
    return publicDecision(resolve(snapshot, serviceContext(service, cityId, { bookingDate: date, bookingTime: time, quantity, intent })));
  }
  throw new HttpError(400, 'حدد العرض أو الخدمة');
}, { allowDisabledFeature: true });
