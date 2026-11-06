import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError, text } from './http';
import { createSession, sessionMeta } from './auth';
import { totpEnabled } from './totp';
import { grantInitialRole, selfRegistrationRoles } from './rbac';
import { maskTarget, securityLog } from './security-log';
import { phoneVariants } from './otp';
import { sendMail } from './mailer';

export type Provider = 'GOOGLE' | 'APPLE' | 'EMAIL' | 'PHONE';
export interface VerifiedIdentity {
  provider: Provider;
  providerUserId: string;          // Google/Apple "sub", the lower-cased e-mail, or the +E.164 phone
  email?: string | null; emailVerified?: boolean;
  phone?: string | null;           // set only when the phone was proven with a code
  name?: string | null;
}
export type Outcome = { status: 'ok'; userId: string; created: boolean } | { status: 'needsProfile'; roles: Awaited<ReturnType<typeof selfRegistrationRoles>> };

const CONTACT_PROVIDERS: Provider[] = ['EMAIL', 'PHONE'];

/**
 * One person, several ways in. Given an identity whose owner has just proven control of it (a code, or a provider assertion), find the account it belongs to:
 *   1. the same provider id is already linked -> that account;
 *   2. otherwise a VERIFIED contact detail (phone proven now, or e-mail the provider vouches for) matches an existing account -> link to it;
 *   3. otherwise create a new account, if the visitor may self-register.
 * A name is never used to match anybody.
 *
 * Takeover guard: if the matching account's contact was never verified (older accounts, or one created with someone else's number), whoever proves the contact
 * now is its rightful owner. The account's password and sessions are cleared so the person who typed the contact first cannot keep access.
 */
export async function resolveIdentity(identity: VerifiedIdentity, options: { name?: string; roleKey?: string; ip?: string }): Promise<Outcome> {
  const { provider, providerUserId } = identity;
  const linked = await prisma.loginIdentity.findUnique({ where: { provider_providerUserId: { provider, providerUserId } } });
  let user = linked ? await prisma.user.findUnique({ where: { id: linked.userId } }) : null;
  let neutralised = false;

  if (!user) {
    const email = identity.emailVerified && identity.email ? identity.email.toLowerCase() : null;
    const phone = identity.phone ?? null;
    const byPhone = phone ? await prisma.user.findFirst({ where: { phone: { in: phoneVariants(phone) } } }) : null;
    const byEmail = !byPhone && email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } } }) : null;
    user = byPhone || byEmail;
    if (user) {
      const unverified = byPhone ? !user.phoneVerifiedAt : !user.emailVerifiedAt;
      if (unverified && user.passwordHash) {
        await prisma.$transaction([prisma.user.update({ where: { id: user.id }, data: { passwordHash: null } }), prisma.authSession.deleteMany({ where: { userId: user.id } })]);
        neutralised = true;
      }
    }
  }

  let created = false;
  if (!user) {
    const name = text(options.name || identity.name || '', 120);
    if (!name) return { status: 'needsProfile', roles: await selfRegistrationRoles() };
    const allowed = await selfRegistrationRoles();
    const roleKey = options.roleKey || 'client';
    if (!allowed.some(r => r.key === roleKey)) throw new HttpError(403, 'التسجيل الذاتي غير متاح لهذا النوع من الحسابات');
    const email = identity.emailVerified && identity.email ? identity.email.toLowerCase() : null;
    user = await prisma.$transaction(async tx => {
      const u = await tx.user.create({ data: {
        name, email, emailVerifiedAt: email ? new Date() : null, phone: identity.phone ?? null, phoneVerifiedAt: identity.phone ? new Date() : null,
        registeredVia: provider.toLowerCase(), role: 'CLIENT', passwordHash: null,
      } });
      await grantInitialRole(tx, u.id, roleKey);
      return tx.user.findUniqueOrThrow({ where: { id: u.id } });
    });
    created = true;
    await securityLog('account.created', { actor: user.id, target: user.id, ip: options.ip, details: { via: provider, role: roleKey } });
  }

  if (!user.isActive || user.approvalStatus === 'REJECTED') throw new HttpError(403, 'هذا الحساب معطل؛ تواصل مع الإدارة');

  // Record what was just proven on the account itself and link the identity.
  const patch: Record<string, unknown> = {};
  if (identity.phone && !user.phoneVerifiedAt && (!user.phone || phoneVariants(identity.phone).includes(user.phone))) { patch.phoneVerifiedAt = new Date(); if (!user.phone) patch.phone = identity.phone; }
  if (identity.emailVerified && identity.email && !user.emailVerifiedAt && user.email?.toLowerCase() === identity.email.toLowerCase()) patch.emailVerifiedAt = new Date();
  if (identity.emailVerified && identity.email && !user.email && !await prisma.user.findFirst({ where: { email: { equals: identity.email, mode: 'insensitive' } } })) { patch.email = identity.email.toLowerCase(); patch.emailVerifiedAt = new Date(); }
  if (Object.keys(patch).length) await prisma.user.update({ where: { id: user.id }, data: patch as any });
  const known = await prisma.loginIdentity.findUnique({ where: { provider_providerUserId: { provider, providerUserId } } });
  if (!known) {
    try { await prisma.loginIdentity.create({ data: { userId: user.id, provider, providerUserId, email: identity.email ?? null, verifiedAt: new Date(), lastUsedAt: new Date() } }); if (!created) await securityLog('identity.linked', { actor: user.id, target: user.id, ip: options.ip, details: { provider } }); }
    catch (e: any) { if (e?.code !== 'P2002') throw e; }   // a concurrent request linked it first
  } else await prisma.loginIdentity.update({ where: { id: known.id }, data: { lastUsedAt: new Date(), verifiedAt: known.verifiedAt ?? new Date() } });
  if (neutralised) await securityLog('identity.takeover_guard', { actor: user.id, target: user.id, ip: options.ip, details: { via: provider } });
  return { status: 'ok', userId: user.id, created };
}

