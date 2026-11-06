import 'server-only';
import { HttpError } from './http';

/**
 * Cloudflare Turnstile (free, privacy-friendly challenge). Active only when TURNSTILE_SECRET_KEY is set; without it every check passes, so
 * development and tests need nothing. When it is active the check fails CLOSED: if Cloudflare cannot be reached the request is refused.
 * The widget's public key is NEXT_PUBLIC_TURNSTILE_SITE_KEY (read when the app is built).
 */
export const captchaEnabled = () => !!process.env.TURNSTILE_SECRET_KEY;

export async function verifyCaptcha(token: unknown, ip: string) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) return;
  if (typeof token !== 'string' || !token || token.length > 2048) throw new HttpError(400, 'أكمل التحقق الأمني ثم أعد المحاولة', { captchaRequired: true });
  let ok = false;
  try {
    const form = new URLSearchParams({ secret, response: token }); if (ip && ip !== 'local') form.set('remoteip', ip);
    const response = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: form, signal: AbortSignal.timeout(5000) });
    ok = response.ok && (await response.json()).success === true;
  } catch { throw new HttpError(503, 'تعذر إجراء التحقق الأمني الآن؛ أعد المحاولة بعد قليل'); }
  if (!ok) throw new HttpError(400, 'فشل التحقق الأمني؛ أعد المحاولة', { captchaRequired: true });
}
