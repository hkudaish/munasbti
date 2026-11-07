'use client';

import React, { useCallback, useEffect, useState } from 'react';
import Turnstile, { captchaConfigured } from '@/components/common/Turnstile';
import { requestJSON } from '@/lib/api-client';
import { useT } from '@/components/i18n/LocaleProvider';

type Channel = 'sms' | 'whatsapp' | 'email';
export interface SignInMethods { password: boolean; google: boolean; apple: boolean; channels: Channel[]; defaultChannel: Channel | null }
interface RoleOption { key: string; nameAr: string; nameEn: string; requiresApproval: boolean }

/** Which sign-in methods the administrator switched on (and the server is configured for). `null` while loading or when the request failed. */
export function useSignInMethods() {
  const [state, setState] = useState<{ methods: SignInMethods; roles: RoleOption[] } | null>(null);
  useEffect(() => { let alive = true; requestJSON('/api/auth/methods').then(d => { if (alive) setState(d); }).catch(() => { /* the password form stays available */ }); return () => { alive = false; }; }, []);
  return state;
}

const inputClass = 'w-full text-base px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800';
const buttonClass = 'w-full py-3 px-4 rounded-xl border border-gray-300 bg-white hover:bg-gray-50 font-bold text-sm text-gray-900 transition';

/** Google / Apple buttons and the "phone or e-mail + code" flow. After a successful sign-in the page reloads, so every part of the app starts from the new session. */
export default function AlternativeSignIn({ methods, roles, onError, heading }: { methods: SignInMethods; roles: RoleOption[]; onError: (message: string) => void; heading?: string }) {
  const tr = useT();
  const [channel, setChannel] = useState<Channel>(methods.defaultChannel || methods.channels[0] || 'sms');
  const [phase, setPhase] = useState<'idle' | 'code' | 'profile' | 'totp'>('idle');
  const [target, setTarget] = useState(''), [code, setCode] = useState(''), [name, setName] = useState(''), [roleKey, setRoleKey] = useState('client'), [totp, setTotp] = useState('');
  const [busy, setBusy] = useState(false), [cooldown, setCooldown] = useState(0), [captchaToken, setCaptchaToken] = useState(''), [captchaRound, setCaptchaRound] = useState(0);
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);
  useEffect(() => { if (cooldown <= 0) return; const t = setTimeout(() => setCooldown(c => c - 1), 1000); return () => clearTimeout(t); }, [cooldown]);

  const label = (c: Channel) => c === 'sms' ? tr('رسالة SMS') : c === 'whatsapp' ? tr('واتساب') : tr('البريد الإلكتروني');
  const oauthHref = (provider: 'google' | 'apple') => `/api/auth/oauth/${provider}/start?role=${encodeURIComponent(roleKey)}`;

  async function send() {
    onError(''); setBusy(true);
    try {
      const res = await requestJSON('/api/auth/otp/request', 'POST', { channel, target, captchaToken });
      setPhase('code'); setCode(''); setCooldown(res.resendAfter || 60);
    } catch (e: any) { onError(e.message); if (e.data?.retryAfter) setCooldown(e.data.retryAfter); }
    finally { setBusy(false); setCaptchaToken(''); setCaptchaRound(n => n + 1); }
  }
  async function verify(e: React.FormEvent) {
    e.preventDefault(); onError(''); setBusy(true);
    try {
      const res = await requestJSON('/api/auth/otp/verify', 'POST', { channel, target, code, name: phase === 'profile' ? name : undefined, roleKey: phase === 'profile' ? roleKey : undefined, totp: phase === 'totp' ? totp : undefined });
      if (res.mfaRequired) { setPhase('totp'); return; }
      if (res.needsProfile) { setPhase('profile'); return; }
      window.location.assign('/');
    } catch (err: any) { onError(err.message); }
    finally { setBusy(false); }
  }

  const otp = methods.channels.length > 0;
  if (!otp && !methods.google && !methods.apple) return null;
  return <div className="space-y-3 border-t border-gray-200 pt-4">
    <p className="text-center text-xs font-bold text-gray-500">{heading || tr('أو سجّل الدخول بطريقة أخرى')}</p>
    {(methods.google || methods.apple) && <div className="grid gap-2 sm:grid-cols-2">
      {methods.google && <a href={oauthHref('google')} className={buttonClass + ' text-center'}>{tr('المتابعة باستخدام Google')}</a>}
      {methods.apple && <a href={oauthHref('apple')} className={buttonClass + ' text-center'}>{tr('المتابعة باستخدام Apple')}</a>}
    </div>}
    {otp && <form onSubmit={phase === 'idle' ? (e => { e.preventDefault(); void send(); }) : verify} className="space-y-3">
      {methods.channels.length > 1 && phase === 'idle' && <div role="radiogroup" aria-label={tr('وسيلة استلام الرمز')} className="flex flex-wrap gap-2">{methods.channels.map(c => <button key={c} type="button" role="radio" aria-checked={channel === c} onClick={() => { setChannel(c); setTarget(''); }} className={`rounded-xl px-3 py-2 text-sm font-bold border ${channel === c ? 'bg-saudi-green-800 text-white border-saudi-green-800' : 'bg-white text-gray-800 border-gray-300'}`}>{label(c)}</button>)}</div>}
      {phase === 'idle' && <>
        <label className="block text-sm font-bold text-gray-800" htmlFor="otp-target">{channel === 'email' ? tr('البريد الإلكتروني') : tr('رقم الجوال')}</label>
        <input id="otp-target" required dir="ltr" type={channel === 'email' ? 'email' : 'tel'} autoComplete={channel === 'email' ? 'email' : 'tel'} value={target} onChange={e => setTarget(e.target.value)} placeholder={channel === 'email' ? 'name@example.com' : '05XXXXXXXX'} className={inputClass} />
        {captchaConfigured && <Turnstile key={captchaRound} onToken={onCaptcha} />}
        <button disabled={busy || cooldown > 0 || (captchaConfigured && !captchaToken)} className={buttonClass}>{busy ? tr('جاري الإرسال...') : cooldown > 0 ? `${tr('أعد المحاولة بعد')} ${cooldown}` : tr('إرسال رمز التحقق')}</button>
      </>}
      {phase !== 'idle' && <>
        <p className="text-sm text-gray-700">{tr('أرسلنا رمزاً من 6 أرقام إلى')} <bdi dir="ltr">{target}</bdi></p>
        {phase === 'profile' && <>
          <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-3 text-sm">{tr('لا يوجد حساب بهذه البيانات؛ أكمل بياناتك لإنشاء حساب جديد.')}</p>
          <label className="block text-sm font-bold" htmlFor="otp-name">{tr('الاسم')}</label>
          <input id="otp-name" required maxLength={120} autoComplete="name" value={name} onChange={e => setName(e.target.value)} className={inputClass} />
          {roles.length > 1 && <><label className="block text-sm font-bold" htmlFor="otp-role">{tr('نوع الحساب')}</label>
            <select id="otp-role" value={roleKey} onChange={e => setRoleKey(e.target.value)} className={inputClass}>{roles.map(r => <option key={r.key} value={r.key}>{r.nameAr}{r.requiresApproval ? ' — ' + tr('يحتاج اعتماد الإدارة') : ''}</option>)}</select></>}
        </>}
        {phase === 'totp' && <><label className="block text-sm font-bold" htmlFor="otp-totp">{tr('رمز التحقق من تطبيق المصادقة')}</label>
          <input id="otp-totp" autoFocus required inputMode="numeric" autoComplete="one-time-code" maxLength={16} value={totp} onChange={e => setTotp(e.target.value)} className={inputClass + ' tracking-widest'} /></>}
        {phase === 'code' && <><label className="block text-sm font-bold" htmlFor="otp-code">{tr('رمز التحقق')}</label>
          <input id="otp-code" autoFocus required dir="ltr" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6} value={code} onChange={e => setCode(e.target.value.replace(/\D/g, ''))} placeholder="123456" className={inputClass + ' tracking-widest'} /></>}
        <button disabled={busy} className="w-full py-3 px-4 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 disabled:bg-gray-300 text-white font-bold text-sm">{busy ? tr('جاري التحقق...') : phase === 'profile' ? tr('إنشاء الحساب') : tr('تأكيد ودخول')}</button>
        <div className="flex justify-between text-xs">
          <button type="button" className="underline" onClick={() => { setPhase('idle'); setCode(''); onError(''); }}>{tr('تغيير الرقم أو الوسيلة')}</button>
          {phase === 'code' && <button type="button" className="underline disabled:opacity-50 disabled:no-underline" disabled={cooldown > 0 || busy} onClick={() => { setPhase('idle'); }}>{cooldown > 0 ? `${tr('إعادة الإرسال بعد')} ${cooldown}` : tr('إعادة إرسال الرمز')}</button>}
        </div>
      </>}
    </form>}
  </div>;
}
