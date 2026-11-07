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

export default function HomeVendorView() {
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
    <>
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
    </>
  );
}
