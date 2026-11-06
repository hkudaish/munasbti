import { api } from '@/lib/server/http';
import { clientIp, logout, sessionUser } from '@/lib/server/auth';
import { securityLog } from '@/lib/server/security-log';
export const POST = api(async request => { const user = await sessionUser(); await logout(); if (user) await securityLog('logout', { actor: user.id, target: user.id, ip: clientIp(request) }); return { success: true }; });
