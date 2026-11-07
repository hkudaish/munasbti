'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Calculator, QrCode, Users } from 'lucide-react';
import { useT } from '@/components/i18n/LocaleProvider';
import { formatSAR } from '@/lib/utils';
import { COMPANION_PRICE, INVITATION_PLANS, InvitationPlanId, MAX_COMPANIONS, MAX_INVITATIONS, MIN_INVITATIONS, quoteInvitations } from '@/lib/invitations/pricing';

/** Public price estimate for sending invitations: number of invitations, plan, and companions allowed per guest. */
export default function InvitationCalculator() {
  const t = useT();
  const [count, setCount] = useState(150);
  const [planId, setPlanId] = useState<InvitationPlanId>('whatsapp_qr');
  const [companions, setCompanions] = useState(1);
  const q = quoteInvitations(planId, count, companions);

  return (
    <section aria-label={t('حاسبة تكلفة الدعوات')} className="rounded-3xl border border-saudi-sand-300 bg-white p-5 sm:p-8 space-y-6">
      <header className="space-y-1">
        <h2 className="text-xl font-black font-cairo text-saudi-green-950 flex items-center gap-2"><Calculator className="w-5 h-5 text-saudi-gold-600" />{t('حاسبة تكلفة الدعوات')}</h2>
        <p className="text-sm text-gray-600">{t('حدد عدد الضيوف واختر الباقة لتظهر التكلفة التقديرية فوراً.')}</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1fr_20rem]">
        <div className="space-y-6">
          <div className="space-y-2">
            <label htmlFor="inv-count" className="flex items-center justify-between text-sm font-bold"><span>{t('عدد الدعوات')}</span>
              <input aria-label={t('عدد الدعوات')} type="number" min={MIN_INVITATIONS} max={MAX_INVITATIONS} value={count} onChange={e => setCount(Number(e.target.value))} className="w-24 rounded-lg border p-2 text-center" /></label>
            <input id="inv-count" type="range" min={MIN_INVITATIONS} max={MAX_INVITATIONS} step={10} value={q.invitations} onChange={e => setCount(Number(e.target.value))} className="w-full accent-saudi-green-800" />
            <p className="text-xs text-gray-500">{t('من')} {MIN_INVITATIONS} {t('إلى')} {MAX_INVITATIONS} {t('دعوة')}</p>
          </div>

          <fieldset className="space-y-2">
            <legend className="text-sm font-bold mb-2">{t('نوع الخدمة')}</legend>
            <div className="grid gap-3 sm:grid-cols-2">
              {INVITATION_PLANS.map(p => (
                <label key={p.id} className={`relative cursor-pointer rounded-2xl border-2 p-4 space-y-1 transition ${planId === p.id ? 'border-saudi-green-800 bg-emerald-50' : 'border-gray-200 hover:border-gray-300'}`}>
                  <input type="radio" name="inv-plan" value={p.id} checked={planId === p.id} onChange={() => setPlanId(p.id)} className="sr-only" />
                  <span className="flex items-center gap-2 font-bold text-sm">{p.qr && <QrCode className="w-4 h-4 text-saudi-green-800" />}{t(p.nameAr)}
                    {p.recommended && <span className="rounded-full bg-saudi-gold-500 text-saudi-green-950 text-caption2 px-2 py-0.5">{t('الأكثر طلباً')}</span>}</span>
                  <span className="block text-xs text-gray-600">{t(p.descAr)}</span>
                  <span className="block text-xs font-bold text-saudi-green-900">{p.perInvitation === 0 ? t('مجاناً') : formatSAR(p.perInvitation) + ' / ' + t('دعوة')}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <div className={`space-y-2 ${q.plan.qr ? '' : 'opacity-50'}`}>
            <label htmlFor="inv-comp" className="flex items-center justify-between text-sm font-bold"><span className="flex items-center gap-2"><Users className="w-4 h-4" />{t('المرافقون المسموحون لكل ضيف')}</span>
              <select id="inv-comp" disabled={!q.plan.qr} value={q.companions} onChange={e => setCompanions(Number(e.target.value))} className="rounded-lg border p-2">
                {Array.from({ length: MAX_COMPANIONS + 1 }, (_, i) => <option key={i} value={i}>{i === 0 ? t('الضيف وحده') : i}</option>)}
              </select></label>
            <p className="text-xs text-gray-500">{q.plan.qr ? `${formatSAR(COMPANION_PRICE)} ${t('لكل مرافق في كل دعوة')}` : t('المرافقون يُحدَّدون مع الباقات التي تتضمن رمز QR.')}</p>
          </div>
        </div>

        <aside className="rounded-2xl bg-saudi-sand-50 border border-saudi-sand-300 p-5 space-y-3 h-fit" aria-live="polite">
          <h3 className="font-bold text-saudi-green-950">{t('ملخص التكلفة')}</h3>
          <dl className="text-sm space-y-2">
            <div className="flex justify-between"><dt className="text-gray-600">{t('الباقة')}</dt><dd className="font-bold">{t(q.plan.nameAr)}</dd></div>
            <div className="flex justify-between"><dt className="text-gray-600">{q.invitations} {t('دعوة')}</dt><dd>{formatSAR(q.baseTotal)}</dd></div>
            {q.companionTotal > 0 && <div className="flex justify-between"><dt className="text-gray-600">{t('المرافقون')}</dt><dd>{formatSAR(q.companionTotal)}</dd></div>}
            {q.checkInFee > 0 && <div className="flex justify-between"><dt className="text-gray-600">{t('خدمة الدخول وتأكيد الحضور')}</dt><dd>{formatSAR(q.checkInFee)}</dd></div>}
            <div className="flex justify-between"><dt className="text-gray-600">{t('أقصى عدد للحضور')}</dt><dd>{q.maxAttendees}</dd></div>
          </dl>
          <p className="flex items-baseline justify-between border-t pt-3"><span className="font-bold">{t('الإجمالي')}</span><span className="text-2xl font-black text-saudi-green-900">{formatSAR(q.total)}</span></p>
          <p className="text-caption2 text-gray-500">{t('تقدير أولي للتوضيح، والسعر النهائي يؤكَّد عند الطلب.')}</p>
          <Link href="/invitations/design" className="block text-center rounded-xl bg-saudi-green-900 text-white text-sm font-bold py-2.5 hover:bg-saudi-green-800">{t('ابدأ بتصميم دعوتك')}</Link>
        </aside>
      </div>
    </section>
  );
}
