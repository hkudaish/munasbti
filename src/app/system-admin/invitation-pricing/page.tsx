'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { requestJSON } from '@/lib/api-client';
import { DEFAULT_PRICING, InvitationPricing, quoteInvitations } from '@/lib/invitations/pricing';

const field = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm';

/** System admin: the prices, limits and plan texts the public invitation calculator uses. */
export default function InvitationPricingPage() {
  const [data, setData] = useState<InvitationPricing | null>(null);
  const [notice, setNotice] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { requestJSON('/api/invitation-pricing').then(r => setData(r.pricing)).catch(e => setNotice(e.message)); }, []);
  if (!data) return <p role="status" className="p-8 text-sm">{notice || 'جارٍ التحميل…'}</p>;

  const setNum = (key: 'minInvitations' | 'maxInvitations' | 'maxCompanions' | 'companionPrice', v: string) => setData({ ...data, [key]: v === '' ? NaN : Number(v) });
  const setPlan = (id: string, patch: Record<string, unknown>) => setData({ ...data, plans: data.plans.map(p => (p.id === id ? { ...p, ...patch } : p)) });
  const recommend = (id: string, on: boolean) => setData({ ...data, plans: data.plans.map(p => ({ ...p, recommended: on && p.id === id })) });
  async function save(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setNotice('');
    try { const r = await requestJSON('/api/invitation-pricing', 'PUT', data); setData(r.pricing); setNotice('تم حفظ الأسعار وتطبيقها على الحاسبة العامة'); }
    catch (err) { setNotice(err instanceof Error ? err.message : 'تعذر الحفظ'); }
    finally { setBusy(false); }
  }
  // A worked example with the values on screen, so the admin sees what a customer would be quoted.
  const sample = (() => { try { return quoteInvitations('whatsapp_qr', 150, 1, data); } catch { return null; } })();

  return <div dir="rtl" className="min-h-screen bg-slate-50 p-4 sm:p-8"><div className="max-w-4xl mx-auto space-y-6">
    <header className="space-y-1"><Link href="/system-admin" className="text-sm underline">العودة إلى مدير النظام</Link>
      <h1 className="text-2xl font-black">أسعار حاسبة الدعوات</h1>
      <p className="text-sm text-slate-600">الأرقام والنصوص التي تظهر للزوار في حاسبة تكلفة الدعوات بصفحة «بطاقات ودعوات». الأسعار بالريال السعودي، وهي تقدير أولي للعميل.</p></header>
    {notice && <div role="status" aria-live="polite" className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-sm">{notice}</div>}
    <form onSubmit={save} className="space-y-6">
      <section className="rounded-2xl border bg-white p-5 grid gap-4 sm:grid-cols-4">
        <label className="text-sm">الحد الأدنى للدعوات<input type="number" min={1} className={field} value={Number.isNaN(data.minInvitations) ? '' : data.minInvitations} onChange={e => setNum('minInvitations', e.target.value)} /></label>
        <label className="text-sm">الحد الأقصى للدعوات<input type="number" min={1} className={field} value={Number.isNaN(data.maxInvitations) ? '' : data.maxInvitations} onChange={e => setNum('maxInvitations', e.target.value)} /></label>
        <label className="text-sm">أقصى عدد مرافقين للضيف<input type="number" min={0} className={field} value={Number.isNaN(data.maxCompanions) ? '' : data.maxCompanions} onChange={e => setNum('maxCompanions', e.target.value)} /></label>
        <label className="text-sm">سعر المرافق (لكل دعوة)<input type="number" min={0} step="0.01" className={field} value={Number.isNaN(data.companionPrice) ? '' : data.companionPrice} onChange={e => setNum('companionPrice', e.target.value)} /></label>
      </section>
      {data.plans.map(p => <section key={p.id} className="rounded-2xl border bg-white p-5 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold">{p.nameAr} <span className="text-xs font-normal text-slate-500">({p.qr ? 'تتضمن رمز QR' : 'بدون رمز QR'})</span></h2>
          <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={!!p.recommended} onChange={e => recommend(p.id, e.target.checked)} />تمييزها بـ«الأكثر طلباً»</label></div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="text-sm">اسم الباقة<input required maxLength={60} className={field} value={p.nameAr} onChange={e => setPlan(p.id, { nameAr: e.target.value })} /></label>
          <label className="text-sm">الوصف<input required maxLength={160} className={field} value={p.descAr} onChange={e => setPlan(p.id, { descAr: e.target.value })} /></label>
          <label className="text-sm">سعر الدعوة الواحدة<input type="number" min={0} step="0.01" className={field} value={Number.isNaN(p.perInvitation) ? '' : p.perInvitation} onChange={e => setPlan(p.id, { perInvitation: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
          <label className="text-sm">رسوم خدمة الدخول وتأكيد الحضور (مرة واحدة)<input type="number" min={0} step="0.01" className={field} value={Number.isNaN(p.checkInFee) ? '' : p.checkInFee} onChange={e => setPlan(p.id, { checkInFee: e.target.value === '' ? NaN : Number(e.target.value) })} /></label>
        </div></section>)}
      {sample && <p className="rounded-xl bg-emerald-50 border border-emerald-200 p-4 text-sm">مثال بالقيم الحالية: 150 دعوة بباقة «{sample.plan.nameAr}» مع مرافق واحد = <strong>{sample.total} ريال</strong></p>}
      <p className="text-xs text-slate-500">أسماء الباقات ووصفها بالعربية؛ في النسخة الإنجليزية تظهر كما كُتبت هنا ما لم تكن مطابقة للنص الافتراضي.</p>
      <div className="flex gap-3"><button disabled={busy} className="rounded-xl bg-emerald-900 text-white px-6 py-3 text-sm font-bold">{busy ? 'جارٍ الحفظ…' : 'حفظ الأسعار'}</button>
        <button type="button" onClick={() => setData(DEFAULT_PRICING)} className="rounded-xl border px-4 py-3 text-sm">استرجاع القيم الافتراضية (دون حفظ)</button></div>
    </form></div></div>;
}
