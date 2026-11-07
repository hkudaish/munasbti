'use client';

import { FeatureContent } from '@/components/system/FeatureProvider';
import React, { useState } from 'react';
import Link from '@/components/system/FeatureLink';
import { useRouter } from 'next/navigation';
import {
  Sparkles,
  PlusCircle,
  Calendar,
  Layers,
  ShoppingBag,
  Store,
  Star,
  MapPin,
  ShieldCheck,
  Zap,
  ArrowRight,
  HeartHandshake,
  CheckCircle2,
  ChevronLeft,
  Search,
  Users,
  DollarSign,
  Coffee,
  Building2,
  Camera,
  Music,
  Gift,
  Palette,
  Clock,
  TrendingUp,
  FileText,
  Award,
  AlertCircle,
  Eye,
  Settings,
  CreditCard,
  ChevronDown,
  Check,
} from 'lucide-react';
import dynamic from 'next/dynamic';
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import ServiceCard from '@/components/marketplace/ServiceCard';
import PackageCard from '@/components/marketplace/PackageCard';
import CustomerReviewsShowcase from '@/components/common/CustomerReviewsShowcase';
import PublicStatistics from '@/components/common/PublicStatistics';
import { ServiceItem, SmartPackage, UserRole } from '@/lib/types';
import { useT, useLocale, usePick } from '@/components/i18n/LocaleProvider';

// Supplier and admin dashboards are separate chunks: customers, the majority of visitors, never download them.
const HomeVendorView = dynamic(() => import('@/components/home/HomeVendorView'));
const HomeAdminView = dynamic(() => import('@/components/home/HomeAdminView'));

