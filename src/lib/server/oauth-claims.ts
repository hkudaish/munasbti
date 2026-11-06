import { createPrivateKey, sign as cryptoSign } from 'node:crypto';
import type { VerifiedIdentity } from './identity';

// Pure helpers for Google / Apple sign-in (no database, no framework), so they can be tested on their own.
export type OAuthProvider = 'google' | 'apple';
export interface Claims { iss: string; aud: string | string[]; sub: string; exp: number; nonce?: string; email?: string; email_verified?: boolean | string; name?: string }
const b64u = (buf: Buffer | string) => Buffer.from(buf).toString('base64url');

/** Checks issuer, audience, expiry and nonce of an ID token received directly from the provider's token endpoint. Returns the proven identity, or null when any check fails. */
export function checkClaims(provider: OAuthProvider, claims: Claims, expectedNonce: string, audience: string | undefined, now = Date.now()): VerifiedIdentity | null {
  const issuers = provider === 'google' ? ['https://accounts.google.com', 'accounts.google.com'] : ['https://appleid.apple.com'];
  const aud = Array.isArray(claims.aud) ? claims.aud : [claims.aud];
  if (!issuers.includes(claims.iss) || !audience || !aud.includes(audience) || typeof claims.sub !== 'string' || !claims.sub || typeof claims.exp !== 'number' || claims.exp * 1000 < now - 30000 || !expectedNonce || claims.nonce !== expectedNonce) return null;
  const verified = claims.email_verified === true || claims.email_verified === 'true';   // Apple sends the string "true"
  return { provider: provider === 'google' ? 'GOOGLE' : 'APPLE', providerUserId: claims.sub, email: claims.email ? claims.email.toLowerCase() : null, emailVerified: !!claims.email && verified, name: claims.name || null };
}

/** Apple's "client secret" is a short-lived ES256 JWT signed with the key downloaded from the developer account. */
export function appleClientSecret(env: { teamId: string; keyId: string; clientId: string; privateKey: string }, now = Math.floor(Date.now() / 1000)) {
  const head = b64u(JSON.stringify({ alg: 'ES256', kid: env.keyId, typ: 'JWT' }));
  const body = b64u(JSON.stringify({ iss: env.teamId, iat: now, exp: now + 600, aud: 'https://appleid.apple.com', sub: env.clientId }));
  const key = createPrivateKey(env.privateKey.replace(/\n/g, '\n'));
  return `${head}.${body}.${b64u(cryptoSign('sha256', Buffer.from(`${head}.${body}`), { key, dsaEncoding: 'ieee-p1363' }))}`;
}
