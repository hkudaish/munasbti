'use client';
import { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { requestJSON } from '@/lib/api-client';
import AuthCard from '@/components/common/AuthCard';

function Verify() {
  const token = useSearchParams().get('token') || '';
  const [state, setState] = useState<'working' | 'ok' | 'bad'>('working'), [message, setMessage] = useState('');
  useEffect(() => {
    if (!token) { setState('bad'); setMessage('الرابط ناقص'); return; }
    requestJSON('/api/auth/verify-email', 'POST', { token }).then(() => setState('ok')).catch(e => { setState('bad'); setMessage(e instanceof Error ? e.message : 'تعذر التأكيد'); });
  }, [token]);
  return (
    <AuthCard title="تأكيد البريد الإلكتروني">
      {state === 'working' && <p role="status" className="text-sm">جاري التأكيد...</p>}
      {state === 'ok' && <p role="status" className="rounded-xl bg-green-50 p-3 text-sm text-green-900">تم تأكيد بريدك الإلكتروني. شكراً لك.</p>}
      {state === 'bad' && <p role="alert" className="rounded-xl bg-red-50 p-3 text-sm text-red-800">{message}</p>}
      <p className="text-center text-sm"><Link href="/" className="font-bold text-saudi-green-800 underline">الصفحة الرئيسية</Link></p>
    </AuthCard>
  );
}
export default function VerifyEmailPage() { return <Suspense><Verify /></Suspense>; }
