'use client';
import { useState } from 'react';
import { Plus, X, Lock } from 'lucide-react';
import AccessShell, { field, useAccess } from '@/components/access/AccessShell';

const blank = { mode: 'create', key: '', nameAr: '', nameEn: '', description: '', selfRegistration: false, requiresApproval: false, active: true, permissions: [] as string[] };

export default function RolesPage() {
  const { data, error, notice, busy, mutate } = useAccess();
  const [editor, setEditor] = useState<any>(null);
  const held: string[] = data?.me?.permissions || [], canManage = held.includes('roles.manage');
  const byGroup: Record<string, any[]> = {};
  for (const p of data?.permissions || []) (byGroup[p.group] ||= []).push(p);
  const sensitive = new Set((data?.permissions || []).filter((p: any) => p.sensitive).map((p: any) => p.code));
  const protectedRole = editor?.key === 'system_admin';
  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (editor.mode === 'create') { if (await mutate({ action: 'roleCreate', ...editor }, 'تم إنشاء الدور.')) setEditor(null); return; }
    const meta = await mutate({ action: 'roleUpdate', id: editor.id, ...editor }, 'تم حفظ بيانات الدور.');
    if (meta && !protectedRole && await mutate({ action: 'rolePermissions', id: editor.id, permissions: editor.permissions }, 'تم حفظ الدور وصلاحياته.')) setEditor(null);
  }
  return <AccessShell title="الأدوار والصلاحيات" perms={held} notice={notice} error={error}>{data?.permissions && <>
    <div className="flex flex-wrap items-center justify-between gap-3"><p className="text-sm text-slate-600">الصلاحيات تُمنح للأدوار، والأدوار تُسند للمستخدمين. لا يعتمد النظام على اسم الدور، بل على صلاحياته التفصيلية.</p>
      {canManage && <button onClick={() => setEditor({ ...blank })} className="flex gap-2 items-center rounded-xl bg-emerald-900 text-white px-4 py-2 text-sm"><Plus size={16} />إضافة تصنيف</button>}</div>
    <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">{data.roles.map((r: any) => <article key={r.id} className={`rounded-2xl border bg-white p-5 space-y-3 ${r.active ? '' : 'opacity-60'}`}>
      <div className="flex justify-between gap-2"><div><h2 className="font-bold flex items-center gap-2">{r.nameAr}{r.key === 'system_admin' && <Lock size={14} aria-label="محمي" />}</h2><p className="text-xs text-slate-500" dir="ltr">{r.key}</p></div><span className={`text-xs h-fit px-2 py-1 rounded-lg ${r.active ? 'bg-green-50 text-green-800' : 'bg-slate-100 text-slate-600'}`}>{r.active ? 'مفعّل' : 'معطّل'}</span></div>
      <p className="text-xs text-slate-600">{r.description}</p>
      <ul className="text-xs space-y-1"><li>المستخدمون: <b>{r.users}</b></li><li>الصلاحيات: <b>{r.key === 'system_admin' ? 'كاملة' : r.permissions?.length ?? '—'}</b></li><li>التسجيل الذاتي: <b>{r.selfRegistration ? 'مسموح' : 'غير مسموح'}</b></li><li>يحتاج اعتماداً: <b>{r.requiresApproval ? 'نعم' : 'لا'}</b></li></ul>
      {canManage && <button className="underline text-emerald-900 text-sm" onClick={() => setEditor({ mode: 'edit', ...r, permissions: r.permissions || [] })}>تعديل</button>}
      {canManage && !r.isSystem && !r.users && <button disabled={busy} className="underline text-red-800 text-sm mx-3" onClick={() => { if (confirm('حذف هذا الدور؟')) void mutate({ action: 'roleDelete', id: r.id }, 'تم حذف الدور.'); }}>حذف</button>}
    </article>)}</div></>}
    {editor && <div role="dialog" aria-modal="true" aria-labelledby="role-dlg" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><form onSubmit={save} className="bg-white rounded-2xl p-6 max-w-3xl w-full space-y-4 max-h-[92vh] overflow-auto">
      <div className="flex justify-between"><h2 id="role-dlg" className="font-bold">{editor.mode === 'create' ? 'إضافة تصنيف' : 'تعديل الدور'}</h2><button type="button" aria-label="إغلاق" onClick={() => setEditor(null)}><X size={20} /></button></div>
      <div className="grid sm:grid-cols-2 gap-3">
        <label className="block text-sm">الاسم بالعربية<input required maxLength={80} className={field} value={editor.nameAr} onChange={e => setEditor({ ...editor, nameAr: e.target.value })} /></label>
        <label className="block text-sm">الاسم بالإنجليزية<input maxLength={80} dir="ltr" className={field} value={editor.nameEn} onChange={e => setEditor({ ...editor, nameEn: e.target.value })} /></label>
        {editor.mode === 'create' && <label className="block text-sm">المعرّف (لا يتغير لاحقاً)<input required dir="ltr" pattern="[a-z][a-z0-9_]{2,31}" className={field} value={editor.key} onChange={e => setEditor({ ...editor, key: e.target.value.toLowerCase() })} /></label>}
        <label className="block text-sm sm:col-span-2">الوصف<input maxLength={300} className={field} value={editor.description} onChange={e => setEditor({ ...editor, description: e.target.value })} /></label>
      </div>
      <div className="flex flex-wrap gap-6 text-sm">
        {editor.mode === 'edit' && <label className="flex gap-2"><input type="checkbox" disabled={protectedRole} checked={editor.active} onChange={e => setEditor({ ...editor, active: e.target.checked })} />الدور مفعّل</label>}
        <label className="flex gap-2"><input type="checkbox" disabled={protectedRole} checked={editor.selfRegistration} onChange={e => setEditor({ ...editor, selfRegistration: e.target.checked })} />يسمح بالتسجيل الذاتي</label>
        <label className="flex gap-2"><input type="checkbox" disabled={protectedRole} checked={editor.requiresApproval} onChange={e => setEditor({ ...editor, requiresApproval: e.target.checked })} />يحتاج اعتماد الإدارة قبل التفعيل</label>
      </div>
      {protectedRole ? <p className="rounded-xl bg-slate-50 p-3 text-sm">مدير النظام يملك كل الصلاحيات دائماً ولا يمكن تقييدها، حتى لا يُقفل النظام بخطأ في الإعداد.</p> : <div className="space-y-4">
        <p className="text-xs text-slate-500">الصلاحيات المعلّمة بـ ⚠ حساسة: لا تُمنح إلا عن قصد، ولا يصح منحها لدور مفتوح للتسجيل الذاتي من دون اشتراط الاعتماد.</p>
        {Object.entries(byGroup).map(([g, perms]) => <fieldset key={g} className="rounded-xl border p-3"><legend className="px-2 text-sm font-bold">{data.groups[g] || g}</legend><div className="grid sm:grid-cols-2 gap-1">{perms.map(p => <label key={p.code} className="flex gap-2 text-sm items-start"><input type="checkbox" className="mt-1" checked={editor.permissions.includes(p.code)} onChange={e => setEditor({ ...editor, permissions: e.target.checked ? [...editor.permissions, p.code] : editor.permissions.filter((c: string) => c !== p.code) })} /><span>{p.nameAr}{sensitive.has(p.code) && ' ⚠'}<span className="block text-[11px] text-slate-400" dir="ltr">{p.code}</span></span></label>)}</div></fieldset>)}
      </div>}
      <button disabled={busy} className="w-full bg-emerald-900 text-white rounded-xl p-3">{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
    </form></div>}
  </AccessShell>;
}
