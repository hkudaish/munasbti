'use client';
import { useEffect, useRef } from 'react';

const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY || '';
export const captchaConfigured = !!SITE_KEY;

declare global { interface Window { turnstile?: { render: (el: HTMLElement, options: Record<string, unknown>) => string; remove: (id: string) => void }; } }

/** Cloudflare Turnstile challenge; renders nothing when no site key is configured. Remount it (change `key`) to get a fresh token after a failed attempt. */
export default function Turnstile({ onToken }: { onToken: (token: string) => void }) {
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!SITE_KEY || !box.current) return;
    let id: string | undefined, cancelled = false;
    const mount = () => { if (!cancelled && box.current && window.turnstile) id = window.turnstile.render(box.current, { sitekey: SITE_KEY, language: 'ar', callback: onToken, 'expired-callback': () => onToken(''), 'error-callback': () => onToken('') }); };
    if (window.turnstile) mount();
    else {
      let script = document.getElementById('turnstile-script') as HTMLScriptElement | null;
      if (!script) { script = document.createElement('script'); script.id = 'turnstile-script'; script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit'; script.async = true; document.head.appendChild(script); }
      script.addEventListener('load', mount);
    }
    return () => { cancelled = true; if (id && window.turnstile) window.turnstile.remove(id); };
  }, [onToken]);
  return SITE_KEY ? <div ref={box} className="flex justify-center" /> : null;
}