export default function HomePage() {
  const t = useT(); const pick = usePick();
  const router = useRouter();
  const { localize } = useLocale();
  const {
    currentRole,
    currentUser,
    switchRole,
    openOnboarding,
    adminConfig,
    occasionTypes,
    serviceCategories,
    packages,
    services,
    vendors,
    bookings,
    rfqRequests,
    inspirationPosts,
    setIsAIOpen,
    selectedCity,
    cities,
    activeOccasion,
    updateVendorStatus,
    cart,
  } = useApp();

  // Client selected service category filter
  const [clientCategoryFilter, setClientCategoryFilter] = useState<string>('all');

  // Vendor view mode on homepage
  const [vendorServiceView, setVendorServiceView] = useState<'my_services' | 'market_comparison'>('my_services');

  // Admin approval toast simulation
  const [adminActionNotice, setAdminActionNotice] = useState<string | null>(null);

  const activeCityObj = cities.find((c) => c.id === selectedCity) || {id:'',nameAr:t('مدينتك'),nameEn:'',regionAr:'',isAvailable:false};

  // Booking happens in the commerce flow (offers, packages, server-priced cart), not in a local modal.
  const handleBookService = (service: ServiceItem) => {
    router.push(localize('/commerce/service/' + encodeURIComponent(service.id)));
  };

  const handleBookPackage = (_pkg: SmartPackage) => {
    router.push(localize('/packages'));
  };

  // Filtered services for client based on active category
  const clientFilteredServices = services.filter((srv) => {
    const matchesCategory = clientCategoryFilter === 'all' || srv.categoryId === clientCategoryFilter;
    const matchesCity = !selectedCity || srv.cityId === selectedCity;
    return matchesCategory && matchesCity;
  });

  // Calculate platform metrics for admin view
  const totalBookingsAmount = bookings.reduce((sum, b) => sum + (b.totalAmount || 0), 0);
  const pendingVendors = vendors.filter((v) => !v.verified || v.status === 'under_review');
  const openRFQs = rfqRequests.filter((r) => r.status === 'open');

  return (
    <div className="space-y-12 pb-20">
      {/* =========================================================================
          ROLE CONTEXT & FILTER BAR (عرض مخصص حسب نوع الحساب النشط)
      ========================================================================= */}
      {currentRole !== 'client' && (
      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-4">
        <div className="bg-saudi-green-950 border border-saudi-gold-500/30 rounded-2xl p-3.5 sm:p-4 text-white shadow-lg flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-saudi-gold-500/20 border border-saudi-gold-400/40 flex items-center justify-center shrink-0">
              {currentRole === 'vendor' && <Store className="w-5 h-5 text-saudi-gold-300" />}
              {currentRole === 'admin' && <ShieldCheck className="w-5 h-5 text-saudi-gold-300" />}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs text-saudi-gold-300 font-bold uppercase tracking-wider">
                  {t('طريقة العرض المخصصة حالياً:')}
                </span>
                <span className="inline-block px-2.5 py-0.5 rounded-full text-xs font-bold bg-saudi-gold-500 text-saudi-green-950 shadow-sm">
                  {currentRole === 'vendor' && t('مورد ومزود خدمات معتمد')}
                  {currentRole === 'admin' && t('إدارة المنصة المركزية')}
                </span>
                {currentUser && (
                  <span className="text-xs text-gray-300 hidden sm:inline">
                    {t('• مسجل باسم:')} <strong className="text-white font-bold">{currentUser.name}</strong>
                  </span>
                )}
              </div>
              <p className="text-xs text-gray-300 mt-0.5 font-tajawal">
                {currentRole === 'vendor' && t('يتم عرض فرص طلبات التسعير (RFQs)، إدارة الخدمات، جدول الحجوزات، وأدوات نمو المورد.')}
                {currentRole === 'admin' && t('يتم عرض مؤشرات أداء المنصة، طلبات توثيق السجلات، تدقيق الخدمات، وسجل المعاملات.')}
              </p>
            </div>
          </div>
        </div>
      </section>
      )}

      {/* =========================================================================
          VIEW A: CUSTOMER / CLIENT (صاحب المناسبة)
      ========================================================================= */}
      {currentRole === 'client' && (
        <div className="space-y-16 animate-fadeIn">
          {/* 1. Client Hero Section */}
          <section className="relative bg-saudi-green-950 text-white pt-12 pb-20 px-4 sm:px-6 lg:px-8 overflow-hidden">

            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 text-saudi-gold-300 text-sm font-bold">
                <Sparkles className="w-4 h-4 text-saudi-gold-400" />
                <span>
                  {currentUser
                    ? t('أهلاً بك يا {name} • مساحة تخطيط مناسبتك الذكية', { name: currentUser.name })
                    : t('المنصة السعودية الذكية الأولى لتنظيم والاحتفال بالمناسبات')}
                </span>
              </div>

              <div className="max-w-5xl space-y-4">
                <h1 className="text-3xl sm:text-5xl lg:text-6xl font-black font-cairo leading-tight text-white">
                  {t('خططها. احجزها. اعزمهم.')}{' '}
                  <span className="block text-saudi-gold-300">
                    {t('واحتفل بأجمل اللحظات.')}
                  </span>
                </h1>
                <p className="text-sm sm:text-base text-gray-300 leading-relaxed max-w-2xl font-tajawal">
                  {t('من الفكرة وحتى آخر ضيف — كل تجهيزات مناسبتك في مكان واحد: قاعات، ضيافة سعودية، كوش وتنسيق، مصورين، باقات جاهزة، وطلب موثّق يؤكده المورد.')}
                </p>
              </div>

              {/* Client Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/plan"
                  className="px-6 py-3.5 bg-saudi-gold-500 hover:bg-saudi-gold-400 text-saudi-green-950 font-bold rounded-2xl text-base flex items-center gap-2 active:scale-[0.98] transition"
                >
                  <PlusCircle className="w-5 h-5 text-saudi-green-950" />
                  <span>{t('+ ابدأ تخطيط مناسبتك')}</span>
                </Link>

                <Link
                  href="/rfq"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 text-white font-bold rounded-2xl text-base flex items-center gap-2 transition"
                >
                  <FileText className="w-4 h-4 text-saudi-gold-300" />
                  <span>{t('اطلب عروض أسعار (RFQ)')}</span>
                </Link>
              </div>

              {/* Trust stats row */}
              <div className="pt-6 grid grid-cols-2 sm:grid-cols-4 gap-4 text-xs text-gray-300">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('موردين موثقين بسجلات رسمية')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <Zap className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('أسعار واضحة قبل الطلب، والمورد يؤكد الحجز')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('تغطية في')} {cities.length} {t('مدن سعودية')}</span>
                </div>
                <div className="flex items-center gap-2">
                  <HeartHandshake className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('دفع مجزأ (عربون + متبقي عند التنفيذ)')}</span>
                </div>
              </div>
            </div>
          </section>

          {/* 2. Client Active Planning Strip (إذا كان لديه مناسبة أو عناصر في السلة) */}
          {activeOccasion && (
            <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-saudi-sand-100 border border-saudi-gold-400/30 rounded-2xl p-5 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-caption2 font-bold px-2 py-0.5 rounded bg-saudi-green-800 text-white">
                      {t('مناسبتك الحالية قيد التجهيز')}
                    </span>
                    <h3 className="text-base sm:text-lg font-black font-cairo text-saudi-green-950">
                      {activeOccasion.title}
                    </h3>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-gray-600">
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5 text-saudi-gold-600" />
                      {activeOccasion.date}
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-saudi-gold-600" />
                      {activeOccasion.cityNameAr}
                    </span>
                    <span className="flex items-center gap-1 font-bold text-saudi-green-900">
                      <DollarSign className="w-3.5 h-3.5 text-saudi-gold-600" />
                      {t('الميزانية:')} {formatSAR(activeOccasion.budget)}
                    </span>
                    <span className="text-gray-500">•</span>
                    <span className="text-saudi-gold-700 font-bold">
                      {t('جاهزية التجهيزات:')} {activeOccasion.readinessPercentage}%
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <Link
                    href="/plan"
                    className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl transition flex items-center gap-1.5"
                  >
                    <span>{t('متابعة خطة المناسبة')}</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </Link>
                  {cart.length > 0 && (
                    <Link
                      href="/marketplace"
                      className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs rounded-xl transition flex items-center gap-1"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>{t('في السلة (')}{cart.length})</span>
                    </Link>
                  )}
                </div>
              </div>
            </section>
          )}

          {/* 3. Client Section: "ما مناسبتك؟" */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('ما مناسبتك؟')}
                </h2>
              </div>
              <Link
                href="/plan"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>{t('عرض كافة أنواع المناسبات (')}{occasionTypes.length})</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
              {occasionTypes.slice(0, 6).map((occ) => (
                <Link
                  key={occ.id}
                  href={`/plan?type=${occ.id}`}
                  className="group bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden hover:border-saudi-gold-500 hover:-translate-y-1 transition duration-300 flex flex-col"
                >
                  <div className="relative h-28 w-full bg-gray-100 overflow-hidden">
                    <img
                      src={occ.coverImage}
                      alt={pick(occ.nameAr, occ.nameEn)}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
                    <span className="absolute bottom-2 right-2 text-white font-bold text-xs font-cairo">
                      {pick(occ.nameAr, occ.nameEn)}
                    </span>
                  </div>
                  <div className="p-2.5 text-caption2 text-gray-500 leading-tight">
                    {pick(occ.descriptionAr, occ.descriptionEn)}
                  </div>
                </Link>
              ))}
            </div>
          </section>

          {/* 4. Client Section: Smart Packages */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('الباقات الذكية الجاهزة')}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t('باقات منسقة تجمع أفضل الموردين المعتمدين في بكج واحد مع توفير حقيقي وإمكانية التعديل.')}
                </p>
              </div>
              <Link
                href="/packages"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>{t('استعراض كل الباقات (')}{packages.length})</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {packages.slice(0, 3).map((pkg) => (
                <PackageCard key={pkg.id} pkg={pkg} onBookPackage={handleBookPackage} />
              ))}
            </div>
          </section>

          {/* 5. Client Services Filtered by Category in City */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
              <div>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('الخدمات المميزة في')} {pick(activeCityObj.nameAr, activeCityObj.nameEn)}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t('اختر الفئة واستعرض الخدمات المعتمدة للحجز المباشر مع ضمان المنصة.')}
                </p>
              </div>
              <Link
                href="/marketplace"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1 shrink-0"
              >
                <span>{t('سوق الخدمات الشامل')}</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            {/* Category Filter Chips for Clients */}
            <div className="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none">
              <button
                onClick={() => setClientCategoryFilter('all')}
                className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                  clientCategoryFilter === 'all'
                    ? 'bg-saudi-green-800 text-white shadow-sm'
                    : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                }`}
              >
                {t('الكل (')}{services.length})
              </button>
              {serviceCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setClientCategoryFilter(cat.id)}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold transition whitespace-nowrap ${
                    clientCategoryFilter === cat.id
                      ? 'bg-saudi-green-800 text-white shadow-sm'
                      : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {pick(cat.nameAr, cat.nameEn)}
                </button>
              ))}
            </div>

            {/* Services Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {clientFilteredServices.slice(0, 6).map((srv) => (
                <ServiceCard key={srv.id} service={srv} onBookNow={handleBookService} />
              ))}
            </div>
          </section>

          {/* 5b. Direct service: digital cards and invitations (no occasion needed) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl border border-saudi-gold-400/40 bg-white p-6 sm:p-8 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div className="flex items-start gap-4">
                <span className="w-12 h-12 rounded-2xl bg-saudi-green-50 text-saudi-green-800 flex items-center justify-center shrink-0"><Palette className="w-6 h-6" /></span>
                <div className="space-y-1">
                  <h2 className="text-xl sm:text-2xl font-black font-cairo text-saudi-green-950">{t('بطاقات ودعوات رقمية')}</h2>
                  <p className="text-xs sm:text-sm text-gray-600 max-w-xl">{t('اطلب تصميم بطاقتك من موردين معتمدين أو صمّمها بنفسك، دون الحاجة إلى اختيار مناسبة أولاً.')}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-3 shrink-0">
                <Link href="/invitations" className="px-5 py-3 rounded-2xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs sm:text-sm flex items-center gap-2 transition">
                  <span>{t('استعرض البطاقات والدعوات')}</span>
                  <ChevronLeft className="w-4 h-4" />
                </Link>
                <Link href="/invitations/design" className="px-5 py-3 rounded-2xl border border-gray-300 bg-white hover:bg-gray-50 font-bold text-xs sm:text-sm text-gray-900 transition">
                  {t('صمّم بطاقتك بنفسك')}
                </Link>
              </div>
            </div>
          </section>

          {/* 6. Client Section: AI Planner */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-saudi-green-900 rounded-3xl p-6 sm:p-10 text-white relative overflow-hidden border border-saudi-gold-500/30">
              <div className="relative z-10 max-w-2xl space-y-4">
                <h3 className="text-2xl sm:text-3xl font-black font-cairo text-white">
                  {t('لا تشيل هم الترتيب وتوزيع الميزانية!')}
                </h3>
                <p className="text-xs sm:text-sm text-gray-200 leading-relaxed font-tajawal">
                  {t('اكتب فقط:')} <span className="text-saudi-gold-300 font-bold">{t('"أبغى ملكة منزلية بالرياض لـ 50 شخص وميزانيتي 15 ألف"')}</span>{t('، وسيقوم المساعد الذكي بتوليد خطة متكاملة فوراً تشمل توزيع الميزانية، قائمة المهام، والموردين الموصى بهم.')}
                </p>

                <div className="pt-2 flex flex-wrap gap-3">
                  <FeatureContent id="luma"><button
                    onClick={() => setIsAIOpen(true)}
                    className="px-6 py-3 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-2xl text-xs sm:text-sm flex items-center gap-2 transition"
                  >
                    <Sparkles className="w-4 h-4 text-saudi-green-950" />
                    <span>{t('جرّب التخطيط بالذكاء الاصطناعي مجاناً')}</span>
                  </button></FeatureContent>
                </div>
              </div>
            </div>
          </section>

          {/* 6b. Platform statistics: real, verified figures only (hidden when switched off or empty) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <PublicStatistics />
          </section>

          {/* 7. Client Reviews Showcase */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <CustomerReviewsShowcase featuredOnly={true} limit={6} />
          </section>

          {/* 8. Client RFQ Banner (إذا لم يجد ما يبحث عنه) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="rounded-3xl p-6 sm:p-10 bg-saudi-sand-200 border border-saudi-gold-400/40 flex flex-col md:flex-row items-center justify-between gap-6">
              <div className="space-y-2 text-right">
                <h3 className="text-2xl font-black font-cairo text-saudi-green-950">
                  {t('عندك متطلبات خاصة؟ اطلب عرض سعر')}
                </h3>
                <p className="text-xs text-gray-600 max-w-xl font-tajawal">
                  {t('أرسل تفاصيل مناسبتك وسيقوم الموردون المعتمدون في منطقتك بتقديم عروض أسعار تنافسية خلال 24 ساعة مع ضمان الالتزام.')}
                </p>
              </div>
              <Link
                href="/rfq"
                className="px-6 py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs sm:text-sm rounded-2xl transition shrink-0 flex items-center gap-2"
              >
                <span>{t('إنشاء طلب تسعير (RFQ) جديد')}</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>
          </section>
        </div>
      )}

      {currentRole === 'vendor' && <HomeVendorView />}
      {currentRole === 'admin' && <HomeAdminView />}
    </div>
  );
}
