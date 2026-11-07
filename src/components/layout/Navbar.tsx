'use client';

import CityPicker from '@/components/geo/CityPicker';
import { FeatureContent } from '@/components/system/FeatureProvider';
import React, { useState, Suspense } from 'react';
import Link from '@/components/system/FeatureLink';
import { useRouter, useSearchParams } from 'next/navigation';
import { useInnerPathname, useLocale } from '@/components/i18n/LocaleProvider';
import { useCartGate } from '@/lib/shopper-gate';
import { useApp } from '@/lib/store';
import {
  Sparkles,
  MapPin,
  Calendar,
  PlusCircle,
  ShoppingBag,
  Store,
  ShieldCheck,
  QrCode,
  Layers,
  ChevronDown,
  Menu,
  X,
  FileText,
  Lightbulb,
  Music,
  ArrowLeftRight,
  User,
  LogOut,
  UserPlus,
  LogIn,
  Wallet,
  Clock,
  CheckCircle2,
  TrendingUp,
  Settings,
  CreditCard,
} from 'lucide-react';
import { useT } from '@/components/i18n/LocaleProvider';
import LanguageSwitcher from '@/components/i18n/LanguageSwitcher';
import RemindersBell from '@/components/common/RemindersBell';

function NavbarContent() {
  const t = useT();
  const pathname = useInnerPathname();
  const router = useRouter();
  const { localize, locale } = useLocale();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get('tab');
  const {
    adminConfig,
    currentRole,
    currentUser,
    switchRole,
    openOnboarding,
    logoutUser,
    cities,
    selectedCity,
    setSelectedCity,
    occasions,
    activeOccasion,
    setActiveOccasionId,
    setIsAIOpen,
    cart,
    comparisonVendorIds,
  } = useApp();

  const [isOccasionDropdownOpen, setIsOccasionDropdownOpen] = useState(false);
  const [isCityDropdownOpen, setIsCityDropdownOpen] = useState(false);
  const [isUserDropdownOpen, setIsUserDropdownOpen] = useState(false);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const cartGate = useCartGate();
  const activeCityObj = cities.find((c) => c.id === selectedCity) || cities[0];
  // Role switching is for accounts that actually hold more than one role.
  const canUseVendor = !!currentUser && (currentUser.role === 'vendor' || !!currentUser.vendorId);
  const canUseAdmin = !!currentUser && (currentUser.role === 'admin' || !!currentUser.hasAdminAccess || !!currentUser.hasSystemAccess);
  const showRoleSwitcher = canUseVendor || canUseAdmin;

  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-saudi-sand-200 shadow-sm">
      {/* Top Banner for Role Switcher & City & User Auth */}
      <div className="bg-saudi-green-900 text-white text-xs py-1.5 px-3 sm:px-4">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex items-center gap-2"><CityPicker /><LanguageSwitcher className="!border-saudi-gold-400/60 !py-0.5 !text-saudi-gold-300 hover:!bg-white/10" /></div>

          {/* Role Switcher & Account Access */}
          <div className="flex flex-wrap items-center gap-2 sm:gap-4 min-w-0 max-w-full">
            {/* Visual Segmented Role Switcher matching reference image */}
            {showRoleSwitcher && (
            <div className="flex items-center gap-1.5 sm:gap-2">
              <span className="text-gray-300 text-xs sm:text-xs font-medium hidden md:inline">{t('عرض بصفتك:')}</span>
              <div className="bg-saudi-green-950/90 p-0.5 rounded-lg border border-saudi-gold-500/30 flex items-center gap-0.5 sm:gap-1 shadow-inner">
                {/* 1. Customer Option */}
                <button
                  onClick={() => {
                    switchRole('client');
                    if (pathname === '/vendor' || pathname === '/admin') {
                      router.push(localize('/'));
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1 ${
                    currentRole === 'client'
                      ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title={t('تصفح المنصة كصاحب مناسبة')}
                >
                  <span>{t('صاحب المناسبة')}</span>
                </button>

                {/* 2. Supplier Option */}
                {canUseVendor && (<button
                  onClick={() => {
                    const res = switchRole('vendor');
                    if (res.allowed && pathname === '/admin') {
                      router.push('/vendor');
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                    currentRole === 'vendor'
                      ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title={t('الدخول لبوابة الموردين والشركاء')}
                >
                  <Store className="w-3.5 h-3.5" />
                  <span>{t('بوابة الموردين')}</span>
                </button>)}

                {/* 3. Admin Option (elevated gold badge if active or admin) */}
                {canUseAdmin && (<button
                  onClick={() => {
                    const res = switchRole('admin');
                    if (res.allowed && pathname === '/vendor') {
                      router.push('/admin');
                    }
                  }}
                  className={`px-2 sm:px-3 py-1 rounded-md text-xs font-bold transition flex items-center gap-1.5 ${
                    currentRole === 'admin'
                      ? 'bg-saudi-gold-500 text-saudi-green-950 shadow-sm'
                      : 'text-gray-300 hover:text-white hover:bg-white/5'
                  }`}
                  title={t('لوحة الإدارة المركزية (للمشرفين)')}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{t('لوحة الإدارة')}</span>
                </button>)}
              </div>
            </div>
            )}

            {/* User Profile or Register/Login Button */}
            {currentUser ? (
              <div className="relative">
                <button
                  onClick={() => setIsUserDropdownOpen(!isUserDropdownOpen)}
                  className="flex items-center gap-1.5 bg-white/10 hover:bg-white/20 px-2 sm:px-2.5 py-1 rounded-lg text-white text-xs transition border border-white/10"
                >
                  <img
                    src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                    alt={currentUser.name}
                    className="w-4 h-4 rounded-full object-cover border border-saudi-gold-400"
                  />
                  <span className="font-bold max-w-[85px] sm:max-w-[120px] truncate">{currentUser.name}</span>
                  <span className={`text-caption2 px-1.5 py-0.2 rounded font-bold ${
                    currentUser.role === 'admin'
                      ? 'bg-purple-900/60 text-purple-200'
                      : currentUser.role === 'vendor'
                      ? 'bg-saudi-gold-500/30 text-saudi-gold-300'
                      : 'bg-emerald-800 text-emerald-200'
                  }`}>
                    {currentUser.hasSystemAccess ? t('مدير النظام') : currentUser.role === 'admin' ? t('إدارة') : currentUser.role === 'vendor' ? t('مورد') : t('عميل')}
                  </span>
                  <ChevronDown className="w-3 h-3 text-gray-300" />
                </button>

                {isUserDropdownOpen && (
                  <div
                    className="absolute left-0 top-full mt-1.5 w-60 bg-white text-gray-800 rounded-2xl shadow-2xl border border-gray-100 py-2 z-50 animate-fadeIn"
                    onClick={() => setIsUserDropdownOpen(false)}
                  >
                    <div className="px-4 py-2 border-b border-gray-100">
                      <p className="font-bold text-gray-900 text-xs">{currentUser.name}</p>
                      <p className="text-xs text-gray-500">{currentUser.phone || currentUser.email}</p>
                      <div className="mt-1.5 flex items-center gap-1">
                        <span className="text-caption2 font-bold px-2 py-0.5 rounded-full bg-saudi-sand-100 text-saudi-green-900">
                          {currentUser.hasSystemAccess ? t('مدير النظام') : currentUser.role === 'admin'
                            ? t('حساب إداري')
                            : currentUser.role === 'vendor'
                            ? t('حساب مورد معتمد')
                            : t('حساب صاحب المناسبة')}
                        </span>
                      </div>
                    </div>

                    <div className="py-1 text-xs">
                      {currentUser.role !== 'vendor' && (
                        <button
                          onClick={() => openOnboarding('vendor')}
                          className="w-full text-right px-4 py-2 hover:bg-saudi-sand-50 text-saudi-gold-800 font-bold flex items-center gap-2"
                        >
                          <Store className="w-4 h-4 text-saudi-gold-600" />
                          <span>{t('ترقية الحساب أو تسجيل منشأة كمورد')}</span>
                        </button>
                      )}

                      {currentUser.role === 'vendor' && (
                        <Link
                          href="/vendor"
                          className="w-full text-right px-4 py-2 hover:bg-saudi-sand-50 text-gray-800 font-semibold flex items-center gap-2"
                        >
                          <Store className="w-4 h-4 text-saudi-green-800" />
                          <span>{t('بوابة المورد وإدارة الخدمات')}</span>
                        </Link>
                      )}

                      <button
                        onClick={() => openOnboarding()}
                        className="w-full text-right px-4 py-2 hover:bg-saudi-sand-50 text-gray-800 font-semibold flex items-center gap-2"
                      >
                        <UserPlus className="w-4 h-4 text-gray-600" />
                        <span>{t('تبديل الحساب أو إنشاء حساب جديد')}</span>
                      </button>

                      {currentUser.hasSystemAccess && <Link href="/system-admin" className="block px-3 py-2 text-xs font-bold text-amber-800 hover:bg-amber-50 rounded-xl">{t('مدير النظام')}</Link>}
                      {(currentUser.hasAdminAccess || currentUser.hasSystemAccess || currentUser.role === 'admin') && <><Link href="/admin/booking-insights" onClick={() => setIsUserDropdownOpen(false)} className="flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 w-full text-right">{t('مؤشرات الحجز والسلال')}</Link>
                      <Link href="/admin/backups" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs font-bold text-saudi-green-900 hover:bg-gray-50 rounded-xl">{t('النسخ الاحتياطي')}</Link></>}
                      {currentUser.hasSystemAccess && <Link href="/system-admin/geography" className="block px-3 py-2 text-xs text-emerald-900">{t('الدول والمدن والخدمات')}</Link>}
                      {currentUser.hasSystemAccess && <Link href="/system-admin/availability" className="block px-3 py-2 text-xs text-emerald-900">{t('إدارة الإتاحة والحجز')}</Link>}
                      <Link href="/exceptions" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs font-bold text-saudi-green-900 hover:bg-gray-50 rounded-xl">{t('طلبات الاستثناء وتعديل المواعيد')}</Link>
                      {(currentUser.hasAdminAccess || currentUser.hasSystemAccess || currentUser.role === 'admin') && <Link href="/admin/vendor-approvals" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs font-bold text-saudi-green-900 hover:bg-gray-50 rounded-xl">{t('اعتماد حسابات الموردين')}</Link>}
                      {(currentUser.hasAdminAccess || currentUser.hasSystemAccess || currentUser.role === 'admin') && <Link href="/admin/exceptions" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs font-bold text-saudi-green-900 hover:bg-gray-50 rounded-xl">{t('إدارة طلبات الاستثناء')}</Link>}
                      <Link href="/settings/security" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs font-bold text-saudi-green-900 hover:bg-gray-50 rounded-xl">{t('الأمان وتسجيل الدخول')}</Link>
                      <Link href="/settings/channels" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs font-bold text-saudi-green-900 hover:bg-gray-50 rounded-xl">{t('إعدادات إرسال الدعوات')}</Link>
                      <Link href="/settings/invitations-data" onClick={() => setIsUserDropdownOpen(false)} className="block px-3 py-2 text-xs text-gray-600 hover:bg-gray-50 rounded-xl">{t('نقل الدعوات السابقة')}</Link>
                      <button
                        onClick={logoutUser}
                        className="w-full text-right px-4 py-2 hover:bg-red-50 text-red-700 font-semibold flex items-center gap-2 border-t border-gray-100 mt-1"
                      >
                        <LogOut className="w-4 h-4 text-red-600" />
                        <span>{t('تسجيل الخروج')}</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => openOnboarding()}
                  className="bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold px-2.5 sm:px-3 py-1 rounded-md text-xs transition shadow-sm flex items-center gap-1"
                >
                  <UserPlus className="w-3 h-3 text-saudi-green-950" />
                  <span>{t('إنشاء حساب')}</span>
                </button>
                <button
                  onClick={() => openOnboarding()}
                  aria-label={t('تسجيل الدخول')}
                  className="text-gray-300 hover:text-white px-2 py-1 rounded text-xs font-bold transition flex items-center gap-1"
                >
                  <LogIn className="w-3 h-3" />
                  <span className="hidden sm:inline">{t('تسجيل الدخول')}</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Main Navbar */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Right: Logo & Slogan */}
          <div className="flex items-center gap-5 lg:gap-7">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-10 h-10 rounded-xl bg-saudi-green-800 flex items-center justify-center text-saudi-gold-400 shadow-md group-hover:scale-105 transition">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex flex-col">
                <span className="text-2xl font-black tracking-tight text-saudi-green-900 font-cairo">
                  {locale === 'en' ? 'Munasbti' : adminConfig.platformNameAr}
                </span>
                <span className="text-caption2 -mt-1 text-saudi-gold-600 font-medium">
                  {t(adminConfig.taglineAr)}
                </span>
              </div>
            </Link>

            {/* Desktop Navigation Links — Context Filtered by Active Role */}
            <nav className="hidden lg:flex items-center gap-1 text-sm font-medium text-gray-700">
              {/* 1. When Active Role is Client (Customer) */}
              {currentRole === 'client' && (
                <>
                  <Link
                    href="/"
                    className={`px-3 py-2 rounded-lg transition ${
                      pathname === '/' ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    {t('الرئيسية')}
                  </Link>
                  <Link
                    href="/marketplace"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/marketplace') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <ShoppingBag className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('سوق الخدمات')}</span>
                  </Link>
                  <Link
                    href="/invitations"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/invitations') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <QrCode className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('بطاقات ودعوات')}</span>
                  </Link>
                  <Link
                    href="/packages"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/packages') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Layers className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('الباقات الذكية')}</span>
                  </Link>
                  <Link
                    href="/calculator"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/calculator') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('حاسبة التكاليف')}</span>
                  </Link>
                  <Link
                    href="/rfq"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/rfq') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <FileText className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('عروض الأسعار')}</span>
                  </Link>
                  <Link
                    href="/commerce/orders"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname.startsWith('/bookings') ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('حجوزاتي وفواتيري')}</span>
                  </Link>
                  <details className="relative">
                    <summary className="flex cursor-pointer list-none items-center gap-1 rounded-lg px-3 py-2 transition hover:bg-gray-50 hover:text-saudi-green-800 [&::-webkit-details-marker]:hidden">
                      <span>{t('المزيد')}</span>
                      <ChevronDown className="w-3.5 h-3.5" />
                    </summary>
                    <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-2xl border border-gray-100 bg-white p-1.5 shadow-xl">
                      <Link
                        href="/zaffah"
                        onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${pathname.startsWith('/zaffah') ? 'bg-saudi-green-50 font-bold text-saudi-green-800' : 'hover:bg-gray-50 hover:text-saudi-green-800'}`}
                      >
                        <Music className="w-4 h-4 text-saudi-green-700" />
                        <span>{t('الزفات والفنون')}</span>
                      </Link>
                      <Link
                        href="/inspiration"
                        onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${pathname.startsWith('/inspiration') ? 'bg-saudi-green-50 font-bold text-saudi-green-800' : 'hover:bg-gray-50 hover:text-saudi-green-800'}`}
                      >
                        <Lightbulb className="w-4 h-4 text-saudi-green-700" />
                        <span>{t('إلهام')}</span>
                      </Link>
                      <Link
                        href="/scan"
                        onClick={(e) => e.currentTarget.closest('details')?.removeAttribute('open')}
                        className={`flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition ${pathname.startsWith('/scan') ? 'bg-saudi-green-50 font-bold text-saudi-green-800' : 'hover:bg-gray-50 hover:text-saudi-green-800'}`}
                      >
                        <QrCode className="w-4 h-4 text-saudi-green-700" />
                        <span>{t('ماسح الدخول')}</span>
                      </Link>
                    </div>
                  </details>
                </>
              )}

              {/* 2. When Active Role is Vendor (Supplier) */}
              {currentRole === 'vendor' && (
                <>
                  <Link
                    href="/vendor"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      pathname === '/vendor' ? 'text-saudi-green-800 font-bold bg-saudi-green-50' : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Store className="w-4 h-4 text-saudi-green-800" />
                    <span>{t('بوابة الموردين')}</span>
                  </Link>
                  <Link
                    href="/commerce/orders"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <Calendar className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('طلبات الحجز المباشرة')}</span>
                  </Link>
                  <Link
                    href="/commerce/orders"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <FileText className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('طلبات عروض الأسعار (RFQ)')}</span>
                  </Link>
                  <Link
                    href="/commerce/manage"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <Layers className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('خدماتي وباقاتي')}</span>
                  </Link>
                  <Link
                    href="/commerce/pricing"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <CreditCard className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('التسعير والخصومات')}</span>
                  </Link>
                  <Link
                    href="/vendor/catalog"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('بيانات المتجر')}</span>
                  </Link>
                  <Link
                    href="/marketplace"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1 text-gray-500"
                  >
                    <ShoppingBag className="w-4 h-4 text-gray-500" />
                    <span>{t('استعراض السوق كعميل')}</span>
                  </Link>
                </>
              )}

              {/* 3. When Active Role is Admin */}
              {currentRole === 'admin' && (
                <>
                  <Link
                    href="/admin"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      pathname === '/admin' && (!currentTab || currentTab === 'overview')
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <ShieldCheck className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('لوحة الإدارة المركزية')}</span>
                  </Link>
                  <Link
                    href="/admin/oms"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1.5 ${
                      pathname === '/admin/oms'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <TrendingUp className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('إدارة الطلبات (OMS)')}</span>
                  </Link>
                  <Link
                    href="/admin?tab=vendors"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname === '/admin' && currentTab === 'vendors'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Store className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('الموردين والاعتماد')}</span>
                  </Link>
                  <Link
                    href="/commerce/orders"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname === '/admin' && currentTab === 'bookings'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <CreditCard className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('الحجوزات والمالية')}</span>
                  </Link>
                  <Link
                    href="/commerce/manage"
                    className={`px-3 py-2 rounded-lg transition flex items-center gap-1 ${
                      pathname === '/admin' && currentTab === 'services'
                        ? 'text-saudi-green-800 font-bold bg-saudi-green-50'
                        : 'hover:text-saudi-green-800 hover:bg-gray-50'
                    }`}
                  >
                    <Settings className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('إعدادات الكتالوج')}</span>
                  </Link>
                  <Link
                    href="/commerce/pricing"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1"
                  >
                    <CreditCard className="w-4 h-4 text-saudi-green-700" />
                    <span>{t('التسعير والخصومات')}</span>
                  </Link>
                  <Link
                    href="/"
                    className="px-3 py-2 rounded-lg hover:text-saudi-green-800 hover:bg-gray-50 transition flex items-center gap-1 text-gray-500"
                  >
                    <span>{t('معاينة الواجهة كعميل')}</span>
                  </Link>
                </>
              )}
            </nav>
          </div>

          {/* Left: Role-Specific Action CTAs */}
          <div className="flex items-center gap-2 sm:gap-3">
            {(currentRole === 'admin' || currentRole === 'vendor') && <RemindersBell />}
            {/* 1. Customer Actions */}
            {currentRole === 'client' && (
              <>
                {/* Active Occasion Workspace Selector Button */}
                {occasions.length > 0 && (
                  <div className="relative hidden xl:block">
                    <button
                      onClick={() => setIsOccasionDropdownOpen(!isOccasionDropdownOpen)}
                      className="flex items-center gap-2 bg-saudi-sand-100 border border-saudi-sand-300 hover:border-saudi-gold-400 px-3 py-1.5 rounded-xl text-right transition"
                    >
                      <div className="w-7 h-7 rounded-lg bg-saudi-green-800 text-saudi-gold-300 flex items-center justify-center text-xs font-bold">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div className="flex flex-col">
                        <span className="text-xs font-bold text-gray-900 line-clamp-1 max-w-[130px]">
                          {activeOccasion?.title}
                        </span>
                        <span className="text-caption2 text-saudi-green-700 font-semibold">
                          {t('جاهزية:')} {activeOccasion?.readinessPercentage}%
                        </span>
                      </div>
                      <ChevronDown className="w-3.5 h-3.5 text-gray-500" />
                    </button>

                    {isOccasionDropdownOpen && (
                      <div
                        className="absolute left-0 mt-2 w-72 bg-white rounded-2xl shadow-2xl border border-gray-100 p-2 z-50 animate-fadeIn"
                        onClick={() => setIsOccasionDropdownOpen(false)}
                      >
                        <div className="text-xs font-bold text-gray-500 px-3 py-1 border-b border-gray-100">
                          {t('مناسباتك الحالية (')}{occasions.length})
                        </div>
                        <div className="max-h-60 overflow-y-auto divide-y divide-gray-50 my-1">
                          {occasions.map((occ) => (
                            <button
                              key={occ.id}
                              onClick={() => {
                                setActiveOccasionId(occ.id);
                                router.push(`/occasion/${occ.id}`);
                              }}
                              className={`w-full text-right p-2.5 rounded-xl text-xs hover:bg-saudi-sand-50 transition flex items-center justify-between ${
                                occ.id === activeOccasion?.id ? 'bg-saudi-green-50 border border-saudi-green-200' : ''
                              }`}
                            >
                              <div>
                                <p className="font-bold text-gray-900">{occ.title}</p>
                                <p className="text-caption2 text-gray-500">{occ.cityNameAr} • {occ.date}</p>
                              </div>
                              <span className="text-xs font-bold text-saudi-green-800 bg-saudi-green-100 px-2 py-0.5 rounded-full">
                                {occ.readinessPercentage}%
                              </span>
                            </button>
                          ))}
                        </div>
                        <Link
                          href="/plan"
                          className="w-full mt-1 flex items-center justify-center gap-1.5 py-2 px-3 bg-saudi-green-800 text-white font-bold rounded-xl text-xs hover:bg-saudi-green-900 transition"
                        >
                          <PlusCircle className="w-3.5 h-3.5 text-saudi-gold-300" />
                          <span>{t('إنشاء مناسبة جديدة')}</span>
                        </Link>
                      </div>
                    )}
                  </div>
                )}

                {/* Compare Bar Button if active */}
                {comparisonVendorIds.length > 0 && (
                  <Link
                    href="/compare"
                    className="flex items-center gap-1.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border border-saudi-sand-300 transition"
                    title={t('مقارنة الموردين')}
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5 text-saudi-gold-600" />
                    <span className="hidden sm:inline">{t('مقارنة')}</span>
                    <span className="bg-saudi-gold-500 text-saudi-green-950 text-caption2 font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {comparisonVendorIds.length}
                    </span>
                  </Link>
                )}

                {/* Shopping Cart Button */}
                <Link
                  href="/commerce/cart"
                  onClick={(e) => cartGate(e, '/commerce/cart')}
                  className="relative flex items-center gap-1.5 bg-saudi-sand-100 hover:bg-saudi-sand-200 text-saudi-green-950 px-2.5 sm:px-3 py-2 rounded-xl text-xs font-bold border border-saudi-sand-300 transition"
                  title={t('سلة الحجوزات')}
                >
                  <ShoppingBag className="w-4 h-4 text-saudi-green-800" />
                  <span className="hidden sm:inline">{t('السلة')}</span>
                  {cart.length > 0 && (
                    <span className="bg-saudi-green-800 text-white text-caption2 font-bold w-4 h-4 rounded-full flex items-center justify-center shadow-sm">
                      {cart.reduce((sum, item) => sum + item.quantity, 0)}
                    </span>
                  )}
                </Link>

                {/* AI Assistant Button (لُـمى) */}
                {locale === 'ar' && <FeatureContent id="luma"><button
                  onClick={() => setIsAIOpen(true)}
                  className="flex items-center gap-1.5 bg-white hover:bg-saudi-sand-100 border border-saudi-gold-400 text-saudi-green-900 px-3 sm:px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  <Sparkles className="w-4 h-4 text-saudi-gold-600" />
                  <span className="hidden sm:inline">{adminConfig.aiAssistantNameAr} {t('(الذكاء الاصطناعي)')}</span>
                  <span className="sm:hidden">{t('لُـمى')}</span>
                </button></FeatureContent>}

                {/* Create Occasion Direct CTA */}
                <Link
                  href="/plan"
                  className="hidden md:flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3.5 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-sm transition"
                >
                  <PlusCircle className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('+ أنشئ مناسبتك')}</span>
                </Link>
              </>
            )}

            {/* 2. Supplier Actions */}
            {currentRole === 'vendor' && (
              <>
                <Link
                  href="/vendor"
                  className="flex items-center gap-1.5 bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 px-3 py-2 rounded-xl text-xs sm:text-sm font-bold shadow-md transition"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>{t('+ إضافة خدمة جديدة')}</span>
                </Link>

                {locale === 'ar' && <FeatureContent id="luma"><button
                  onClick={() => setIsAIOpen(true)}
                  className="flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Sparkles className="w-3.5 h-3.5 text-saudi-gold-400" />
                  <span>{t('مستشار المورد الذكي')}</span>
                </button></FeatureContent>}
              </>
            )}

            {/* 3. Admin Actions */}
            {currentRole === 'admin' && (
              <>
                <Link
                  href="/admin"
                  className="hidden sm:flex items-center gap-1.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white px-3.5 py-2 rounded-xl text-xs font-bold transition"
                >
                  <ShieldCheck className="w-4 h-4 text-saudi-gold-400" />
                  <span>{t('لوحة التحكم الكاملة')}</span>
                </Link>
                {locale === 'ar' && <FeatureContent id="luma"><button
                  onClick={() => setIsAIOpen(true)}
                  className="hidden sm:flex items-center gap-1.5 bg-white hover:bg-saudi-sand-100 border border-saudi-gold-400 text-saudi-green-900 px-3 py-2 rounded-xl text-xs font-bold transition"
                >
                  <Sparkles className="w-4 h-4 text-saudi-gold-600" />
                  <span>{t('مستشارة الموردين')}</span>
                </button></FeatureContent>}
              </>
            )}

            {/* Mobile menu button */}
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              aria-label={isMobileMenuOpen ? t('إغلاق القائمة') : t('فتح القائمة')}
              aria-expanded={isMobileMenuOpen}
              className="lg:hidden p-2 text-gray-700 hover:text-saudi-green-800 rounded-lg"
            >
              {isMobileMenuOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Drawer */}
      {isMobileMenuOpen && (
        <div className="lg:hidden border-t border-gray-200 bg-white px-4 py-4 space-y-3 animate-fadeIn">
          {/* User profile section in mobile */}
          {currentUser ? (
            <div className="p-3 bg-saudi-sand-100 rounded-2xl flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={currentUser.avatar || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=60&auto=format&fit=crop&q=80'}
                  alt={currentUser.name}
                  className="w-8 h-8 rounded-full object-cover border"
                />
                <div>
                  <p className="font-bold text-xs text-gray-900">{currentUser.name}</p>
                  <p className="text-caption2 text-gray-600">
                    {currentUser.hasSystemAccess ? t('مدير النظام') : currentUser.role === 'admin' ? t('مشرف المنصة') : currentUser.role === 'vendor' ? t('مورد معتمد') : t('صاحب مناسبة')}
                  </p>
                </div>
              </div>
              {currentUser.hasSystemAccess && <Link href="/system-admin" className="text-xs font-bold underline text-amber-800">{t('مدير النظام')}</Link>}
              <Link href="/settings/channels" className="text-xs underline text-saudi-green-900">{t('إعدادات إرسال الدعوات')}</Link>
              <button
                onClick={logoutUser}
                className="text-xs text-red-600 font-bold p-1 hover:bg-white rounded"
              >
                {t('خروج')}
              </button>
            </div>
          ) : (
            <button
              onClick={() => {
                setIsMobileMenuOpen(false);
                openOnboarding();
              }}
              className="w-full py-2.5 bg-saudi-gold-500 text-saudi-green-950 font-bold rounded-xl text-xs shadow"
            >
              {t('تسجيل حساب جديد أو تسجيل الدخول')}
            </button>
          )}

          {/* Links depending on role */}
          {currentRole === 'client' && (
            <>
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                {t('الرئيسية')}
              </Link>
              <Link
                href="/marketplace"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                {t('سوق الخدمات والتجهيزات')}
              </Link>
              <Link
                href="/commerce/cart"
                onClick={(e) => { setIsMobileMenuOpen(false); cartGate(e, '/commerce/cart'); }}
                className="flex items-center justify-between py-2 text-sm font-bold text-saudi-green-900"
              >
                <span className="flex items-center gap-2">
                  <ShoppingBag className="w-4 h-4 text-saudi-gold-600" />
                  <span>{t('سلة الحجوزات')}</span>
                </span>
                {cart.length > 0 && (
                  <span className="bg-saudi-green-800 text-white text-xs px-2 py-0.5 rounded-full font-mono">
                    {cart.reduce((s, i) => s + i.quantity, 0)}
                  </span>
                )}
              </Link>
              <Link
                href="/packages"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                {t('الباقات الذكية الجاهزة')}
              </Link>
              <Link
                href="/calculator"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                {t('حاسبة تكاليف وميزانية المناسبات')}
              </Link>
              <Link
                href="/commerce/orders"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                {t('طلباتي وحجوزاتي')}
              </Link>
              <Link
                href="/commerce"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-800 hover:text-saudi-green-800"
              >
                {t('طلب ومقارنة عروض الأسعار (RFQ)')}
              </Link>
              <Link
                href="/plan"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block text-center py-2.5 bg-saudi-green-800 text-white rounded-xl font-bold text-sm"
              >
                {t('+ إنشاء مناسبة جديدة')}
              </Link>
            </>
          )}

          {currentRole === 'vendor' && (
            <>
              <Link
                href="/vendor"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-saudi-green-800"
              >
                {t('لوحة تحكم بوابة الموردين')}
              </Link>
              <Link
                href="/marketplace"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-700"
              >
                {t('تصفح سوق المناسبات كعميل')}
              </Link>
            </>
          )}

          {currentRole === 'admin' && (
            <>
              <Link
                href="/admin"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && (!currentTab || currentTab === 'overview')
                    ? 'text-saudi-green-800'
                    : 'text-gray-700'
                }`}
              >
                {t('لوحة الإدارة المركزية')}
              </Link>
              <Link
                href="/admin/oms"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin/oms' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                {t('إدارة الطلبات (OMS)')}
              </Link>
              <Link
                href="/admin?tab=vendors"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && currentTab === 'vendors' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                {t('الموردين والاعتماد')}
              </Link>
              <Link
                href="/commerce/orders"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && currentTab === 'bookings' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                {t('الحجوزات والمالية')}
              </Link>
              <Link
                href="/commerce/manage"
                onClick={() => setIsMobileMenuOpen(false)}
                className={`block py-2 text-sm font-bold ${
                  pathname === '/admin' && currentTab === 'services' ? 'text-saudi-green-800' : 'text-gray-700'
                }`}
              >
                {t('إعدادات الكتالوج')}
              </Link>
              <Link
                href="/commerce/pricing"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-700"
              >
                {t('التسعير والخصومات')}
              </Link>
              <Link
                href="/"
                onClick={() => setIsMobileMenuOpen(false)}
                className="block py-2 text-sm font-bold text-gray-500"
              >
                {t('معاينة الواجهة كعميل')}
              </Link>
            </>
          )}
        </div>
      )}
    </header>
  );
}

export default function Navbar() {
  return (
    <Suspense fallback={<header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-saudi-sand-200 h-16" />}>
      <NavbarContent />
    </Suspense>
  );
}
