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
import { useApp } from '@/lib/store';
import { formatSAR } from '@/lib/utils';
import ServiceCard from '@/components/marketplace/ServiceCard';
import PackageCard from '@/components/marketplace/PackageCard';
import CustomerReviewsShowcase from '@/components/common/CustomerReviewsShowcase';
import PublicStatistics from '@/components/common/PublicStatistics';
import { ServiceItem, SmartPackage, UserRole } from '@/lib/types';
import { useT, useLocale, usePick } from '@/components/i18n/LocaleProvider';

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

      {/* =========================================================================
          VIEW B: SUPPLIER / VENDOR (بوابة الموردين والشركاء)
      ========================================================================= */}
      {currentRole === 'vendor' && (
        <div className="space-y-16 animate-fadeIn">
          {/* 1. Vendor Hero Section */}
          <section className="relative bg-saudi-green-950 text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-saudi-gold-500/20">
            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 border border-saudi-gold-400/40 px-3.5 py-1.5 rounded-full text-saudi-gold-300 text-xs font-bold">
                <Store className="w-4 h-4 text-saudi-gold-400" />
                <span>
                  {t('بوابة الموردين والشركاء المعتمدين 🇸🇦 •')}{' '}
                  {currentUser?.businessName || currentUser?.name || t('مورد خدمات مناسبات')}
                </span>
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl sm:text-4xl font-black font-cairo leading-tight text-white">
                  {t('مرحباً بك في مركز نمو أعمالك ومبيعاتك')}
                </h1>
                <p className="text-sm text-gray-300 leading-relaxed font-tajawal">
                  {t('راقب طلبات الحجز المباشرة، نافس وقدم عروض الأسعار على طلبات RFQ، حدّث أسعار خدماتك وباقاتك، واستفد من نظام الدفع المضمون والضمان البنكي.')}
                </p>
              </div>

              {/* Live Operational KPIs Strip for Vendors */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('الحجوزات النشطة')}</span>
                    <Calendar className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {bookings.filter((b) => b.status === 'confirmed').length}
                  </div>
                  <span className="text-caption2 text-saudi-gold-300">{t('مؤكدة وجاهزة للتنفيذ')}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('طلبات RFQ المتاحة')}</span>
                    <FileText className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-saudi-gold-300 font-cairo">
                    {openRFQs.length}
                  </div>
                  <span className="text-caption2 text-gray-300">{t('طلبات عملاء بانتظار عروضك')}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('تقييم المنشأة')}</span>
                    <Star className="w-4 h-4 text-saudi-gold-400 fill-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    4.9 / 5.0
                  </div>
                  <span className="text-caption2 text-green-300">{t('موثق بالسجل التجاري ✔')}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('سرعة الاستجابة')}</span>
                    <Clock className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {t('15 دقيقة')}
                  </div>
                  <span className="text-caption2 text-saudi-gold-300">{t('أعلى من متوسط السوق')}</span>
                </div>
              </div>

              {/* Vendor Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/vendor"
                  className="px-6 py-3.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-2xl text-sm shadow-lg flex items-center gap-2 transition"
                >
                  <Store className="w-4 h-4 text-saudi-green-950" />
                  <span>{t('الدخول للوحة المورد الكاملة')}</span>
                </Link>

                <Link
                  href="/vendor?tab=bookings"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Calendar className="w-4 h-4 text-saudi-gold-300" />
                  <span>{t('إدارة الحجوزات الواردة')}</span>
                </Link>

                <Link
                  href="/vendor?tab=services"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <PlusCircle className="w-4 h-4 text-saudi-gold-300" />
                  <span>{t('إضافة وتعديل الخدمات والأسعار')}</span>
                </Link>

                <Link
                  href="/marketplace"
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Eye className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('معاينة كيف يرى العملاء خدماتك')}</span>
                </Link>
              </div>
            </div>
          </section>

          {/* 2. Vendor Section: Live Client RFQs Feed (فرص العمل وطلبات التسعير) */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  {t('فرص أعمال جديدة لموردين معتمدين')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('طلبات التسعير المتاحة للمزايدة (Live RFQs)')}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t('طلبات مباشرة من أصحاب مناسبات يبحثون عن موردين لتنفيذ خدماتهم. قدم عرضك التنافسي الآن!')}
                </p>
              </div>
              <Link
                href="/vendor?tab=rfq"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>{t('عرض جميع طلبات RFQ (')}{openRFQs.length})</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {openRFQs.map((rfq) => (
                <div
                  key={rfq.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 p-5 shadow-card hover:shadow-lg transition space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-saudi-green-50 text-saudi-green-900 border border-saudi-green-200">
                        {rfq.occasionTypeAr}
                      </span>
                      <span className="text-xs font-bold text-saudi-gold-700">
                        {t('الميزانية:')} {formatSAR(rfq.budget)}
                      </span>
                    </div>

                    <h3 className="font-bold text-base text-gray-900 font-cairo">
                      {rfq.occasionTitle}
                    </h3>

                    <p className="text-xs text-gray-600 line-clamp-2 font-tajawal">
                      {rfq.requirementsAr}
                    </p>

                    <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 pt-2 border-t border-saudi-sand-200">
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-saudi-gold-600" />
                        {rfq.cityAr}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar className="w-3.5 h-3.5 text-saudi-gold-600" />
                        {rfq.date}
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-saudi-gold-600" />
                        {rfq.guestCount} {t('ضيف')}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {t('العروض المقدمة:')} <strong className="text-gray-700">{rfq.quotesCount}</strong>
                    </span>
                    <Link
                      href={`/vendor?tab=rfq&id=${rfq.id}`}
                      className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      {t('تقديم عرض سعر فوري')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Vendor Section: Service Catalog & Market Benchmarking */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  {t('كتالوج الخدمات والأسعار')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('خدماتك المعروضة في المنصة')}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t('يمكنك استعراض خدماتك المعروضة أو مقارنة أسعار الخدمات المماثلة في')} {pick(activeCityObj.nameAr, activeCityObj.nameEn)}.
                </p>
              </div>

              {/* View Scope Toggle */}
              <div className="flex items-center gap-2 bg-saudi-sand-100 p-1 rounded-xl border border-saudi-sand-300 self-start sm:self-auto">
                <button
                  onClick={() => setVendorServiceView('my_services')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    vendorServiceView === 'my_services'
                      ? 'bg-saudi-green-800 text-white shadow-sm'
                      : 'text-gray-700 hover:text-saudi-green-900'
                  }`}
                >
                  {t('خدماتي المسجلة')}
                </button>
                <button
                  onClick={() => setVendorServiceView('market_comparison')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                    vendorServiceView === 'market_comparison'
                      ? 'bg-saudi-green-800 text-white shadow-sm'
                      : 'text-gray-700 hover:text-saudi-green-900'
                  }`}
                >
                  {t('مقارنة أسعار السوق (')}{pick(activeCityObj.nameAr, activeCityObj.nameEn)})
                </button>
              </div>
            </div>

            {/* Services Grid with Vendor Controls */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {services.slice(0, 6).map((srv) => (
                <div
                  key={srv.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-card flex flex-col justify-between"
                >
                  <div className="relative h-44 w-full bg-gray-100">
                    <img src={srv.images[0]} alt={pick(srv.titleAr, srv.titleEn)} loading="lazy" decoding="async" className="w-full h-full object-cover" />
                    <span className="absolute top-2.5 right-2.5 bg-saudi-green-900/80 backdrop-blur-md text-white text-caption2 font-bold px-2 py-0.5 rounded-full">
                      {t(srv.categoryNameAr)}
                    </span>
                    <span className="absolute bottom-2.5 right-2.5 bg-black/70 backdrop-blur-md text-saudi-gold-300 text-xs font-bold px-2.5 py-1 rounded-lg">
                      {formatSAR(srv.price)}
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    <div>
                      <h4 className="font-bold text-sm text-gray-900">{pick(srv.titleAr, srv.titleEn)}</h4>
                      <p className="text-xs text-gray-500 line-clamp-2 mt-1">{pick(srv.descriptionAr, srv.descriptionEn)}</p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-saudi-sand-200 text-xs text-gray-600">
                      <span>{t('المدينة:')} {srv.cityNameAr}</span>
                      <span className="text-saudi-gold-700 font-bold">★ {srv.vendorRating}</span>
                    </div>

                    <div className="pt-2 flex items-center gap-2">
                      <Link
                        href={`/vendor?tab=services&edit=${srv.id}`}
                        className="flex-1 py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-900 font-bold text-xs rounded-xl text-center transition"
                      >
                        {t('تعديل في لوحة المورد')}
                      </Link>
                      <button
                        onClick={() => handleBookService(srv)}
                        className="px-3 py-2 bg-saudi-green-800 text-white font-bold text-xs rounded-xl hover:bg-saudi-green-900 transition"
                        title={t('معاينة عملية الحجز كما يراها العميل')}
                      >
                        {t('معاينة الحجز')}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 4. Vendor Growth & Certification Hub */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-saudi-green-950 rounded-3xl p-6 sm:p-10 text-white border border-saudi-gold-500/30 shadow-2xl">
              <div className="max-w-2xl space-y-4">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-saudi-gold-500/20 text-saudi-gold-300 text-xs font-bold border border-saudi-gold-500/30">
                  <Award className="w-3.5 h-3.5" />
                  <span>{t('مزايا المورد المعتمد في منصة مناسبتي')}</span>
                </span>
                <h3 className="text-2xl sm:text-3xl font-black font-cairo text-white">
                  {t('احصل على شارة التوثيق الذهبية وضاعف مبيعاتك')}
                </h3>
                <p className="text-xs sm:text-sm text-gray-300 leading-relaxed font-tajawal">
                  {t('منشأتك الموثقة بالسجل التجاري أو وثيقة العمل الحر تظهر في أعلى نتائج البحث والترشيحات الذكية للعملاء. جميع الحجوزات مدفوعة ومؤمنة في حساب ضمان المنصة قبل موعد المناسبة.')}
                </p>
                <div className="pt-2 flex flex-wrap gap-3">
                  <Link
                    href="/vendor?tab=verification"
                    className="px-5 py-3 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-xl text-xs sm:text-sm transition flex items-center gap-2"
                  >
                    <span>{t('توثيق السجل التجاري / العمل الحر')}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </Link>
                  <Link
                    href="/vendor?tab=packages"
                    className="px-5 py-3 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-xl text-xs sm:text-sm transition"
                  >
                    <span>{t('الانضمام إلى باقات مناسبتي الذكية')}</span>
                  </Link>
                </div>
              </div>
            </div>
          </section>
        </div>
      )}

      {/* =========================================================================
          VIEW C: PLATFORM ADMIN (لوحة الإدارة والرقابة المركزية)
      ========================================================================= */}
      {currentRole === 'admin' && (
        <div className="space-y-16 animate-fadeIn">
          {/* 1. Admin Central Hero Section */}
          <section className="relative bg-[#071d17] text-white pt-10 pb-16 px-4 sm:px-6 lg:px-8 overflow-hidden border-b border-saudi-gold-500/30">
            <div className="max-w-7xl mx-auto relative z-10 space-y-8">
              <div className="inline-flex items-center gap-2 bg-saudi-gold-500/20 border border-saudi-gold-400/40 px-3.5 py-1.5 rounded-full text-saudi-gold-300 text-xs font-bold">
                <ShieldCheck className="w-4 h-4 text-saudi-gold-400" />
                <span>
                  {t('لوحة القيادة المركزية وإدارة المنصة 🇸🇦 •')} {currentUser?.name || t('مدير النظام')}
                </span>
              </div>

              <div className="max-w-3xl space-y-3">
                <h1 className="text-3xl sm:text-4xl font-black font-cairo leading-tight text-white">
                  {t('مركز الرقابة العامة والعمليات التشغيلية')}
                </h1>
                <p className="text-sm text-gray-300 leading-relaxed font-tajawal">
                  {t('مراقبة فورية لتدفق الحجوزات في كافة المدن، تدقيق واعتماد الموردين الجدد، متابعة التحويلات المالية في حساب الضمان، وضمان جودة الخدمات المقدمة لأصحاب المناسبات.')}
                </p>
              </div>

              {/* Live Platform Health KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 pt-2">
                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('الموردين المعتمدين')}</span>
                    <Store className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {vendors.length}
                  </div>
                  <span className="text-caption2 text-green-300">
                    {vendors.filter((v) => v.verified).length} {t('مورد موثق رسمياً')}
                  </span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('حجم المعاملات (⃁)')}</span>
                    <CreditCard className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-saudi-gold-300 font-cairo">
                    {formatSAR(totalBookingsAmount)}
                  </div>
                  <span className="text-caption2 text-gray-300">{bookings.length} {t('معاملة منجزة')}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('طلبات التوثيق المعلقة')}</span>
                    <FileText className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-amber-300 font-cairo">
                    {pendingVendors.length}
                  </div>
                  <span className="text-caption2 text-amber-200">{t('بانتظار تدقيق السجل')}</span>
                </div>

                <div className="bg-white/10 backdrop-blur-md p-4 rounded-2xl border border-white/10">
                  <div className="flex items-center justify-between text-gray-300 text-xs mb-1">
                    <span>{t('الخدمات والباقات النشطة')}</span>
                    <Layers className="w-4 h-4 text-saudi-gold-400" />
                  </div>
                  <div className="text-2xl font-black text-white font-cairo">
                    {services.length + packages.length}
                  </div>
                  <span className="text-caption2 text-saudi-gold-300">{t('عبر')} {cities.length} {t('مدن')}</span>
                </div>
              </div>

              {/* Admin Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Link
                  href="/admin"
                  className="px-6 py-3.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold rounded-2xl text-sm shadow-lg flex items-center gap-2 transition"
                >
                  <ShieldCheck className="w-4 h-4 text-saudi-green-950" />
                  <span>{t('فتح لوحة الإدارة المركزية الكاملة')}</span>
                </Link>

                <Link
                  href="/admin?tab=vendors"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Store className="w-4 h-4 text-saudi-gold-300" />
                  <span>{t('إدارة الموردين والتوثيق')}</span>
                </Link>

                <Link
                  href="/admin?tab=bookings"
                  className="px-5 py-3.5 bg-white/10 hover:bg-white/20 border border-white/20 text-white font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <CreditCard className="w-4 h-4 text-saudi-gold-300" />
                  <span>{t('مراقبة الحجوزات والمدفوعات')}</span>
                </Link>

                <Link
                  href="/admin?tab=settings"
                  className="px-5 py-3.5 bg-white/5 hover:bg-white/15 border border-white/10 text-gray-200 font-bold rounded-2xl text-sm transition flex items-center gap-2"
                >
                  <Settings className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('إعدادات النظام والعمولات')}</span>
                </Link>
              </div>
            </div>
          </section>

          {/* Admin notice banner */}
          {adminActionNotice && (
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
              <div className="bg-saudi-green-900 text-white p-3 rounded-xl flex items-center justify-between text-xs font-bold border border-saudi-gold-400">
                <span>{adminActionNotice}</span>
                <button
                  onClick={() => setAdminActionNotice(null)}
                  className="text-saudi-gold-300 hover:text-white"
                >
                  {t('إغلاق')}
                </button>
              </div>
            </div>
          )}

          {/* 2. Admin Section: Pending Vendor Approvals */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  {t('إجراءات المشرف الفورية')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('طلبات اعتماد وتوثيق الموردين (')}{pendingVendors.length})
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t('قم بمراجعة السجلات التجارية ووثائق العمل الحر واعتماد الموردين ليظهروا في سوق المنصة.')}
                </p>
              </div>
              <Link
                href="/admin?tab=vendors"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>{t('لوحة تدقيق الموردين الكاملة')}</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {pendingVendors.map((vendor) => (
                <div
                  key={vendor.id}
                  className="bg-white rounded-2xl border border-saudi-sand-300 p-5 shadow-card space-y-4 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center gap-3">
                      <img
                        src={vendor.logo}
                        alt={vendor.businessName}
                        className="w-12 h-12 rounded-xl object-cover border border-saudi-sand-300"
                      />
                      <div>
                        <h4 className="font-bold text-sm text-gray-900 font-cairo">
                          {vendor.businessName}
                        </h4>
                        <span className="text-xs text-gray-500">
                          {vendor.categoryNameAr} • {vendor.cityNameAr}
                        </span>
                      </div>
                    </div>

                    <div className="bg-saudi-sand-50 p-2.5 rounded-xl text-xs space-y-1 text-gray-700">
                      <div>
                        {t('السجل التجاري:')} <strong className="font-mono">{vendor.crNumber || t('تحت التدقيق')}</strong>
                      </div>
                      <div>
                        {t('رقم الاتصال:')} <span className="font-mono dir-ltr inline-block">{vendor.contactPhone}</span>
                      </div>
                    </div>
                  </div>

                  <div className="pt-2 flex items-center gap-2">
                    <button
                      onClick={() => {
                        updateVendorStatus(vendor.id, 'active', true);
                        setAdminActionNotice(t('تم اعتماد وتوثيق {name} بنجاح!', { name: vendor.businessName }));
                      }}
                      className="flex-1 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl shadow-sm transition"
                    >
                      {t('اعتماد وتوثيق الآن ✔')}
                    </button>
                    <Link
                      href={`/admin?tab=vendors&id=${vendor.id}`}
                      className="px-3 py-2 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-gray-800 font-bold text-xs rounded-xl transition"
                    >
                      {t('مراجعة')}
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* 3. Admin Section: Platform Transactions Stream */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 border-b border-saudi-sand-300 pb-4">
              <div>
                <span className="text-xs font-bold text-saudi-gold-600 block uppercase tracking-wider">
                  {t('سجل التدفقات المالية')}
                </span>
                <h2 className="text-2xl sm:text-3xl font-black font-cairo text-saudi-green-950">
                  {t('أحدث الحجوزات والعمليات المالية المبرمة')}
                </h2>
                <p className="text-xs text-gray-500 mt-1">
                  {t('متابعة أموال الضمان وعربون الحجز ونسب عمولة المنصة (10%).')}
                </p>
              </div>
              <Link
                href="/admin?tab=bookings"
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-gold-700 flex items-center gap-1"
              >
                <span>{t('سجل الحجوزات المالي')}</span>
                <ChevronLeft className="w-4 h-4" />
              </Link>
            </div>

            <div className="bg-white rounded-2xl border border-saudi-sand-300 overflow-hidden shadow-card">
              <div className="overflow-x-auto">
                <table className="w-full text-right text-xs">
                  <thead className="bg-saudi-sand-100 text-gray-700 font-bold border-b border-saudi-sand-300">
                    <tr>
                      <th className="p-3.5">{t('رقم الحجز')}</th>
                      <th className="p-3.5">{t('المناسبة والخدمة')}</th>
                      <th className="p-3.5">{t('العميل')}</th>
                      <th className="p-3.5">{t('المورد')}</th>
                      <th className="p-3.5">{t('المبلغ الإجمالي')}</th>
                      <th className="p-3.5">{t('حالة الدفع')}</th>
                      <th className="p-3.5">{t('إجراء المشرف')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-saudi-sand-200">
                    {bookings.slice(0, 5).map((b) => (
                      <tr key={b.id} className="hover:bg-saudi-sand-50">
                        <td className="p-3.5 font-mono font-bold text-saudi-green-900">
                          {b.bookingNumber}
                        </td>
                        <td className="p-3.5 font-bold text-gray-900">
                          {b.occasionTitle}
                          <span className="block text-caption2 text-gray-500 font-normal">
                            {b.serviceTitleAr}
                          </span>
                        </td>
                        <td className="p-3.5">{b.customerName}</td>
                        <td className="p-3.5 text-saudi-green-800 font-bold">{b.vendorName}</td>
                        <td className="p-3.5 font-black text-gray-900">{formatSAR(b.totalAmount)}</td>
                        <td className="p-3.5">
                          <span className="inline-block px-2 py-0.5 rounded-full text-caption2 font-bold bg-green-100 text-green-800">
                            {b.status === 'confirmed' ? t('مؤكد بالضمان') : b.status}
                          </span>
                        </td>
                        <td className="p-3.5">
                          <Link
                            href="/admin?tab=bookings"
                            className="text-saudi-gold-700 hover:underline font-bold"
                          >
                            {t('تفاصيل')}
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </section>

          {/* 4. Admin Live Persona Switcher Tool */}
          <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="bg-saudi-sand-100 border border-saudi-gold-400/30 rounded-2xl p-6 shadow-card flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="space-y-1 text-right">
                <h4 className="font-bold text-base text-saudi-green-950 font-cairo">
                  {t('أداة فحص ومعاينة تجربة المستخدمين (Persona Simulator)')}
                </h4>
                <p className="text-xs text-gray-600 font-tajawal">
                  {t('بصفتك مديراً للنظام، يمكنك تجربة المنصة كما يراها العميل أو المورد دون الحاجة لتسجيل الخروج.')}
                </p>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => switchRole('client')}
                  className="px-4 py-2 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {t('معاينة تجربة العميل')}
                </button>
                <button
                  onClick={() => switchRole('vendor')}
                  className="px-4 py-2 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs rounded-xl shadow-sm transition"
                >
                  {t('معاينة تجربة المورد')}
                </button>
              </div>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