/** Read-only twin of the lookup in resolveIdentity: which account would this identity sign in to (if any)? Used to ask for the second factor before a code is spent. */
export async function peekAccount(identity: VerifiedIdentity) {
  const linked = await prisma.loginIdentity.findUnique({ where: { provider_providerUserId: { provider: identity.provider, providerUserId: identity.providerUserId } }, select: { userId: true } });
  if (linked) return linked.userId;
  const email = identity.emailVerified && identity.email ? identity.email.toLowerCase() : null;
  const user = (identity.phone ? await prisma.user.findFirst({ where: { phone: { in: phoneVariants(identity.phone) } }, select: { id: true } }) : null)
    || (email ? await prisma.user.findFirst({ where: { email: { equals: email, mode: 'insensitive' } }, select: { id: true } }) : null);
  return user?.id ?? null;
}

/** Starts a session for a person who just proved an identity, and records the sign-in (and a notice when it comes from somewhere new). */
export async function completeSignIn(request: Request, userId: string, method: string) {
  const meta = sessionMeta(request, method);
  const user = await prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { vendorProfile: true } });
  const previous = await prisma.systemAuditLog.count({ where: { action: 'login.success', targetId: userId } });
  const seenHere = previous === 0 || await prisma.systemAuditLog.count({ where: { action: 'login.success', targetId: userId, details: { path: ['ip'], equals: meta.ip ?? '' } } }) > 0;
  await createSession(userId, meta);
  await securityLog('login.success', { actor: userId, target: userId, ip: meta.ip, details: { method } });
  if (!seenHere) {
    await securityLog('login.new_device', { actor: userId, target: userId, ip: meta.ip, details: { method } });
    if (user.email && user.emailVerifiedAt) void sendMail({ to: user.email, subject: 'تسجيل دخول جديد إلى حسابك - مناسبتـي', text: `تم تسجيل الدخول إلى حسابك من جهاز أو عنوان جديد (${maskTarget(meta.ip || '')}). إذا لم تكن أنت فغيّر كلمة المرور وأنهِ الجلسات الأخرى من إعدادات الحساب.` });
  }
  return user;
}

/** Accounts that enrolled an authenticator app cannot skip it by choosing another way in. */
export const needsSecondFactor = (userId: string) => totpEnabled(userId);
export { CONTACT_PROVIDERS };
