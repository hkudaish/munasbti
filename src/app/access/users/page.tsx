'use client';
import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import AccessShell, { field, useAccess } from '@/components/access/AccessShell';

const STATUS: Record<string, string> = { ACTIVE: 'مفعّل', PENDING: 'بانتظار الاعتماد', REJECTED: 'مرفوض', DISABLED: 'معطّل' };
const VIA: Record<string, string> = { password: 'كلمة مرور', google: 'Google', apple: 'Apple', email: 'بريد + رمز', phone: 'جوال + رمز', admin: 'أنشأه مسؤول' };
const stateOf = (u: any) => !u.isActive ? 'DISABLED' : u.approvalStatus;

export default function UsersPage() {
  const [q, setQ] = useState(''), [applied, setApplied] = useState(''), [role, setRole] = useState(''), [status, setStatus] = useState(''), [page, setPage] = useState(0);
  const { data, error, notice, busy, mutate } = useAccess(`?q=${encodeURIComponent(applied)}&role=${role}&status=${status}&page=${page}`);
  const [editor, setEditor] = useState<any>(null);
  const roleName = (key: string) => data?.roles?.find((r: any) => r.key === key)?.nameAr || key;
  const held: string[] = data?.me?.permissions || [], sys = data?.me?.role === 'SUPER_ADMIN';
  const canStatus = held.includes('users.disable'), canApprove = held.includes('users.approve'), canRoles = held.includes('users.manage_staff') || held.includes('users.edit'), canEdit = held.includes('users.edit'), canCreate = held.includes('users.create');
  const assignable = (data?.roles || []).filter((r: any) => r.active && r.legacyRole !== 'VENDOR' && (sys || !['system_admin', 'admin'].includes(r.key)));
  return <AccessShell title="المستخدمون والصلاحيات" perms={held} notice={notice} error={error}>{data?.users && <>
    {data.pending > 0 && <button className="w-full text-start rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-bold" onClick={() => { setStatus('PENDING'); setPage(0); }}>{data.pending} حساب بانتظار الاعتماد — اضغط لعرضها</button>}
    <section className="rounded-2xl border bg-white p-4 space-y-4">
      <div className="flex flex-wrap gap-3 justify-between"><form className="flex flex-wrap gap-2" onSubmit={e => { e.preventDefault(); setApplied(q); setPage(0); }}>
        <input aria-label="بحث" placeholder="الاسم أو الجوال أو البريد" className={field + ' w-56'} value={q} onChange={e => setQ(e.target.value)} />
        <select aria-label="تصنيف المستخدم" className={field + ' w-40'} value={role} onChange={e => { setRole(e.target.value); setPage(0); }}><option value="">كل التصنيفات</option>{data.roles.map((r: any) => <option key={r.key} value={r.key}>{r.nameAr}</option>)}</select>
        <select aria-label="حالة الحساب" className={field + ' w-40'} value={status} onChange={e => { setStatus(e.target.value); setPage(0); }}><option value="">كل الحالات</option>{Object.entries(STATUS).map(([k, v]) => <option key={k} value={k === 'DISABLED' ? 'DISABLED' : k}>{v}</option>)}</select>
        <button className="border rounded-xl px-4 text-sm">بحث</button></form>
        {canCreate && <button onClick={() => setEditor({ mode: 'create', name: '', phone: '', email: '', password: '', roleKeys: ['client'] })} className="flex gap-2 items-center rounded-xl bg-emerald-900 text-white px-4 py-2 text-sm"><Plus size={16} />إضافة مستخدم</button>}</div>
      <div className="overflow-x-auto"><table className="w-full text-sm text-right"><thead className="bg-slate-50"><tr><th className="p-3">المستخدم</th><th className="p-3">التواصل</th><th className="p-3">التصنيف</th><th className="p-3">الحالة</th><th className="p-3">التوثيق</th><th className="p-3">طريقة التسجيل</th><th className="p-3">آخر دخول</th><th className="p-3">إجراءات</th></tr></thead><tbody>
        {data.users.map((u: any) => <tr key={u.id} className="border-t align-top">
          <td className="p-3 font-bold">{u.name}</td>
          <td className="p-3" dir="ltr"><div>{u.phone || '—'}</div><div>{u.email || '—'}</div></td>
          <td className="p-3">{u.roleKeys.map(roleName).join('، ')}</td>
          <td className="p-3"><span className={`px-2 py-1 rounded-lg text-xs ${stateOf(u) === 'ACTIVE' ? 'bg-green-50 text-green-800' : stateOf(u) === 'PENDING' ? 'bg-amber-50 text-amber-800' : 'bg-red-50 text-red-800'}`}>{STATUS[stateOf(u)]}</span></td>
          <td className="p-3 text-xs">{u.phoneVerified ? 'الجوال موثّق' : 'الجوال غير موثّق'}<br />{u.emailVerified ? 'البريد موثّق' : 'البريد غير موثّق'}{u.identities.length > 0 && <><br />مرتبط: {u.identities.join('، ')}</>}</td>
          <td className="p-3">{VIA[u.registeredVia] || u.registeredVia}</td>
          <td className="p-3 text-xs">{u.lastLoginAt ? new Date(u.lastLoginAt).toLocaleString('ar-SA-u-nu-latn') : 'لم يدخل بعد'}</td>
          <td className="p-3 space-y-1">
            {canApprove && u.approvalStatus === 'PENDING' && <><button disabled={busy} className="underline text-emerald-900 block" onClick={() => void mutate({ action: 'setUserStatus', userId: u.id, status: 'approve' }, 'تم اعتماد الحساب.')}>اعتماد</button><button disabled={busy} className="underline text-red-800 block" onClick={() => void mutate({ action: 'setUserStatus', userId: u.id, status: 'reject' }, 'تم رفض الحساب.')}>رفض</button></>}
            {canStatus && u.id !== data.me.id && (u.isActive ? <button disabled={busy} className="underline text-red-800 block" onClick={() => { if (confirm('تعطيل الحساب وإنهاء جلساته؟')) void mutate({ action: 'setUserStatus', userId: u.id, status: 'disable' }, 'تم تعطيل الحساب.'); }}>تعطيل</button> : <button disabled={busy} className="underline text-emerald-900 block" onClick={() => void mutate({ action: 'setUserStatus', userId: u.id, status: 'enable' }, 'تم تفعيل الحساب.')}>تفعيل</button>)}
            {(canRoles || canEdit) && u.id !== data.me.id && <button disabled={busy} className="underline block" onClick={() => setEditor({ mode: 'edit', ...u, roleKeys: u.roleKeys })}>تعديل التصنيف والبيانات</button>}
          </td></tr>)}
      </tbody></table></div>
      {!data.users.length && <p className="p-6 text-center text-slate-500">لا توجد نتائج.</p>}
      <div className="flex items-center justify-between text-xs"><button disabled={!page} onClick={() => setPage(p => p - 1)} className="border rounded-lg p-2 disabled:opacity-40">السابق</button><span>صفحة {page + 1} · الإجمالي {data.totalUsers}</span><button disabled={data.users.length < 50} onClick={() => setPage(p => p + 1)} className="border rounded-lg p-2 disabled:opacity-40">التالي</button></div>
      <p className="text-xs text-slate-500">المهام المسندة لكل مستخدم ستظهر هنا عند تفعيل وحدة المهام؛ صلاحياتها (tasks.*) جاهزة للربط بالأدوار.</p>
    </section></>}
    {editor && <div role="dialog" aria-modal="true" aria-labelledby="usr-dlg" className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4"><form onSubmit={async e => {
      e.preventDefault();
      if (editor.mode === 'create') { if (await mutate({ action: 'createUser', ...editor }, 'تم إنشاء المستخدم.')) setEditor(null); return; }
      let ok = true;
      if (canRoles) ok = !!(await mutate({ action: 'setUserRoles', userId: editor.id, roleKeys: editor.roleKeys }, 'تم تحديث التصنيف؛ أُنهيت جلسات المستخدم.'));
      if (ok && canEdit) ok = !!(await mutate({ action: 'updateContact', userId: editor.id, name: editor.name, phone: editor.phone || '', email: editor.email || '' }, 'تم الحفظ.'));
      if (ok) setEditor(null);
    }} className="bg-white rounded-2xl p-6 max-w-lg w-full space-y-4 max-h-[90vh] overflow-auto">
      <div className="flex justify-between"><h2 id="usr-dlg" className="font-bold">{editor.mode === 'create' ? 'إضافة مستخدم' : 'تعديل المستخدم'}</h2><button type="button" aria-label="إغلاق" onClick={() => setEditor(null)}><X size={20} /></button></div>
      <label className="block text-sm">الاسم<input required maxLength={120} className={field} value={editor.name} disabled={editor.mode === 'edit' && !canEdit} onChange={e => setEditor({ ...editor, name: e.target.value })} /></label>
      <label className="block text-sm">الجوال<input dir="ltr" className={field} value={editor.phone || ''} disabled={editor.mode === 'edit' && !canEdit} onChange={e => setEditor({ ...editor, phone: e.target.value })} /></label>
      <label className="block text-sm">البريد الإلكتروني<input dir="ltr" type="email" className={field} value={editor.email || ''} disabled={editor.mode === 'edit' && !canEdit} onChange={e => setEditor({ ...editor, email: e.target.value })} /></label>
      {editor.mode === 'edit' && canEdit && <p className="text-xs text-slate-500">تغيير الجوال أو البريد يلغي توثيقه وينهي جلسات المستخدم.</p>}
      {(editor.mode === 'create' || canRoles) && <fieldset className="space-y-2"><legend className="text-sm font-bold">التصنيفات</legend>{assignable.map((r: any) => <label key={r.key} className="flex gap-2 text-sm"><input type="checkbox" checked={editor.roleKeys.includes(r.key)} onChange={e => setEditor({ ...editor, roleKeys: e.target.checked ? [...editor.roleKeys, r.key] : editor.roleKeys.filter((k: string) => k !== r.key) })} />{r.nameAr}</label>)}</fieldset>}
      {editor.mode === 'create' && <label className="block text-sm">كلمة مرور (اختياري، 12 حرفاً فأكثر)<input type="password" autoComplete="new-password" minLength={12} maxLength={128} className={field} value={editor.password} onChange={e => setEditor({ ...editor, password: e.target.value })} /><span className="text-xs text-slate-500">من دون كلمة مرور يدخل المستخدم بالجوال أو البريد أو Google/Apple، وعند أول دخول يثبت ملكيته لبياناته.</span></label>}
      <button disabled={busy || !editor.roleKeys.length} className="w-full bg-emerald-900 text-white rounded-xl p-3">{busy ? 'جارٍ الحفظ…' : 'حفظ'}</button>
    </form></div>}
  </AccessShell>;
}
