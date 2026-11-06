'use client';
import { Suspense, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { requestJSON } from '@/lib/api-client';
import AuthCard, { authButton, authField } from '@/components/common/AuthCard';

function Form() {
  const token = useSearchParams().get('token') || '';
  const [password, setPassword] = useState(''), [again, setAgain] = useState(''), [busy, setBusy] = useState(false), [done, setDone] = useState(false), [error, setError] = useState('');
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (password !== again) { setError('كلمتا المرور غير متطابقتين'); return; }
    setBusy(true);
    try { await requestJSON('/api/auth/reset-password', 'POST', { token, password }); setDone(true); }
    catch (err) { setError(err instanceof Error ? err.message : 'تعذر تغيير كلمة المرور'); }
    finally { setBusy(false); }
  };
  if (!token) return <AuthCard title="رابط غير صالح"><p className="text-sm">الرابط ناقص. <Link href="/forgot-password" className="font-bold text-saudi-green-800 underline">اطلب رابطاً جديداً</Link></p></AuthCard>;
  return (
    <AuthCard title="كلمة مرور جديدة">
      {done ? <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">تم تغيير كلمة المرور وتسجيل الخروج من جميع الأجهزة. سجّل الدخول بكلمتك الجديدة من <Link href="/" className="font-bold underline">الصفحة الرئيسية</Link>.</p> : (
        <form onSubmit={submit} className="space-y-4">
          <label className="block text-sm font-bold" htmlFor="rp-1">كلمة المرور الجديدة (12 حرفاً على الأقل)</label>
          <input id="rp-1" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={password} onChange={e => setPassword(e.target.value)} className={authField} />
          <label className="block text-sm font-bold" htmlFor="rp-2">أعد كتابة كلمة المرور</label>
          <input id="rp-2" type="password" required minLength={12} maxLength={128} autoComplete="new-password" value={again} onChange={e => setAgain(e.target.value)} className={authField} />
          {error && <p role="alert" className="text-sm font-bold text-red-700">{error}</p>}
          <button className={authButton} disabled={busy}>{busy ? 'جاري الحفظ...' : 'حفظ كلمة المرور'}</button>
        </form>
      )}
    </AuthCard>
  );
}
export default function ResetPasswordPage() { return <Suspense><Form /></Suspense>; }
