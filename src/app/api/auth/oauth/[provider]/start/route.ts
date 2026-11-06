import { NextResponse } from 'next/server';
import { clientIp, rateLimit } from '@/lib/server/auth';
import { availableMethods } from '@/lib/server/auth-settings';
import { beginOAuth } from '@/lib/server/oauth';
import { HttpError } from '@/lib/server/http';
export const dynamic = 'force-dynamic';
const home = (query: string) => NextResponse.redirect(new URL(`/?${query}`, (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000')), 303);
/** Starts "Sign in with Google / Apple": a redirect to the provider with one-time state. `?role=` carries the account type a new visitor chose. */
export async function GET(request: Request, context: { params: Promise<{ provider: string }> }) {
  const { provider } = await context.params;
  try {
    if (provider !== 'google' && provider !== 'apple') throw new HttpError(404, 'غير متاح');
    await rateLimit(`oauth-start:${clientIp(request)}`, 30, 3600000);
    const methods = await availableMethods();
    if (!methods[provider]) throw new HttpError(400, 'طريقة الدخول هذه غير متاحة');
    const role = new URL(request.url).searchParams.get('role') || undefined;
    return NextResponse.redirect(await beginOAuth(provider, role && /^[a-z0-9_]{1,40}$/.test(role) ? role : undefined), 303);
  } catch (e) {
    return home('auth_error=' + (e instanceof HttpError && e.status === 429 ? 'rate' : 'unavailable'));
  }
}
