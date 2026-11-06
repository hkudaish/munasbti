'use client';
import { useEffect, useState } from 'react';
import AccessShell, { field, useAccess } from '@/components/access/AccessShell';

const CHANNELS: [string, string, string][] = [['sms', 'رمز عبر SMS', 'smsOtp'], ['whatsapp', 'رمز عبر واتساب', 'whatsappOtp'], ['email', 'رمز عبر البريد الإلكتروني', 'emailOtp']];

export default function SettingsPage() {
  const { data, error, notice, busy, mutate } = useAccess();
  const [s, setS] = useState<any>(null);
  useEffect(() => { if (data?.settings) setS(data.settings); }, [data?.settings]);
  const held: string[] = data?.me?.permissions || [];
  const Toggle = ({ k, label, hint, ready }: { k: string; label: string; hint?: string; ready: boolean }) => <label className="flex items-start gap-3 rounded-xl border bg-white p-4"><input type="checkbox" className="mt-1" checked={!!s[k]} onChange={e => setS({ ...s, [k]: e.target.checked })} /><span className="flex-1"><span className="font-bold text-sm">{label}</span>{hint && <span className="block text-xs text-slate-500">{hint}</span>}</span><span className={`text-xs px-2 py-1 rounded-lg h-fit ${ready ? 'bg-green-50 text-green-800' : 'bg-amber-50 text-amber-800'}`}>{ready ? 'مهيأ على الخادم' : 'غير مهيأ على الخادم'}</span></label>;
  return <AccessShell title="إعدادات تسجيل الدخول والتحقق" perms={held} notice={notice} error={error}>{s && data.providers && <form className="space-y-5" onSubmit={e => { e.preventDefault(); void mutate({ action: 'saveSettings', settings: s }, 'تم حفظ إعدادات الدخول.'); }}>
    <section className="space-y-3"><h2 className="font-bold">وسائل الدخول</h2>
      <Toggle k="passwordLogin" label="البريد أو الجوال + كلمة المرور" ready />
      <Toggle k="googleLogin" label="Google (Gmail)" hint="OAuth الرسمي. يحتاج GOOGLE_CLIENT_ID وGOOGLE_CLIENT_SECRET." ready={data.oauth.google} />
      <Toggle k="appleLogin" label="Sign in with Apple" hint="يحتاج APPLE_CLIENT_ID وAPPLE_TEAM_ID وAPPLE_KEY_ID وAPPLE_PRIVATE_KEY." ready={data.oauth.apple} />
    </section>
    <section className="space-y-3"><h2 className="font-bold">رموز التحقق (OTP) ومزودو الإرسال</h2>
      {CHANNELS.map(([channel, label, key]) => { const list = data.providers[channel] as any[]; const cur = list.find(p => p.id === s.providers[channel]); return <div key={channel} className="space-y-2">
        <Toggle k={key} label={label} ready={!!cur?.configured} />
        <label className="block text-sm ps-8">المزود<select className={field + ' max-w-sm'} value={s.providers[channel]} onChange={e => setS({ ...s, providers: { ...s.providers, [channel]: e.target.value } })}>{list.map(p => <option key={p.id} value={p.id}>{p.label}{p.configured ? '' : ' — غير مهيأ'}</option>)}</select>
          {cur && !cur.configured && <span className="block text-xs text-amber-800 mt-1" dir="ltr">Missing env: {cur.env.join(', ')}</span>}</label></div>; })}
      <label className="block text-sm">قناة التحقق الافتراضية<select className={field + ' max-w-xs'} value={s.defaultChannel} onChange={e => setS({ ...s, defaultChannel: e.target.value })}>{CHANNELS.map(([c, l]) => <option key={c} value={c}>{l}</option>)}</select></label>
    </section>
    <p className="text-xs text-slate-500">لا تظهر للزوار إلا الوسائل المفعّلة هنا والمهيأة على الخادم. أسرار المزودين تُحفظ في متغيرات البيئة على الخادم ولا تُخزَّن في قاعدة البيانات. لا يُسمح بحفظ إعداد لا تبقى فيه وسيلة دخول واحدة صالحة على الأقل.</p>
    <button disabled={busy} className="rounded-xl bg-emerald-900 text-white px-6 py-3">{busy ? 'جارٍ الحفظ…' : 'حفظ الإعدادات'}</button>
  </form>}</AccessShell>;
}
