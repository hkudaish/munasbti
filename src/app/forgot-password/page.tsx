'use client';
import { useCallback, useState } from 'react';
import Link from 'next/link';
import { requestJSON } from '@/lib/api-client';
import AuthCard, { authButton, authField } from '@/components/common/AuthCard';
import Turnstile, { captchaConfigured } from '@/components/common/Turnstile';

export default function ForgotPasswordPage() {
  const [identifier, setIdentifier] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(''), [error, setError] = useState('');
  const [captcha, setCaptcha] = useState(''), [round, setRound] = useState(0);
  const onCaptcha = useCallback((token: string) => setCaptcha(token), []);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setError('');
    try { const r = await requestJSON('/api/auth/forgot-password', 'POST', { identifier, captchaToken: captcha }); setDone(r.message); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذر إرسال الطلب'); setCaptcha(''); setRound(n => n + 1); }
    finally { setBusy(false); }
  };
  return (
    <AuthCard title="نسيت كلمة المرور؟">
      {done ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">{done}</p> : (
        <form onSubmit={submit} className="space-y-4">
          <p className="text-sm text-gray-700">اكتب رقم جوالك أو بريدك الإلكتروني؛ سنرسل رابط إعادة التعيين إلى البريد المسجل في حسابك.</p>
          <label className="block text-sm font-bold" htmlFor="fp-id">رقم الجوال أو البريد الإلكتروني</label>
          <input id="fp-id" required autoComplete="username" autoCapitalize="none" spellCheck={false} value={identifier} onChange={e => setIdentifier(e.target.value)} className={authField} />
          {captchaConfigured && <Turnstile key={round} onToken={onCaptcha} />}
          {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
          <button className={authButton} disabled={busy || !identifier.trim() || (captchaConfigured && !captcha)}>{busy ? 'جاري الإرسال...' : 'أرسل رابط إعادة التعيين'}</button>
          <p className="text-xs text-gray-600">إذا لم يكن في حسابك بريد إلكتروني، تواصل مع الدعم لإعادة التعيين.</p>
        </form>
      )}
      <p className="text-center text-sm"><Link href="/" className="font-bold text-saudi-green-800 underline">العودة للرئيسية</Link></p>
    </AuthCard>
  );
}
