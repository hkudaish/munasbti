'use client';

import React, { useEffect, useState, useRef } from 'react';
import { Heart, Search, Sparkles, Download, Copy, Save, Upload, Share2, Palette, Printer, Archive, Check, X } from 'lucide-react';
import { useApp } from '@/lib/store';
import { AUDIENCES, BUILTIN_TEMPLATES, CardDesign, InviteTemplate, LAYOUTS, MOTIFS, OCCASIONS, OccasionKind, SIZES, STYLES, contrastRatio, hijriOf, occasionKind, validateDesign, validateTemplate } from '@/lib/invitations/catalog';
import { COLLECTIONS, LIBRARY_TEMPLATES, LibraryTemplate, startingDesign, thumbnailDesign } from '@/lib/invitations/library';
import InvitationQRCode from '@/components/common/InvitationQRCode';
import { getInvitationOrigin, normalizeInvitationOrigin } from '@/lib/invitations/link';
import { qrSvg } from '@/lib/invitations/qr';
import { cardSvg, downloadFile, pngBlob, printCard } from '@/lib/invitations/render';

import { requestJSON } from '@/lib/api-client';
import Link from 'next/link';
const statusNames = { private: 'خاص', pending: 'بانتظار المراجعة', published: 'منشور', rejected: 'يحتاج تعديلاً', archived: 'مؤرشف' };
const libraryOf = (t: InviteTemplate): LibraryTemplate | undefined => LIBRARY_TEMPLATES.find(l => l.id === t.id);
const cardOf = (t: InviteTemplate): CardDesign => { const l = libraryOf(t); return l ? thumbnailDesign(l) : t.design; };
const fieldClass = 'w-full rounded-xl border border-gray-300 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-saudi-green-700';
function Preview({ design, small = false, qrValue = '' }: { design: CardDesign; small?: boolean; qrValue?: string }) {
  return <div className={small ? 'h-40 overflow-hidden rounded-xl [&_svg]:h-full [&_svg]:w-full' : 'overflow-hidden rounded-2xl shadow-xl [&_svg]:h-auto [&_svg]:w-full'} dangerouslySetInnerHTML={{ __html: cardSvg(design, qrValue) }} />;
}
function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="block space-y-1 text-xs font-bold text-gray-700"><span>{label}</span>{children}</label>;
}
export default function DigitalInviteGenerator() {
  const { activeOccasion, currentUser } = useApp();
  if (!activeOccasion) return null;
  return <InvitationStudio key={`${activeOccasion.id}:${currentUser?.id || 'guest'}`} />;
}
/** The direct service: the same studio with no occasion behind it (designs are saved to the user's own templates, not to an occasion draft). */
export function StandaloneInvitationStudio() {
  const { currentUser } = useApp();
  return <InvitationStudio key={`standalone:${currentUser?.id || 'guest'}`} standalone />;
}
function InvitationStudio({ standalone = false }: { standalone?: boolean }) {
  const { activeOccasion, currentUser, currentRole } = useApp();
  const occasion = standalone ? null : activeOccasion!;
  const userId = currentUser?.id || 'guest';
  const isAdmin = currentRole === 'admin' && !!(currentUser?.hasAdminAccess || currentUser?.role === 'admin');
  const canEdit = !!currentUser;
  const draftVersion = useRef(0);
  const saveQueue = useRef<Promise<unknown>>(Promise.resolve());
  const lastSaved = useRef('');
  const [saveStatus, setSaveStatus] = useState('');
  const [conflicted, setConflicted] = useState(false);
  const initialKind: OccasionKind = occasion ? occasionKind(occasion.occasionTypeId) : 'wedding';
  const initialTemplate: InviteTemplate = LIBRARY_TEMPLATES.find(t => t.occasion === initialKind) ?? BUILTIN_TEMPLATES.find(t => t.occasion === initialKind) ?? BUILTIN_TEMPLATES[0];
  const eventFields = (): Partial<CardDesign> => !occasion ? {} : ({ title: occasion.title, date: occasion.date, hijri: hijriOf(occasion.date), time: occasion.time || '', venue: occasion.venueName || occasion.cityNameAr });
  const [design, setDesign] = useState<CardDesign>({ ...initialTemplate.design, ...eventFields() });
  const [activeId, setActiveId] = useState<string>(initialTemplate.id);
  const [audience, setAudience] = useState('');
  const [records, setRecords] = useState<InviteTemplate[]>([]);
  const [favorites, setFavorites] = useState<string[]>([]);
  const [ready, setReady] = useState(false);
  const [tab, setTab] = useState<'library' | 'mine' | 'favorites' | 'manage'>('library');
  const [kind, setKind] = useState<OccasionKind | ''>(initialKind);
  const [style, setStyle] = useState('');
  const [color, setColor] = useState('');
  const [search, setSearch] = useState('');
  const [name, setName] = useState('تصميمي الخاص');
  const [templateKind, setTemplateKind] = useState<OccasionKind>(initialKind);
  const [templateStyle, setTemplateStyle] = useState<InviteTemplate['style']>(initialTemplate.style);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [shareOrigin, setShareOrigin] = useState('');
  const [originInput, setOriginInput] = useState('');
  const [includeQr, setIncludeQr] = useState(true);

  const latestDraft = useRef('');
  latestDraft.current = JSON.stringify({ design, shareOrigin });
  const [reviewNotes, setReviewNotes] = useState<Record<string, string>>({});
  useEffect(() => {
    let cancelled = false; setReady(false);
    requestJSON(occasion ? `/api/invitation-studio?occasionId=${encodeURIComponent(occasion.id)}` : '/api/invitation-studio').then(data => {
      if (cancelled) return;
      setRecords(data.records.map(validateTemplate)); setFavorites(data.favorites); draftVersion.current = data.version;
      const origin = data.shareOrigin || getInvitationOrigin(); setShareOrigin(origin); setOriginInput(origin);
      const next = data.draft ? validateDesign(data.draft) : design;
      setDesign(next); lastSaved.current = JSON.stringify({ design: next, shareOrigin: origin });
      setReady(true); setSaveStatus(data.draft ? 'المسودة محفوظة في قاعدة البيانات' : '');
    }).catch(error => { if (!cancelled) { setNotice(error.message); setSaveStatus('تعذر تحميل المسودة؛ أعد تحميل الصفحة'); } });
    return () => { cancelled = true; };
    // The studio remounts when its account or occasion changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const serialized = JSON.stringify({ design, shareOrigin });
    if (!occasion || !ready || !canEdit || conflicted || serialized === lastSaved.current) return;
    setSaveStatus('تغييرات غير محفوظة…');
    const timer = setTimeout(() => {
      saveQueue.current = saveQueue.current.catch(() => {}).then(async () => {
        setSaveStatus('جارٍ الحفظ في قاعدة البيانات…');
        try {
          const data = await requestJSON('/api/invitation-studio', 'POST', { action: 'draft', occasionId: occasion!.id, version: draftVersion.current, design, shareOrigin });
          draftVersion.current = data.version; lastSaved.current = serialized; setSaveStatus(latestDraft.current === serialized ? 'المسودة محفوظة في قاعدة البيانات' : 'تغييرات غير محفوظة…');
        } catch (error) { setSaveStatus('تعذر حفظ المسودة؛ أعد المحاولة أو صدّر نسخة'); setNotice(error instanceof Error ? error.message : 'تعذر الحفظ'); if (error instanceof Error && error.message.includes('جهاز آخر')) setConflicted(true); }
      });
    }, 800);
    return () => clearTimeout(timer);
  }, [design, shareOrigin, ready, canEdit, conflicted, occasion?.id]);
  const patch = (value: Partial<CardDesign>) => { if (canEdit) setDesign(d => ({ ...d, ...value })); };
  const commit = async (record: InviteTemplate, expectedVersion?: number) => {
    const result = await requestJSON('/api/invitation-studio', 'POST', { action: 'template', template: record, expectedVersion });
    setRecords(result.records.map(validateTemplate));
  };
  const run = async (action: () => void | Promise<void>) => {
    setBusy(true); setNotice('');
    try { await action(); } catch (error) { setNotice(error instanceof Error ? error.message : 'تعذر إتمام العملية'); }
    finally { setBusy(false); }
  };
  const selectTemplate = (t: InviteTemplate) => {
    if (!canEdit) { setNotice('سجّل الدخول لتخصيص القوالب وحفظها.'); return; }
    const own = t.ownerId === userId && t.status !== 'published' && t.status !== 'pending' && t.status !== 'archived';
    setDesign(t.ownerId === 'system' ? startingDesign(t as LibraryTemplate, eventFields()) : t.design); setActiveId(t.id);
    setName(own ? t.name : `نسخة من ${t.name}`); setEditingId(own ? t.id : null); setTemplateKind(t.occasion); setTemplateStyle(t.style);
    setNotice(own ? 'فتحت تصميمك للتعديل.' : 'نسخة مستقلة جاهزة للتخصيص.');
  };
  const save = (duplicate = false) => run(async () => {
    if (!canEdit) throw new Error('سجّل الدخول لحفظ التصميم');
    if (!name.trim() || name.length > 80) throw new Error('أدخل اسم تصميم من 1 إلى 80 حرفاً');
    const existing = records.find(t => t.id === editingId && t.ownerId === userId && (t.status === 'private' || t.status === 'rejected'));
    const id = !duplicate && existing ? existing.id : crypto.randomUUID();
    const record: InviteTemplate = { id, name: name.trim(), occasion: templateKind, style: templateStyle, color: contrastRatio(design.background, '#ffffff') > 5 ? 'داكن' : 'فاتح', design: validateDesign(design), ownerId: userId, status: 'private', version: existing && !duplicate ? existing.version + 1 : 1, updatedAt: new Date().toISOString() };
    await commit(record, !duplicate ? existing?.version : undefined); setEditingId(id); setNotice('تم حفظ التصميم في قاعدة البيانات ضمن «تصاميمي».');
  });
  const transition = (t: InviteTemplate, status: InviteTemplate['status']) => run(async () => {
    const own = t.ownerId === userId;
    if (status === 'pending' && (!own || !['private', 'rejected'].includes(t.status))) throw new Error('يمكن إرسال تصميمك الخاص فقط للمراجعة');
    if (['published', 'rejected'].includes(status) && (!isAdmin || t.status !== 'pending')) throw new Error('المراجعة متاحة للإدارة فقط');
    if (status === 'archived' && !(isAdmin || (own && ['private', 'rejected'].includes(t.status)))) throw new Error('لا يمكنك أرشفة هذا القالب');
    const reviewNote = reviewNotes[t.id]?.trim();
    if (status === 'rejected' && !reviewNote) throw new Error('أدخل سبب طلب التعديل أولاً');
    await commit({ ...t, status, reviewNote: status === 'rejected' ? reviewNote : undefined, updatedAt: new Date().toISOString() }, t.version);
    setNotice(`تم تحديث حالة القالب: ${statusNames[status]}.`);
  });
  const importTemplate = async (file?: File) => {
    if (!file) return;
    await run(async () => {
      if (!canEdit) throw new Error('سجّل الدخول لرفع قالب');
      if (file.size > 1500000) throw new Error('الحد الأقصى لملف القالب 1.5 ميغابايت');
      const payload = JSON.parse(await file.text());
      if (payload.schemaVersion !== 1) throw new Error('نسخة ملف القالب غير مدعومة');
      const validated = validateTemplate(payload.template);
      const imported: InviteTemplate = { ...validated, id: crypto.randomUUID(), ownerId: userId, status: 'private', version: 1, reviewNote: undefined, updatedAt: new Date().toISOString() };
      await commit(imported); selectTemplate(imported); setTab('mine'); setNotice('تم استيراد نسخة خاصة من القالب.');
    });
  };
  const uploadImage = async (file?: File) => {
    if (!file) return;
    await run(async () => {
      if (!canEdit) throw new Error('سجّل الدخول لرفع صورة');
      if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 800000) throw new Error('استخدم PNG أو JPEG أو WebP بحجم لا يتجاوز 800 كيلوبايت');
      const data = await new Promise<string>((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error('تعذر قراءة الصورة')); reader.readAsDataURL(file); });
      const image = new Image(); image.src = data; await image.decode();
      if (image.width > 6000 || image.height > 6000 || image.width * image.height > 16000000) throw new Error('أبعاد الصورة كبيرة جداً؛ استخدم صورة لا تتجاوز 16 مليون بكسل أو 6000 بكسل لكل ضلع');
      patch({ image: validateDesign({ ...design, image: data }).image });
      setNotice('تمت إضافة الصورة؛ اضبط شفافيتها للحفاظ على وضوح النص.');
    });
  };
  const exportJson = () => {
    const template: InviteTemplate = { id: 'export', ownerId: userId, name: name.trim() || 'تصميم دعوة', occasion: templateKind, style: templateStyle, color: 'ملون', status: 'private', version: 1, updatedAt: new Date().toISOString(), design };
    downloadFile(new Blob([JSON.stringify({ schemaVersion: 1, template }, null, 2)], { type: 'application/json' }), 'invitation-template.json');
  };
  const shareFile = () => run(async () => {
    const file = new File([await pngBlob(design, includeQr ? rsvpUrl : '')], 'invitation.png', { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) { await navigator.share({ files: [file], title: design.title }); setNotice('تمت مشاركة البطاقة.'); }
    else { downloadFile(file, 'invitation.png'); setNotice('تم تنزيل البطاقة؛ يمكنك إرفاقها في تطبيق المشاركة.'); }
  });
  let rsvpUrl = '', linkError = '';
  if (shareOrigin) {
    try { rsvpUrl = occasion?.shareCode ? `${normalizeInvitationOrigin(shareOrigin)}/invite/${occasion.shareCode}` : ''; }
    catch { linkError = 'تعذر تجهيز رابط الدعوة؛ راجع طول العنوان والتاريخ والوقت والموقع.'; }
  }
  const templates: InviteTemplate[] = [...LIBRARY_TEMPLATES, ...BUILTIN_TEMPLATES, ...records];
  const active = LIBRARY_TEMPLATES.find(t => t.id === activeId);
  const visible = templates.filter(t => {
    const inTab = tab === 'manage' ? isAdmin && t.ownerId !== 'system' : tab === 'mine' ? t.ownerId === userId : tab === 'favorites' ? favorites.includes(t.id) && (t.status === 'published' || t.ownerId === userId) : t.status === 'published';
    return inTab && (tab === 'manage' || t.status !== 'archived') && (!kind || t.occasion === kind) && (!style || t.style === style) && (!color || t.color === color) && (!audience || t.audience === audience) && (t.name.includes(search.trim()) || !!libraryOf(t)?.nameEn.toLowerCase().includes(search.trim().toLowerCase()));
  });
  const suggestions = [...LIBRARY_TEMPLATES, ...BUILTIN_TEMPLATES].filter(t => t.occasion === templateKind).slice(0, 8);
  if (!ready) return <div className="p-6" role="status">{notice || 'جارٍ تحميل مكتبة التصاميم…'}{notice && <button onClick={() => window.location.reload()} className="mx-3 underline">إعادة المحاولة</button>}</div>;
  return <div className="space-y-6" dir="rtl">
    <div className="rounded-3xl bg-saudi-green-950 p-6 text-white flex flex-wrap items-center justify-between gap-4">
      <div><span className="text-xs text-saudi-gold-300">مساحة إبداعك</span><h3 className="text-xl font-bold mt-1">كل مناسبة تستحق دعوة تليق بها</h3><p className="text-sm text-white/80 mt-2">{LIBRARY_TEMPLATES.length + BUILTIN_TEMPLATES.length} قالباً منسّقاً · دعوات للرجال والنساء · تخصيص مرن · معاينة وتصدير</p></div><Palette className="h-10 w-10 text-saudi-gold-300" />
    </div>
    <p className="text-xs text-gray-600">التصاميم والمفضلة والدعوات محفوظة في قاعدة البيانات. رابط البطاقة العام للعرض؛ تأكيد الحضور متاح عبر رابط الضيف الشخصي من قائمة المدعوين.</p>
    <div className="flex flex-wrap gap-4 text-xs"><span role="status">{saveStatus}</span><Link className="underline text-green-900" href="/settings/channels">إعدادات واتساب والرسائل والبريد</Link>{occasion && <button className="underline" onClick={() => { lastSaved.current = ''; setDesign(d => ({ ...d })); }}>إعادة محاولة حفظ المسودة</button>}{!occasion && <span>صمّم بطاقتك ثم اضغط «حفظ» لتجدها لاحقاً في «تصاميمي». يمكنك تنزيلها أو طباعتها أو مشاركتها مباشرة.</span>}</div>
    {notice && <div role="status" aria-live="polite" className="rounded-xl border border-saudi-gold-300 bg-amber-50 p-3 text-sm">{notice}</div>}
    <section aria-label="مكتبة القوالب" className="bg-white rounded-3xl border border-gray-200 p-4 sm:p-6 space-y-4">
      <div className="flex flex-wrap justify-between gap-3">
        <div role="tablist" aria-label="أقسام المكتبة" className="flex flex-wrap gap-2">
          {(['library', 'mine', 'favorites', ...(isAdmin ? ['manage'] : [])] as typeof tab[]).map(value => <button key={value} role="tab" aria-selected={tab === value} onClick={() => { setTab(value); setKind(''); }} className={`rounded-xl px-4 py-2 text-sm font-bold ${tab === value ? 'bg-saudi-green-900 text-white' : 'bg-gray-100 text-gray-700'}`}>{({ library: 'مكتبة القوالب', mine: 'تصاميمي', favorites: 'المفضلة', manage: 'إدارة القوالب' })[value]}</button>)}
        </div>
        {canEdit && <label className="flex items-center gap-2 cursor-pointer rounded-xl border px-3 py-2 text-sm"><Upload size={16} /> استيراد قالب JSON<input aria-label="استيراد قالب JSON" type="file" accept=".json,application/json" className="sr-only" onChange={e => { void importTemplate(e.target.files?.[0]); e.target.value = ''; }} /></label>}
      </div>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <Field label="البحث"><div className="relative"><Search className="absolute left-2 top-3 text-gray-500" size={16} /><input className={fieldClass} placeholder="اسم القالب" value={search} onChange={e => setSearch(e.target.value)} /></div></Field>
        <Field label="المناسبة"><select className={fieldClass} value={kind} onChange={e => setKind(e.target.value as OccasionKind | '')}><option value="">كل المناسبات</option>{Object.entries(OCCASIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
        <Field label="الفئة"><select className={fieldClass} value={audience} onChange={e => setAudience(e.target.value)}><option value="">رجال ونساء</option>{Object.entries(AUDIENCES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
        <Field label="الأسلوب"><select className={fieldClass} value={style} onChange={e => setStyle(e.target.value)}><option value="">كل الأساليب</option>{Object.entries(STYLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
        <Field label="الألوان"><select className={fieldClass} value={color} onChange={e => setColor(e.target.value)}><option value="">كل الألوان</option>{['فاتح', 'داكن', 'ملون'].map(c => <option key={c}>{c}</option>)}</select></Field>
      </div>
      <p className="text-xs text-gray-500">{visible.length} قالب متاح</p>
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[560px] overflow-y-auto p-1">
        {visible.map(t => <article key={t.id} className="rounded-2xl border border-gray-200 p-2 space-y-2">
          <button className="w-full hover:opacity-90 focus-visible:ring-2 focus-visible:ring-saudi-green-800 rounded-xl" onClick={() => selectTemplate(t)} aria-label={`اختيار ${t.name}`}><Preview design={cardOf(t)} small /></button>
          <div className="flex items-start justify-between gap-1"><div><h4 className="font-bold text-sm break-words">{t.name}</h4><p className="text-xs text-gray-500">{OCCASIONS[t.occasion]} · {STYLES[t.style]}{t.audience ? ` · ${AUDIENCES[t.audience]}` : ''}</p>{libraryOf(t) && <p className="text-caption2 text-gray-400"><span dir="ltr">{libraryOf(t)!.nameEn}</span> · {COLLECTIONS[libraryOf(t)!.collection]}</p>}</div><button disabled={!canEdit} aria-label={`إضافة ${t.name} إلى المفضلة`} aria-pressed={favorites.includes(t.id)} onClick={() => void run(async () => { const selected = !favorites.includes(t.id); await requestJSON('/api/invitation-studio', 'POST', { action: 'favorite', templateId: t.id, selected }); setFavorites(f => selected ? [...f, t.id] : f.filter(id => id !== t.id)); })} className="p-2 rounded-lg hover:bg-rose-50 disabled:opacity-40"><Heart size={16} className={favorites.includes(t.id) ? 'fill-rose-500 text-rose-500' : 'text-gray-500'} /></button></div>
          {t.ownerId !== 'system' && <p className="text-xs text-gray-500">{statusNames[t.status]} · الإصدار {t.version}</p>}
          {t.reviewNote && <p className="text-xs text-amber-800">ملاحظة المراجعة: {t.reviewNote}</p>}
          <button disabled={!canEdit} onClick={() => selectTemplate(t)} className="w-full bg-saudi-sand-100 rounded-lg py-2 text-xs disabled:opacity-40">{t.ownerId === userId && ['private', 'rejected'].includes(t.status) ? 'فتح وتعديل' : 'استخدام نسخة'}</button>
          {t.ownerId === userId && ['private', 'rejected'].includes(t.status) && <button disabled={busy} onClick={() => void transition(t, 'pending')} className="w-full border rounded-lg py-2 text-xs">إرسال للمراجعة</button>}
          {isAdmin && t.status === 'pending' && <div className="space-y-2"><input aria-label={`ملاحظة مراجعة ${t.name}`} className={fieldClass} maxLength={240} placeholder="سبب طلب التعديل" value={reviewNotes[t.id] || ''} onChange={e => setReviewNotes(n => ({ ...n, [t.id]: e.target.value }))} /><div className="flex gap-2"><button disabled={busy} onClick={() => void transition(t, 'published')} className="flex-1 text-green-800 bg-green-50 p-2 rounded-lg text-xs"><Check size={14} className="inline" /> نشر</button><button disabled={busy} onClick={() => void transition(t, 'rejected')} className="flex-1 bg-amber-50 p-2 rounded-lg text-xs"><X size={14} className="inline" /> تعديل</button></div></div>}
          {t.ownerId !== 'system' && t.status !== 'archived' && (isAdmin || (t.ownerId === userId && ['private', 'rejected'].includes(t.status))) && <button disabled={busy} onClick={() => void transition(t, 'archived')} className="flex items-center gap-1 text-xs text-gray-500 p-1"><Archive size={13} /> أرشفة القالب</button>}
        </article>)}
      </div>
      {!visible.length && <p className="text-center py-8 text-sm text-gray-500">لا توجد قوالب هنا. غيّر الفلاتر أو احفظ تصميمك الأول.</p>}
    </section>
    <div className="grid lg:grid-cols-2 gap-6 items-start">
      <section aria-label="تخصيص البطاقة" className="bg-white rounded-3xl border border-gray-200 p-5 space-y-5">
        <h4 className="font-bold flex gap-2 items-center"><Palette size={18} /> تخصيص تصميمك</h4>
        {!canEdit && <p className="text-sm text-amber-800">سجّل الدخول لتخصيص التصميم وحفظه.</p>}
        <fieldset disabled={!canEdit} className="space-y-4 disabled:opacity-60">
          <Field label="اسم التصميم في المكتبة"><input className={fieldClass} maxLength={80} value={name} onChange={e => setName(e.target.value)} /></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="نوع المناسبة"><select className={fieldClass} value={templateKind} onChange={e => setTemplateKind(e.target.value as OccasionKind)}>{Object.entries(OCCASIONS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field><Field label="تصنيف الأسلوب"><select className={fieldClass} value={templateStyle} onChange={e => setTemplateStyle(e.target.value as InviteTemplate['style'])}>{Object.entries(STYLES).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field></div>
          <div className="rounded-2xl bg-saudi-sand-50 p-3 space-y-2"><p className="text-xs font-bold flex items-center gap-1"><Sparkles size={15} /> تنسيقات مقترحة لـ{OCCASIONS[templateKind]}</p><div className="flex flex-wrap gap-2">{suggestions.map(t => <button key={t.id} title={t.name} aria-label={`تطبيق ألوان وزخارف ${t.name}`} onClick={() => { patch({ background: t.design.background, foreground: t.design.foreground, accent: t.design.accent, motif: t.design.motif, image: '' }); setTemplateStyle(t.style); }} className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5 text-xs">{[t.design.background, t.design.accent].map((c, i) => <span key={i} style={{ background: c }} className="w-3 h-3 rounded-full border" />)}{t.name}</button>)}</div><p className="text-xs text-gray-500">اقتراحات منسّقة حسب المناسبة؛ تطبّق الألوان والزخارف مع الاحتفاظ بنصوصك.</p>
            {active && <div className="space-y-2 border-t pt-2"><p className="text-xs font-bold">ألوان {active.name}</p><div className="flex flex-wrap gap-2">{active.palettes.map(pal => <button key={pal.name} type="button" aria-label={`تطبيق لوحة ${pal.name}`} onClick={() => patch({ background: pal.background, foreground: pal.foreground, accent: pal.accent })} className="flex items-center gap-1 rounded-lg border bg-white px-2 py-1.5 text-xs">{[pal.background, pal.accent, pal.foreground].map((c, i) => <span key={i} style={{ background: c }} className="w-3 h-3 rounded-full border" />)}{pal.name}</button>)}</div>
              <button type="button" onClick={() => { patch({ layout: active.design.layout, motif: active.design.motif, font: active.design.font, size: active.design.size, titleSize: active.design.titleSize, align: active.design.align, background: active.design.background, foreground: active.design.foreground, accent: active.design.accent, imageOpacity: active.design.imageOpacity }); setNotice('أُعيد مظهر القالب الأصلي؛ بقيت بياناتك ونصوصك كما هي.'); }} className="text-xs underline">استعادة مظهر القالب الأصلي (دون فقدان بياناتك)</button></div>}</div>
          <div className="rounded-2xl border border-saudi-sand-300 p-3 space-y-3"><p className="text-xs font-bold">بيانات الدعوة · تظهر مباشرة في المعاينة، والحقول الفارغة تختفي من البطاقة</p>
            <div className="grid grid-cols-2 gap-3">
              <Field label="اسم العريس"><input className={fieldClass} maxLength={160} value={design.groom} onChange={e => patch({ groom: e.target.value })} /></Field>
              <Field label="اسم العروس"><input className={fieldClass} maxLength={160} value={design.bride} onChange={e => patch({ bride: e.target.value })} /></Field>
              <Field label="الداعي / العائلة"><input className={fieldClass} maxLength={160} value={design.host} onChange={e => patch({ host: e.target.value })} /></Field>
              <Field label="البسملة أو عبارة الافتتاح"><input className={fieldClass} maxLength={80} value={design.invocation} onChange={e => patch({ invocation: e.target.value })} /></Field>
              <Field label="التاريخ الهجري"><div className="flex gap-2"><input className={fieldClass} maxLength={160} value={design.hijri} onChange={e => patch({ hijri: e.target.value })} /><button type="button" className="shrink-0 rounded-xl border px-2 text-xs" onClick={() => { const value = hijriOf(design.date); if (value) patch({ hijri: value }); else setNotice('اكتب التاريخ الميلادي بصيغة 2027-06-12 ليُحوَّل تلقائياً.'); }}>تلقائي</button></div></Field>
              <Field label="العنوان التفصيلي"><input className={fieldClass} maxLength={160} value={design.address} onChange={e => patch({ address: e.target.value })} /></Field>
              <Field label="آخر موعد لتأكيد الحضور"><input className={fieldClass} maxLength={160} value={design.rsvpBy} placeholder="2027-06-01" onChange={e => patch({ rsvpBy: e.target.value })} /></Field>
              <Field label="للتواصل"><input className={fieldClass} dir="ltr" maxLength={160} value={design.contact} onChange={e => patch({ contact: e.target.value })} /></Field>
            </div></div>
          {(['opening', 'title', 'closing', 'venue'] as const).map(key => <Field key={key} label={{ opening: 'عبارة الدعوة', title: 'العنوان وأسماء المحتفى بهم', closing: 'عبارة الختام', venue: 'الموقع والقاعة' }[key]}><textarea rows={key === 'opening' ? 2 : 1} className={fieldClass} maxLength={key === 'title' ? 100 : 240} value={design[key]} onChange={e => patch({ [key]: e.target.value })} /></Field>)}
          <div className="grid grid-cols-2 gap-3"><Field label="التاريخ"><input className={fieldClass} maxLength={80} value={design.date} onChange={e => patch({ date: e.target.value })} /></Field><Field label="الوقت"><input className={fieldClass} maxLength={80} value={design.time} onChange={e => patch({ time: e.target.value })} /></Field></div>
          <div className="grid grid-cols-3 gap-3">{(['background', 'foreground', 'accent'] as const).map(key => <Field key={key} label={{ background: 'الخلفية', foreground: 'النص', accent: 'العنوان والزخارف' }[key]}><input type="color" className="w-full h-10 rounded-lg border cursor-pointer" value={design[key]} onChange={e => patch({ [key]: e.target.value })} /></Field>)}</div>
          {(contrastRatio(design.background, design.foreground) < 4.5 || contrastRatio(design.background, design.accent) < 3) && <p className="text-xs text-amber-800">تباين الألوان منخفض؛ اختر نصاً وعنواناً أوضح أو طبّق تنسيقاً مقترحاً.</p>}
          <div className="grid grid-cols-2 gap-3"><Field label="الخط"><select className={fieldClass} value={design.font} onChange={e => patch({ font: e.target.value as CardDesign['font'] })}><option value="serif">كلاسيكي — Serif</option><option value="sans-serif">عصري — Sans Serif</option></select></Field><Field label="الزخارف"><select className={fieldClass} value={design.motif} onChange={e => patch({ motif: e.target.value as CardDesign['motif'] })}>{Object.entries(MOTIFS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field></div>
          <Field label="تخطيط البطاقة"><select className={fieldClass} value={design.layout} onChange={e => patch({ layout: e.target.value as CardDesign['layout'] })}>{Object.entries(LAYOUTS).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></Field>
          <div className="grid grid-cols-2 gap-3"><Field label="محاذاة النص"><select className={fieldClass} value={design.align} onChange={e => patch({ align: e.target.value as CardDesign['align'] })}><option value="center">وسط</option><option value="right">يمين</option></select></Field><Field label="المقاس"><select className={fieldClass} value={design.size} onChange={e => patch({ size: e.target.value as CardDesign['size'] })}>{Object.entries(SIZES).map(([id, value]) => <option key={id} value={id}>{value.label}</option>)}</select></Field></div>
          <Field label={`حجم العنوان · ${design.titleSize}`}><input type="range" min={26} max={64} value={design.titleSize} onChange={e => patch({ titleSize: Number(e.target.value) })} className="w-full accent-green-800" /></Field>
          <Field label="توزيع مجموعة النصوص عمودياً"><input type="range" min={-80} max={80} value={design.offset} onChange={e => patch({ offset: Number(e.target.value) })} className="w-full accent-green-800" /></Field>
          <Field label="صورة الخلفية · PNG / JPEG / WebP حتى 800 كيلوبايت"><input type="file" accept="image/png,image/jpeg,image/webp" className="w-full text-xs" onChange={e => { void uploadImage(e.target.files?.[0]); e.target.value = ''; }} /></Field>
          {design.image && <><Field label="شفافية صورة الخلفية"><input type="range" min={0} max={0.6} step={0.05} value={design.imageOpacity} onChange={e => patch({ imageOpacity: Number(e.target.value) })} className="w-full" /></Field><button onClick={() => patch({ image: '' })} className="text-xs text-red-700">إزالة الصورة</button></>}
          <div className="grid grid-cols-2 gap-2"><button disabled={busy} onClick={() => void save()} className="bg-saudi-green-900 text-white rounded-xl py-3 text-sm flex justify-center items-center gap-2 disabled:opacity-50"><Save size={16} /> حفظ التصميم</button><button disabled={busy} onClick={() => void save(true)} className="border rounded-xl py-3 text-sm flex justify-center items-center gap-2 disabled:opacity-50"><Copy size={16} /> حفظ نسخة جديدة</button></div>
        </fieldset>
      </section>
      <section aria-label="المعاينة والتصدير" className="lg:sticky lg:top-24 space-y-4">
        <div className="flex justify-between items-center"><h4 className="font-bold">معاينة مباشرة</h4><span className="text-xs text-gray-500">{SIZES[design.size].label}</span></div>
        <div className="bg-[#eae7e1] rounded-3xl p-5 sm:p-8"><div className="max-w-sm mx-auto"><Preview design={design} qrValue={includeQr ? rsvpUrl : ''} /></div></div>
        <div className="bg-white border rounded-2xl p-4 space-y-3"><p className="text-sm font-bold">التصدير والمشاركة</p>
          <Field label="عنوان الموقع للمشاركة من الهاتف"><div className="flex gap-2"><input type="url" dir="ltr" className={fieldClass} value={originInput} placeholder="https://example.com" onChange={e => setOriginInput(e.target.value)} /><button className="rounded-xl border px-3 text-xs" onClick={() => void run(() => { const origin = normalizeInvitationOrigin(originInput.trim()); setShareOrigin(origin); setOriginInput(origin); setNotice('تم تحديث عنوان المشاركة؛ تابع حالة حفظ المسودة.'); })}>تطبيق</button></div></Field>
          {shareOrigin && ['localhost', '127.0.0.1', '[::1]'].includes(new URL(shareOrigin).hostname) && <p className="text-xs text-amber-800">للمسح من الهاتف، أدخل عنوان الموقع المنشور أو عنوان هذا الجهاز على الشبكة. localhost يشير إلى الهاتف نفسه.</p>}
          {linkError && <p role="alert" className="text-xs text-red-700">{linkError}</p>}
          <label className="flex gap-2 items-center text-xs"><input type="checkbox" checked={includeQr} onChange={e => setIncludeQr(e.target.checked)} /> تضمين QR حقيقي في البطاقة والتصدير</label>
          <div className="flex flex-col items-center gap-2 rounded-xl bg-gray-50 p-3"><InvitationQRCode value={rsvpUrl} className="w-64 h-64 max-w-full" /><span className="text-xs text-gray-500">امسح لفتح الدعوة</span><div className="flex gap-3"><a href={rsvpUrl} target="_blank" rel="noopener noreferrer" className="text-xs underline text-green-800">فتح الدعوة</a><button disabled={!rsvpUrl || busy} className="text-xs underline text-green-800" onClick={() => void run(() => downloadFile(new Blob([qrSvg(rsvpUrl)], { type: 'image/svg+xml;charset=utf-8' }), 'invitation-qr.svg'))}>تنزيل QR</button></div></div>
        <div className="grid grid-cols-2 gap-2">
          <button disabled={busy} onClick={() => void run(async () => { downloadFile(await pngBlob(design, includeQr ? rsvpUrl : ''), 'invitation.png'); setNotice('تم تصدير PNG بالمقاس المحدد.'); })} className="rounded-xl border p-2 text-xs flex justify-center gap-2"><Download size={15} /> صورة PNG</button>
          <button disabled={busy} onClick={() => void run(() => downloadFile(new Blob([cardSvg(design, includeQr ? rsvpUrl : '')], { type: 'image/svg+xml;charset=utf-8' }), 'invitation.svg'))} className="rounded-xl border p-2 text-xs flex justify-center gap-2"><Download size={15} /> ملف SVG</button>
          <button disabled={busy} onClick={() => void run(() => printCard(design, includeQr ? rsvpUrl : ''))} className="rounded-xl border p-2 text-xs flex justify-center gap-2"><Printer size={15} /> طباعة / حفظ PDF</button>
          <button disabled={busy} onClick={() => void run(exportJson)} className="rounded-xl border p-2 text-xs flex justify-center gap-2"><Download size={15} /> قالب قابل للتعديل</button>
          <button disabled={busy} onClick={() => void shareFile()} className="rounded-xl bg-saudi-green-900 text-white p-2 text-xs flex justify-center gap-2"><Share2 size={15} /> مشاركة البطاقة</button>
          <button disabled={busy || !rsvpUrl} onClick={() => void run(async () => { await navigator.clipboard.writeText(rsvpUrl); setNotice('تم نسخ رابط الدعوة القابل للفتح من متصفح آخر.'); })} className="rounded-xl border p-2 text-xs flex justify-center gap-2"><Copy size={15} /> رابط الحضور</button>
        </div><a href={`https://wa.me/?text=${encodeURIComponent(`${design.opening}\n${design.title}\n${design.date} ${design.time}\n${design.venue}\n${rsvpUrl}`)}`} target="_blank" rel="noopener noreferrer" className="block text-center text-xs text-green-800 underline">مشاركة نص الدعوة ورابط الحضور عبر واتساب</a><p className="text-xs text-gray-500">A5: ملف PNG بقياس 1748 × 2480 بكسل للطباعة عند نحو 300 نقطة/بوصة. لحفظ PDF، اختر «حفظ كـ PDF» من نافذة الطباعة. اترك هوامش الأمان ظاهرة وراجع المعاينة قبل الإرسال.</p></div>
      </section>
    </div>
    <details className="bg-white rounded-2xl border p-4 text-sm"><summary className="cursor-pointer font-bold">صلاحيات المستخدمين وآلية إدارة القوالب</summary><div className="space-y-2 pt-3 text-gray-600"><p>الزائر: استعراض القوالب المنشورة. المستخدم المسجّل: التخصيص والرفع والحفظ والمفضلة والتصدير؛ تعديل تصاميمه الخاصة وإرسالها للمراجعة.</p><p>الإدارة: مراجعة القوالب المرسلة، نشرها، طلب التعديل مع توضيح السبب، وأرشفة القوالب. القوالب المنشورة تُستخدم كنسخ مستقلة لحماية الأصل.</p><p>دورة القالب: خاص ← بانتظار المراجعة ← منشور أو يحتاج تعديلاً. التعديل يعيد القالب إلى خاص ويزيد رقم الإصدار؛ الأرشفة تخفيه من المكتبة. تتحقق صلاحيات الملكية والمراجعة على الخادم، وتُرفض التعديلات المتعارضة بين الأجهزة.</p></div></details>
  </div>;
}
