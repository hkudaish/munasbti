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

export default function HomeAdminView() {
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
    </>
  );
}
