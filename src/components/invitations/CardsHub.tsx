'use client';

import Link from 'next/link';
import { MailCheck, Palette, Store } from 'lucide-react';
import Storefront from '@/components/commerce/Storefront';
import InvitationCalculator from '@/components/invitations/InvitationCalculator';
import { useT } from '@/components/i18n/LocaleProvider';
import { BUILTIN_TEMPLATES } from '@/lib/invitations/catalog';
import { LIBRARY_TEMPLATES } from '@/lib/invitations/library';

/** The direct "digital cards and invitations" service: no occasion is needed to order from vendors or to design a card yourself. */
export default function CardsHub() {
  const t = useT();
  const count = LIBRARY_TEMPLATES.length + BUILTIN_TEMPLATES.length;
  return (
    <div className="max-w-6xl mx-auto p-4 sm:p-8 space-y-8">
      <header className="rounded-3xl bg-saudi-green-950 text-white p-6 sm:p-10 space-y-3">
        <span className="inline-flex items-center gap-2 text-xs text-saudi-gold-300"><MailCheck className="w-4 h-4" />{t('خدمة مباشرة')}</span>
        <h1 className="text-2xl sm:text-3xl font-black font-cairo">{t('بطاقات ودعوات رقمية')}</h1>
        <p className="text-sm text-white/80 max-w-2xl">{t('اطلب تصميم بطاقتك من موردين معتمدين أو صمّمها بنفسك. لا تحتاج إلى إنشاء مناسبة أو اختيارها أولاً.')}</p>
      </header>

      <section aria-label={t('طرق الحصول على البطاقة')} className="grid gap-4 sm:grid-cols-2">
        <a href="#vendors" className="rounded-3xl border border-gray-200 bg-white p-6 space-y-2 hover:border-saudi-green-800 transition">
          <Store className="w-7 h-7 text-saudi-green-800" />
          <h2 className="font-bold text-lg">{t('اطلب من الموردين')}</h2>
          <p className="text-sm text-gray-600">{t('قارن عروض مصممي البطاقات، أضف الخدمة إلى السلة وادفع مباشرة.')}</p>
        </a>
        <Link href="/invitations/design" className="rounded-3xl border border-gray-200 bg-white p-6 space-y-2 hover:border-saudi-green-800 transition">
          <Palette className="w-7 h-7 text-saudi-gold-600" />
          <h2 className="font-bold text-lg">{t('صمّم بطاقتك بنفسك')}</h2>
          <p className="text-sm text-gray-600">{count} {t('قالباً جاهزاً للتخصيص، مع رمز QR، وتنزيل وطباعة ومشاركة مباشرة.')}</p>
        </Link>
      </section>

      <InvitationCalculator />

      <section id="vendors" aria-label={t('خدمات البطاقات من الموردين')} className="space-y-4 scroll-mt-24">
        <h2 className="text-xl font-black font-cairo text-saudi-green-950">{t('خدمات البطاقات والدعوات من الموردين')}</h2>
        <Storefront initialCategory="invitations" />
      </section>
    </div>
  );
}
