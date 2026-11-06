import 'server-only';
import { createHash, randomBytes } from 'node:crypto';
import { cookies } from 'next/headers';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
import { digest } from './auth';
import { appleClientSecret, checkClaims, type Claims, type OAuthProvider } from './oauth-claims';

/**
 * Sign in with Google / Apple using the official OAuth 2.0 authorization-code flow (OpenID Connect).
 * - `state` (random, single use, stored hashed) and a browser-binding cookie stop login-CSRF and code injection;
 * - Google also gets PKCE; both get a `nonce` that must come back inside the ID token;
 * - the ID token is received straight from the provider's token endpoint over TLS (OIDC Core 3.1.3.7), and its issuer, audience, expiry and nonce are checked.
 * Needs GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET and APPLE_CLIENT_ID (Services ID) / APPLE_TEAM_ID / APPLE_KEY_ID / APPLE_PRIVATE_KEY; see docs/ACCESS_CONTROL.md.
 */
export type { OAuthProvider };
// Endpoint overrides exist for the automated tests only and are ignored in production.
const endpoint = (name: string, fallback: string) => (process.env.NODE_ENV !== 'production' && process.env[name]) || fallback;
const BIND_COOKIE = 'munasabati_oauth';
const appUrl = () => (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');
export const redirectUri = (provider: OAuthProvider) => `${appUrl()}/api/auth/oauth/${provider}/callback`;

/** Builds the provider URL and remembers the one-time state. Sets the binding cookie (SameSite=None in production, because Apple posts back from another site). */
export async function beginOAuth(provider: OAuthProvider, roleKey?: string) {
  const state = randomBytes(32).toString('base64url'), nonce = randomBytes(24).toString('base64url'), verifier = randomBytes(48).toString('base64url'), bind = randomBytes(32).toString('base64url');
  await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  await prisma.oAuthState.create({ data: { stateHash: digest(state), provider, nonce, verifier, bindHash: digest(bind), roleKey: roleKey || null, expiresAt: new Date(Date.now() + 10 * 60000) } });
  const prod = process.env.NODE_ENV === 'production';
  (await cookies()).set(BIND_COOKIE, bind, { httpOnly: true, secure: prod, sameSite: prod ? 'none' : 'lax', path: '/api/auth/oauth', maxAge: 600 });
  const params = new URLSearchParams(provider === 'google'
    ? { client_id: process.env.GOOGLE_CLIENT_ID!, redirect_uri: redirectUri('google'), response_type: 'code', scope: 'openid email profile', state, nonce, code_challenge: createHash('sha256').update(verifier).digest('base64url'), code_challenge_method: 'S256', prompt: 'select_account' }
    : { client_id: process.env.APPLE_CLIENT_ID!, redirect_uri: redirectUri('apple'), response_type: 'code', response_mode: 'form_post', scope: 'name email', state, nonce });
  return (provider === 'google' ? 'https://accounts.google.com/o/oauth2/v2/auth?' : 'https://appleid.apple.com/auth/authorize?') + params.toString();
}

/** Finishes the flow: validates state and binding, exchanges the code, validates the ID token, and returns the proven identity. */
export async function finishOAuth(provider: OAuthProvider, params: { state?: string | null; code?: string | null; userJson?: string | null }) {
  const bind = (await cookies()).get(BIND_COOKIE)?.value;
  (await cookies()).delete({ name: BIND_COOKIE, path: '/api/auth/oauth' });
  if (!params.state || !params.code || !bind) throw new HttpError(400, 'انتهت صلاحية محاولة الدخول؛ ابدأ من جديد');
  const stateHash = digest(params.state);
  const row = await prisma.oAuthState.findUnique({ where: { stateHash } });
  const spent = await prisma.oAuthState.deleteMany({ where: { stateHash } });   // single use, even when a later check fails
  if (!row || spent.count !== 1 || row.provider !== provider || row.expiresAt < new Date() || row.bindHash !== digest(bind)) throw new HttpError(400, 'انتهت صلاحية محاولة الدخول؛ ابدأ من جديد');
  const form = new URLSearchParams(provider === 'google'
    ? { code: params.code, client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!, redirect_uri: redirectUri('google'), grant_type: 'authorization_code', code_verifier: row.verifier }
    : { code: params.code, client_id: process.env.APPLE_CLIENT_ID!, client_secret: appleClientSecret({ teamId: process.env.APPLE_TEAM_ID!, keyId: process.env.APPLE_KEY_ID!, clientId: process.env.APPLE_CLIENT_ID!, privateKey: process.env.APPLE_PRIVATE_KEY! }), redirect_uri: redirectUri('apple'), grant_type: 'authorization_code' });
  let payload: any;
  try {
    const res = await fetch(provider === 'google' ? endpoint('GOOGLE_TOKEN_URL', 'https://oauth2.googleapis.com/token') : endpoint('APPLE_TOKEN_URL', 'https://appleid.apple.com/auth/token'), { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: form.toString(), signal: AbortSignal.timeout(15000), redirect: 'error' });
    if (!res.ok) throw new Error(String(res.status));
    payload = await res.json();
  } catch { throw new HttpError(502, 'تعذر إتمام الدخول مع المزود؛ حاول مرة أخرى'); }
  const idToken = typeof payload?.id_token === 'string' ? payload.id_token.split('.') : [];
  if (idToken.length !== 3) throw new HttpError(502, 'استجابة المزود غير صالحة');
  let claims: Claims;
  try { claims = JSON.parse(Buffer.from(idToken[1], 'base64url').toString('utf8')); } catch { throw new HttpError(502, 'استجابة المزود غير صالحة'); }
  const identity = checkClaims(provider, claims, row.nonce, provider === 'google' ? process.env.GOOGLE_CLIENT_ID : process.env.APPLE_CLIENT_ID);
  if (!identity) throw new HttpError(400, 'تعذر التحقق من هوية الحساب');
  if (provider === 'apple' && params.userJson) {   // Apple sends the name only the first time, as a form field next to the code
    try { const u = JSON.parse(params.userJson); const n = [u?.name?.firstName, u?.name?.lastName].filter(Boolean).join(' '); if (n) identity.name = n.slice(0, 120); } catch { /* optional */ }
  }
  return { identity, roleKey: row.roleKey || undefined };
}
