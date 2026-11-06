import 'server-only';
import { prisma } from '@/lib/db';
import { HttpError } from './http';
import { providerStatus, type Channel } from './notify';

/** Which sign-in methods are switched on, and which provider carries each verification channel. Stored as one row, edited from the system admin screen. */
export interface AuthSettings {
  passwordLogin: boolean; googleLogin: boolean; appleLogin: boolean;
  smsOtp: boolean; whatsappOtp: boolean; emailOtp: boolean;
  defaultChannel: Channel;
  providers: Record<Channel, string>;
}
export const DEFAULT_AUTH_SETTINGS: AuthSettings = {
  passwordLogin: true, googleLogin: false, appleLogin: false, smsOtp: false, whatsappOtp: false, emailOtp: false,
  defaultChannel: 'sms', providers: { sms: 'twilio', whatsapp: 'meta', email: 'smtp' },
};
const KEY = 'auth';

export async function authSettings(): Promise<AuthSettings> {
  const row = await prisma.authSetting.findUnique({ where: { key: KEY } });
  const stored = (row?.value && typeof row.value === 'object' ? row.value : {}) as Partial<AuthSettings>;
  return { ...DEFAULT_AUTH_SETTINGS, ...stored, providers: { ...DEFAULT_AUTH_SETTINGS.providers, ...(stored.providers || {}) } };
}

export function oauthConfigured(provider: 'google' | 'apple') {
  return provider === 'google'
    ? !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET)
    : !!(process.env.APPLE_CLIENT_ID && process.env.APPLE_TEAM_ID && process.env.APPLE_KEY_ID && process.env.APPLE_PRIVATE_KEY);
}

/** The methods a visitor can actually use: switched on AND configured on the server. A switched-on method that is not configured stays hidden instead of failing at the form. */
export async function availableMethods() {
  const s = await authSettings();
  const channelOn = (c: Channel) => (c === 'sms' ? s.smsOtp : c === 'whatsapp' ? s.whatsappOtp : s.emailOtp) && providerStatus(c, s.providers[c]).configured;
  const channels = (['sms', 'whatsapp', 'email'] as Channel[]).filter(channelOn);
  return {
    password: s.passwordLogin,
    google: s.googleLogin && oauthConfigured('google'),
    apple: s.appleLogin && oauthConfigured('apple'),
    channels,
    defaultChannel: channels.includes(s.defaultChannel) ? s.defaultChannel : channels[0] ?? null,
  };
}

const bool = (v: unknown, name: string) => { if (typeof v !== 'boolean') throw new HttpError(400, `القيمة غير صالحة: ${name}`); return v; };
/** Validates an edit. Refuses a combination that would leave nobody able to sign in. */
export async function parseAuthSettings(input: Record<string, any>): Promise<AuthSettings> {
  const next: AuthSettings = {
    passwordLogin: bool(input.passwordLogin, 'passwordLogin'), googleLogin: bool(input.googleLogin, 'googleLogin'), appleLogin: bool(input.appleLogin, 'appleLogin'),
    smsOtp: bool(input.smsOtp, 'smsOtp'), whatsappOtp: bool(input.whatsappOtp, 'whatsappOtp'), emailOtp: bool(input.emailOtp, 'emailOtp'),
    defaultChannel: ['sms', 'whatsapp', 'email'].includes(input.defaultChannel) ? input.defaultChannel : (() => { throw new HttpError(400, 'قناة التحقق الافتراضية غير صالحة'); })(),
    providers: { ...DEFAULT_AUTH_SETTINGS.providers },
  };
  for (const c of ['sms', 'whatsapp', 'email'] as Channel[]) {
    const id = input.providers?.[c] ?? DEFAULT_AUTH_SETTINGS.providers[c];
    if (!providerStatus(c, id).known) throw new HttpError(400, 'مزود الخدمة غير معروف');
    next.providers[c] = id;
  }
  const usable = next.passwordLogin
    || (next.googleLogin && oauthConfigured('google')) || (next.appleLogin && oauthConfigured('apple'))
    || (next.smsOtp && providerStatus('sms', next.providers.sms).configured) || (next.whatsappOtp && providerStatus('whatsapp', next.providers.whatsapp).configured)
    || (next.emailOtp && providerStatus('email', next.providers.email).configured);
  if (!usable) throw new HttpError(409, 'يجب أن تبقى وسيلة دخول واحدة على الأقل مفعّلة ومهيأة على الخادم');
  return next;
}
export async function saveAuthSettings(settings: AuthSettings) {
  await prisma.authSetting.upsert({ where: { key: KEY }, create: { key: KEY, value: settings as any }, update: { value: settings as any } });
}
