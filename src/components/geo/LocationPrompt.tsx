'use client';
import { useEffect, useState } from 'react';
import { LocateFixed, MapPin, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { useGeo } from './GeoProvider';
import { useInnerPathname, usePick, useT } from '@/components/i18n/LocaleProvider';

const askedKey = (userId: string) => `munasbti.location.asked.${userId}`;
const PRIVATE_AREAS = ['/admin', '/system-admin', '/system-setup', '/access', '/vendor', '/coverage-preview'];

/**
 * Right after a customer signs in (by any method) offer once to detect their area, so the services shown are the ones
 * available there or nearby. The browser asks for permission only after they press "allow"; choosing a city by hand
 * stays available, and a city they chose themselves is never overwritten.
 */
export default function LocationPrompt() {
  const t = useT(); const pick = usePick();
  const { currentUser } = useApp(); const geo = useGeo(); const pathname = useInnerPathname();
  const [open, setOpen] = useState(false), [busy, setBusy] = useState(false), [result, setResult] = useState('');
  const data = geo.data, userId = currentUser?.id;
  const usable = !!data && !data.preview && data.snapshot.policy.reverseEnabled && data.reverseConfigured;
  const decided = data?.selection.source === 'MANUAL' || data?.selection.source === 'GPS';

  useEffect(() => {
    if (!userId || !usable || decided || geo.loading || PRIVATE_AREAS.some(p => pathname.startsWith(p))) return;
    try { if (localStorage.getItem(askedKey(userId))) return; } catch { /* storage blocked: ask once per page load */ }
    const timer = setTimeout(() => setOpen(true), 1200);
    return () => clearTimeout(timer);
  }, [userId, usable, decided, geo.loading, pathname]);

  const remember = () => { if (userId) try { localStorage.setItem(askedKey(userId), '1'); } catch { /* ignore */ } };
  const close = () => { remember(); setOpen(false); };
  async function allow() {
    setBusy(true); setResult('');
    try { await geo.locate(); remember(); setOpen(false); setResult('done'); setTimeout(() => setResult(''), 6000); }
    catch (e) { setResult(e instanceof Error ? e.message : t('تعذر تحديد الموقع؛ اختر المدينة يدوياً')); }
    finally { setBusy(false); }
  }
  const city = data?.snapshot.cities.find(c => c.id === data.selection.cityId);

  if (result === 'done' && city) return <div role="status" className="fixed bottom-20 sm:bottom-6 start-4 z-50 max-w-sm rounded-2xl bg-saudi-green-950 text-white shadow-2xl p-4 text-sm flex items-center gap-2"><MapPin size={16} className="text-saudi-gold-300 shrink-0" />{t('حددنا منطقتك:')} <strong>{pick(city.nameAr, city.nameEn)}</strong></div>;
  if (result === 'done') return <div role="status" className="fixed bottom-20 sm:bottom-6 start-4 z-50 max-w-sm rounded-2xl bg-white border shadow-2xl p-4 text-sm">{t('لا نغطي منطقتك حالياً؛ يمكنك اختيار أقرب مدينة من القائمة.')}</div>;
  if (!open) return null;
  return <div role="dialog" aria-modal="false" aria-labelledby="loc-title" className="fixed bottom-20 sm:bottom-6 start-4 end-4 sm:end-auto sm:w-96 z-50 rounded-3xl bg-white border border-gray-200 shadow-2xl p-5 space-y-3" dir="rtl">
    <div className="flex items-start justify-between gap-3">
      <h2 id="loc-title" className="font-bold flex items-center gap-2"><LocateFixed size={18} className="text-saudi-green-800" />{t('نعرض لك الخدمات القريبة منك')}</h2>
      <button type="button" aria-label={t('إغلاق')} onClick={close}><X size={16} /></button>
    </div>
    <p className="text-sm text-gray-700">{t('اسمح بتحديد موقعك لنعرض لك الخدمات المتاحة في منطقتك أو القريبة منها. نستخدم الموقع لتحديد المدينة فقط ولا نحفظ إحداثياتك.')}</p>
    {result && result !== 'done' && <p role="status" className="text-xs text-amber-800">{result}</p>}
    <div className="flex flex-wrap gap-2">
      <button type="button" disabled={busy} onClick={allow} className="flex-1 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 disabled:opacity-50 text-white font-bold text-sm py-2.5 px-4">{busy ? t('جارٍ تحديد الموقع…') : t('السماح بتحديد موقعي')}</button>
      <button type="button" onClick={() => { close(); geo.openPicker(); }} className="rounded-xl border border-gray-300 font-bold text-sm py-2.5 px-4">{t('اختيار المدينة يدوياً')}</button>
    </div>
  </div>;
}
