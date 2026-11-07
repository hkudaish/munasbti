import { api, body } from '@/lib/server/http';
import { requireSystemAdmin } from '@/lib/server/auth';
import { readInvitationPricing, saveInvitationPricing } from '@/lib/server/invitation-pricing';

export const dynamic = 'force-dynamic';
/** The public calculator reads the current prices; only the system admin can change them. */
export const GET = api(async () => ({ pricing: await readInvitationPricing() }));
export const PUT = api(async request => { const user = await requireSystemAdmin(); return { pricing: await saveInvitationPricing(user.id, await body(request, 20000)) }; }, { allowDisabledFeature: true });
