'use client';

import React from 'react';
import Link from '@/components/system/FeatureLink';
import { Sparkles, ShieldCheck, CreditCard, Phone, Mail, Award, HeartHandshake } from 'lucide-react';
import { useApp } from '@/lib/store';
import { useT, useLocale, usePick } from '@/components/i18n/LocaleProvider';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';

export default function Footer() {
  const t = useT(); const pick = usePick();
  const { locale } = useLocale();
  const { adminConfig, cities } = useApp();

  return (
    <footer className="bg-saudi-green-950 text-white pt-12 pb-24 lg:pb-12 border-t border-saudi-green-800">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Value Props Bar */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-10 border-b border-saudi-green-800/80">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/10 border border-saudi-gold-500/30 flex items-center justify-center text-saudi-gold-400 shrink-0">
              <Sparkles className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-saudi-gold-200">{t('تخطيط ذكي وسريع')}</h4>
              <p className="text-xs text-gray-400">{t('بناء خطة المناسبة وتوزيع الميزانية في دقيقتين')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/10 border border-saudi-gold-500/30 flex items-center justify-center text-saudi-gold-400 shrink-0">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-saudi-gold-200">{t('حماية وحجز موثوق')}</h4>
              <p className="text-xs text-gray-400">{t('موردين معتمدين بسجلات تجارية ووثائق عمل حر')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/10 border border-saudi-gold-500/30 flex items-center justify-center text-saudi-gold-400 shrink-0">
              <CreditCard className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-saudi-gold-200">{t('الدفع بعد تأكيد المورد')}</h4>
              <p className="text-xs text-gray-400">{t('لا يُحصَّل أي مبلغ قبل موافقة المورد على طلبك')}</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/10 border border-saudi-gold-500/30 flex items-center justify-center text-saudi-gold-400 shrink-0">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-saudi-gold-200">{t('كرم الضيافة والأصالة')}</h4>
              <p className="text-xs text-gray-400">{t('فهم عميق للتقاليد والتفاصيل الثقافية السعودية')}</p>
            </div>
          </div>
        </div>

        {/* Main Footer Links */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-8 py-10">
          {/* Col 1: Brand info */}
          <div className="col-span-2 space-y-3">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-saudi-gold-500 flex items-center justify-center text-saudi-green-950 font-black shadow-md">
                <Sparkles className="w-5 h-5" />
              </div>
              <span className="text-2xl font-black font-cairo text-saudi-gold-400">
                {locale === 'en' ? 'Munasbti' : adminConfig.platformNameAr}
              </span>
            </div>
            <p className="text-xs text-gray-300 leading-relaxed max-w-sm">
              {t('المنصة السعودية الرائدة لتنظيم وحجز وإدارة المناسبات الخاصة والاجتماعية. من الفكرة وحتى آخر ضيف — كل مناسبتك في مكان واحد.')}
            </p>
            <div className="flex items-center gap-4 text-xs text-saudi-gold-300 pt-2">
              <div className="flex items-center gap-1">
                <Phone className="w-3.5 h-3.5" />
                <span>{t('الرقم الموحد:')} {adminConfig.emergencyPhone}</span>
              </div>
              <div className="flex items-center gap-1">
                <Mail className="w-3.5 h-3.5" />
                <span>support@munasbti.biz</span>
              </div>
            </div>
          </div>

          {/* Col 2: Occasions */}
          <div>
            <h4 className="text-sm font-bold text-saudi-gold-400 mb-3">{t('المناسبات')}</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li><Link href="/marketplace?cat=wedding" className="hover:text-saudi-gold-300">{t('أعراس وزفاف')}</Link></li>
              <li><Link href="/marketplace?cat=melka" className="hover:text-saudi-gold-300">{t('ملكة وعقد قران')}</Link></li>
              <li><Link href="/marketplace?cat=graduation" className="hover:text-saudi-gold-300">{t('حفلات تخرج')}</Link></li>
              <li><Link href="/marketplace?cat=newborn" className="hover:text-saudi-gold-300">{t('استقبال مولود')}</Link></li>
              <li><Link href="/marketplace?cat=national_day" className="hover:text-saudi-gold-300">{t('اليوم الوطني والتأسيس')}</Link></li>
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('مناسبات خاصة')}</Link></li>
            </ul>
          </div>

          {/* Col 3: Services */}
          <div>
            <h4 className="text-sm font-bold text-saudi-gold-400 mb-3">{t('الخدمات والتجهيزات')}</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('قاعات ومواقع فاخرة')}</Link></li>
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('ضيافة وبوفيهات وصبابين')}</Link></li>
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('كوش وديكور وتنسيق ورد')}</Link></li>
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('تصوير وتوثيق سينمائي')}</Link></li>
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('عرضة سعودية وفنون')}</Link></li>
              <li><Link href="/marketplace" className="hover:text-saudi-gold-300">{t('توزيعات وهدايا ضيوف')}</Link></li>
            </ul>
          </div>

          {/* Col 4: Portals */}
          <div>
            <h4 className="text-sm font-bold text-saudi-gold-400 mb-3">{t('المنصة والخدمات')}</h4>
            <ul className="space-y-2 text-xs text-gray-300">
              <li><Link href="/calculator" className="hover:text-saudi-gold-300 font-bold text-saudi-gold-200">{t('حاسبة ميزانية المناسبات')}</Link></li>
              <li><Link href="/zaffah" className="hover:text-saudi-gold-300 font-bold text-saudi-gold-200">{t('الزفات والفنون الشعبية')}</Link></li>
              <li><Link href="/bookings" className="hover:text-saudi-gold-300">{t('حجوزاتي وفواتيري ZATCA')}</Link></li>
              <li><Link href="/vendor" className="hover:text-saudi-gold-300">{t('بوابة مزودي الخدمات')}</Link></li>
              <li><Link href="/admin" className="hover:text-saudi-gold-300">{t('لوحة الإدارة العامة')}</Link></li>
              <li><Link href="/rfq" className="hover:text-saudi-gold-300">{t('طلب عروض أسعار (RFQ)')}</Link></li>
              <li><Link href="/inspiration" className="hover:text-saudi-gold-300">{t('معرض الإلهام')}</Link></li>
              <li><Link href="/scan" className="hover:text-saudi-gold-300">{t('ماسح كود QR للدخول')}</Link></li>
            </ul>
          </div>
        </div>

        {/* Launch Cities Bar */}
        <div className="py-4 border-t border-b border-saudi-green-900 text-xs text-gray-400 flex flex-wrap items-center gap-x-4 gap-y-2 justify-center">
          <span className="text-saudi-gold-400 font-bold">{t('المدن المتاحة بالمملكة:')}</span>
          {cities.map((city, idx) => (
            <span key={city.id}>
              {pick(city.nameAr, city.nameEn)}
              {idx < cities.length - 1 && <span className="text-saudi-green-700 mr-4">•</span>}
            </span>
          ))}
        </div>

        {/* Bottom copyright & payment methods badge */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-gray-400">
          <p>© 2026 {locale === 'en' ? 'Munasbti' : adminConfig.platformNameAr}{t('. جميع الحقوق محفوظة في المملكة العربية السعودية 🇸🇦')}</p>
          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <span className="bg-saudi-gold-500/20 text-saudi-gold-300 px-2 py-0.5 rounded text-caption2">{t('الأسعار تشمل ضريبة القيمة المضافة 15%')}</span>
          </div>
        </div>
      </div>
    </footer>
  );
}
