import { api, body } from '@/lib/server/http';
import { rateLimit, clientIp } from '@/lib/server/auth';
import { atomic } from '@/lib/server/booking/repository';
import { parseLines, parsePromoCodes, publicQuote, quoteLines } from '@/lib/server/commerce-v2/cart';
import { sessionUser } from '@/lib/server/auth';
export const dynamic = 'force-dynamic';
/** A price for a configuration, computed by the server's pricing engine. Nothing is saved; anyone may ask (browsing is open), within a rate limit. */
export const POST = api(async request => {
  await rateLimit('pricing-quote:' + clientIp(request), 120, 60000);
  const input = await body(request, 20000);
  const { promoCodes, ...config } = input, codes = promoCodes === undefined ? [] : parsePromoCodes(promoCodes), user = await sessionUser().catch(() => null);
  const [line] = parseLines([{ id: 'quote', ...config }]);
  return atomic(async tx => ({ quote: publicQuote(await quoteLines(tx, [line], { userId: user?.id ?? null, promoCodes: codes })) }));
}, { allowDisabledFeature: true });
