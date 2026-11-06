import 'server-only';
import nodemailer from 'nodemailer';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

/**
 * Outgoing e-mail over SMTP (Hostinger e-mail hosting, or any provider):
 *   SMTP_HOST, SMTP_PORT (465 = TLS, 587 = STARTTLS), SMTP_USER, SMTP_PASS, MAIL_FROM ("Munasbti <no-reply@your-domain>")
 * Outside production, MAIL_OUTBOX_DIR writes each message to a JSON file instead (used by the tests; never honoured in production).
 */
export const mailConfigured = () => !!(process.env.SMTP_HOST && process.env.MAIL_FROM) || (process.env.NODE_ENV !== 'production' && !!process.env.MAIL_OUTBOX_DIR);

let transport: ReturnType<typeof nodemailer.createTransport> | null = null;
export async function sendMail(message: { to: string; subject: string; text: string; html?: string }): Promise<boolean> {
  try {
    if (process.env.NODE_ENV !== 'production' && process.env.MAIL_OUTBOX_DIR) {
      await mkdir(process.env.MAIL_OUTBOX_DIR, { recursive: true });
      await writeFile(path.join(process.env.MAIL_OUTBOX_DIR, `${Date.now()}-${Math.random().toString(36).slice(2)}.json`), JSON.stringify(message));
      return true;
    }
    if (!process.env.SMTP_HOST || !process.env.MAIL_FROM) return false;
    const port = Number(process.env.SMTP_PORT || 465);
    transport ??= nodemailer.createTransport({
      host: process.env.SMTP_HOST, port, secure: port === 465,
      auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS || '' } : undefined,
      connectionTimeout: 10000, socketTimeout: 15000, pool: true, maxConnections: 3,
    });
    await transport.sendMail({ from: process.env.MAIL_FROM, ...message });
    return true;
  } catch (error) {
    console.error('mail delivery failed:', error instanceof Error ? error.message : 'unknown');   // the address and the link are never logged
    return false;
  }
}
