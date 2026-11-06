import { api } from '@/lib/server/http';
import { availableMethods } from '@/lib/server/auth-settings';
import { selfRegistrationRoles } from '@/lib/server/rbac';
export const dynamic = 'force-dynamic';
/** Public: which sign-in methods the form should offer, and which account types a visitor may choose. Nothing secret, nothing per-user. */
export const GET = api(async () => ({ methods: await availableMethods(), roles: await selfRegistrationRoles() }));
