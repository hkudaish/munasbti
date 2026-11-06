import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/server/auth';
import { availableMethods } from '@/lib/server/auth-settings';
import { finishOAuth } from '@/lib/server/oauth';
import { completeSignIn, peekAccount, resolveIdentity } from '@/lib/server/identity';
import { totpEnabled } from '@/lib/server/totp';
import { securityLog } from '@/lib/server/security-log';
import { HttpError } from '@/lib/server/http';
export const dynamic = 'force-dynamic';

// Not wrapped in api(): Apple posts here from appleid.apple.com, so the same-origin check (which is right for our own forms) does not apply.
// State, the browser-binding cookie and the nonce inside the ID token are what protect this endpoint.
const home = (query: string) => NextResponse.redirect(new URL(`/?${query}`, process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'), 303);

async function handle(request: Request, providerName: string, params: { state?: string | null; code?: string | null; userJson?: string | null; error?: string | null }) {
  const ip = clientIp(request);
  try {
    if (providerName !== 'google' && providerName !== 'apple') throw new HttpError(404, 'غير متاح');
    if (params.error) return home('auth_error=cancelled');
    await rateLimit(`oauth-callback:${ip}`, 60, 3600000);
    const methods = await availableMethods();
    if (!methods[providerName]) throw new HttpError(400, 'طريقة الدخول هذه غير متاحة');
    const { identity, roleKey } = await finishOAuth(providerName, params);
    // The authenticator-app prompt cannot happen in the middle of a redirect, so those accounts use password or code sign-in, which can ask for it.
    const existing = await peekAccount(identity);
    if (existing && await totpEnabled(existing)) { await securityLog('login.failed', { actor: existing, target: existing, ip, details: { method: providerName, reason: 'second_factor_required' } }); return home('auth_error=mfa'); }
    const outcome = await resolveIdentity(identity, { name: identity.name || identity.email?.split('@')[0] || '', roleKey, ip });
    if (outcome.status !== 'ok') return home('auth_error=profile');
    await completeSignIn(request, outcome.userId, providerName);
    return home(outcome.created ? 'welcome=1' : 'signed_in=1');
  } catch (e) {
    await securityLog('login.failed', { ip, details: { method: providerName, reason: e instanceof HttpError ? e.message.slice(0, 80) : 'error' } });
    return home('auth_error=' + (e instanceof HttpError && e.status === 403 ? 'disabled' : e instanceof HttpError && e.status === 429 ? 'rate' : 'failed'));
  }
}

export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params, q = new URL(request.url).searchParams;
  return handle(request, provider, { state: q.get('state'), code: q.get('code'), error: q.get('error') });
}
export async function POST(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  if (provider !== 'apple') return home('auth_error=failed');   // Google returns by GET only
  const form = await request.formData();
  const str = (k: string) => { const v = form.get(k); return typeof v === 'string' ? v : null; };
  return handle(request, provider, { state: str('state'), code: str('code'), userJson: str('user'), error: str('error') });
}
