'use client';
import { useState } from 'react';
import AccessShell, { field, useAccess } from '@/components/access/AccessShell';

export default function SecurityLogPage() {
  const [event, setEvent] = useState('');
  const { data, error, notice } = useAccess(`?event=${event}`);
  const held: string[] = data?.me?.permissions || [];
  return <AccessShell title="سجل الأمان" perms={held} notice={notice} error={error}>{data?.audit && <section className="rounded-2xl border bg-white p-4 space-y-3">
    <label className="block text-sm">نوع الحدث<select className={field + ' max-w-xs'} value={event} onChange={e => setEvent(e.target.value)}><option value="">كل الأحداث</option>{Object.entries(data.events as Record<string, string>).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
    <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-slate-50"><tr><th className="p-3">الوقت</th><th className="p-3">الحدث</th><th className="p-3">المنفّذ</th><th className="p-3">الهدف</th><th className="p-3">التفاصيل</th></tr></thead><tbody>
      {data.audit.map((a: any) => <tr key={a.id} className="border-t align-top"><td className="p-3 whitespace-nowrap text-xs">{new Date(a.createdAt).toLocaleString('ar-SA-u-nu-latn')}</td><td className="p-3 font-bold">{data.events[a.action] || a.action}</td><td className="p-3 text-xs" dir="ltr">{a.actorId.slice(0, 8)}</td><td className="p-3 text-xs" dir="ltr">{a.targetId.slice(0, 8)}</td><td className="p-3"><pre dir="ltr" className="whitespace-pre-wrap text-xs">{JSON.stringify(a.details)}</pre></td></tr>)}
    </tbody></table></div>{!data.audit.length && <p className="p-6 text-center text-slate-500">لا توجد أحداث.</p>}
  </section>}</AccessShell>;
}
