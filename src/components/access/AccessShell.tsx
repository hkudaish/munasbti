'use client';
import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ShieldCheck } from 'lucide-react';
import { requestJSON } from '@/lib/api-client';

export const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';
const TABS: [string, string, string][] = [['/access/users', 'المستخدمون والصلاحيات', 'users.view'], ['/access/roles', 'الأدوار والصلاحيات', 'roles.view'], ['/access/settings', 'إعدادات تسجيل الدخول والتحقق', 'auth.settings'], ['/access/security-log', 'سجل الأمان', 'audit.view']];

/** Loads /api/access once per screen and exposes a mutate() that posts an action and reloads. Every button is still enforced by the server. */
export function useAccess(query = '') {
  const [data, setData] = useState<any>(null), [error, setError] = useState(''), [notice, setNotice] = useState(''), [busy, setBusy] = useState(false);
  const load = useCallback(async () => { try { setError(''); setData(await requestJSON('/api/access' + query)); } catch (e) { setError(e instanceof Error ? e.message : 'تعذر التحميل'); } }, [query]);
  useEffect(() => { void load(); }, [load]);
  async function mutate(payload: Record<string, unknown>, done = 'تم الحفظ.') {
    setBusy(true); setNotice('');
    try { const result = await requestJSON('/api/access', 'POST', payload); await load(); setNotice(done); return result; }
    catch (e) { setNotice(e instanceof Error ? e.message : 'تعذر الحفظ'); return null; }
    finally { setBusy(false); }
  }
  return { data, error, notice, setNotice, busy, load, mutate };
}

export default function AccessShell({ title, perms, children, notice, error }: { title: string; perms?: string[]; children: React.ReactNode; notice?: string; error?: string }) {
  const path = usePathname();
  return <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8"><div className="max-w-7xl mx-auto space-y-5">
    <div className="rounded-3xl bg-slate-950 text-white p-6 flex flex-wrap items-center justify-between gap-3"><div className="flex gap-3 items-center"><ShieldCheck className="text-amber-400" /><h1 className="text-xl font-black">{title}</h1></div><Link href="/" className="text-sm underline">الرئيسية</Link></div>
    <nav aria-label="أقسام إدارة الوصول" className="flex flex-wrap gap-2">{TABS.filter(([, , p]) => !perms || perms.includes(p)).map(([href, label]) => <Link key={href} href={href} aria-current={path === href ? 'page' : undefined} className={`rounded-xl px-4 py-2 text-sm font-bold ${path === href ? 'bg-emerald-900 text-white' : 'bg-white border'}`}>{label}</Link>)}</nav>
    {notice && <div role="status" aria-live="polite" className="rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm">{notice}</div>}
    {error ? <div role="alert" className="rounded-xl border border-red-300 bg-red-50 p-4 text-sm">{error}</div> : children}
  </div></div>;
}
