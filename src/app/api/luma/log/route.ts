import { api, body } from '@/lib/server/http';
import { clientIp } from '@/lib/server/auth';
import { logCustomerQuestion, customerPopularity } from '@/lib/server/luma-staff';
export const dynamic = 'force-dynamic';
export const GET = api(async () => ({ popular: await customerPopularity() }), { allowDisabledFeature: true });
export const POST = api(async request => logCustomerQuestion(clientIp(request), await body(request, 1000)), { allowDisabledFeature: true });
