import 'server-only';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { HttpError } from '../http';
import { mailConfigured, sendMail } from '../mailer';
import { internationalPhone } from '../channels';

/**
 * Notification Provider Adapter: sign-in code delivery goes through a small interface, one registry per channel.
 * Changing the provider is a setting (system admin > sign-in settings); adding one is a new entry in a registry below, with no change to the sign-in code.
 * Secrets come from the server environment, never from the database.
 */
export type Channel = 'sms' | 'whatsapp' | 'email';
export interface OtpMessage { to: string; code: string; minutes: number }
interface Provider { id: string; label: string; env: string[]; configured(): boolean; send(message: OtpMessage): Promise<void> }

const text = (m: OtpMessage) => `رمز التحقق في مناسبتـي: ${m.code}\nصالح لمدة ${m.minutes} دقائق. لا تشاركه مع أحد.`;
const outbox = () => process.env.NODE_ENV !== 'production' && process.env.OTP_OUTBOX_DIR ? process.env.OTP_OUTBOX_DIR : '';
async function post(url: string, init: RequestInit) {
  let res: Response;
  try { res = await fetch(url, { ...init, signal: AbortSignal.timeout(15000), redirect: 'error' }); } catch { throw new HttpError(503, 'تعذر إرسال الرمز الآن؛ حاول بعد قليل'); }
  if (!res.ok) { console.error('otp provider rejected the request:', res.status); throw new HttpError(503, 'تعذر إرسال الرمز الآن؛ حاول بعد قليل'); }
}

/** Development outbox: a JSON file per message. Honoured outside production only, so a forgotten variable can never leak codes on a live site. */
const dev = (id: string, label: string): Provider => ({
  id: 'dev', label: label + ' (اختبار محلي)', env: ['OTP_OUTBOX_DIR'], configured: () => !!outbox(),
  async send(m) { await mkdir(outbox(), { recursive: true }); await writeFile(path.join(outbox(), `${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify({ channel: id, to: m.to, code: m.code })); },
});

const REGISTRY: Record<Channel, Provider[]> = {
  sms: [
    { id: 'twilio', label: 'Twilio', env: ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'SMS_FROM'], configured: () => !!(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.SMS_FROM),
      async send(m) {
        const sid = process.env.TWILIO_ACCOUNT_SID!;
        await post(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`, { method: 'POST', headers: { Authorization: 'Basic ' + Buffer.from(`${sid}:${process.env.TWILIO_AUTH_TOKEN}`).toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ To: internationalPhone(m.to), From: process.env.SMS_FROM!, Body: text(m) }).toString() });
      } },
    dev('sms', 'رسائل SMS'),
  ],
  whatsapp: [
    // Meta WhatsApp Cloud API with an approved AUTHENTICATION template: one body parameter (the code) and the copy-code button.
    { id: 'meta', label: 'WhatsApp Cloud API (Meta)', env: ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'WHATSAPP_OTP_TEMPLATE'], configured: () => !!(process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID && process.env.WHATSAPP_OTP_TEMPLATE),
      async send(m) {
        await post(`https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v21.0'}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, { method: 'POST', headers: { Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ messaging_product: 'whatsapp', to: internationalPhone(m.to).slice(1), type: 'template', template: { name: process.env.WHATSAPP_OTP_TEMPLATE, language: { code: process.env.WHATSAPP_OTP_LANGUAGE || 'ar' }, components: [{ type: 'body', parameters: [{ type: 'text', text: m.code }] }, { type: 'button', sub_type: 'url', index: '0', parameters: [{ type: 'text', text: m.code }] }] } }) });
      } },
    dev('whatsapp', 'واتساب'),
  ],
  email: [
    { id: 'smtp', label: 'SMTP', env: ['SMTP_HOST', 'MAIL_FROM'], configured: () => !!(process.env.SMTP_HOST && process.env.MAIL_FROM) || mailConfigured(),
      async send(m) { if (!await sendMail({ to: m.to, subject: `رمز التحقق ${m.code} - مناسبتـي`, text: text(m), html: `<div dir="rtl" style="font-family:Tahoma,Arial,sans-serif;max-width:420px;margin:auto;padding:24px"><h2 style="color:#14532d">رمز التحقق</h2><p style="font-size:32px;letter-spacing:6px;font-weight:bold">${m.code}</p><p>صالح لمدة ${m.minutes} دقائق. لا تشاركه مع أحد.</p></div>` })) throw new HttpError(503, 'تعذر إرسال الرمز الآن؛ حاول بعد قليل'); } },
  ],
};

export function providerStatus(channel: Channel, id: string) {
  const p = REGISTRY[channel].find(x => x.id === id);
  return { known: !!p, configured: !!p && p.configured() };
}
/** For the admin screen: every provider per channel, whether the server is configured for it, and which variables it needs. */
export function providerCatalog() {
  return Object.fromEntries((Object.keys(REGISTRY) as Channel[]).map(c => [c, REGISTRY[c].map(p => ({ id: p.id, label: p.label, configured: p.configured(), env: p.env }))]));
}
export async function sendOtp(channel: Channel, providerId: string, message: OtpMessage) {
  const p = REGISTRY[channel].find(x => x.id === providerId);
  if (!p || !p.configured()) throw new HttpError(503, 'قناة التحقق غير متاحة حالياً');
  await p.send(message);
}
