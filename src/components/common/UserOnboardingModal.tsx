'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Turnstile, { captchaConfigured } from '@/components/common/Turnstile';
import PasswordInput from '@/components/common/PasswordInput';
import AlternativeSignIn, { useSignInMethods } from '@/components/common/AlternativeSignIn';
import { useRouter } from 'next/navigation';
import { useApp } from '@/lib/store';
import {
  Sparkles,
  Store,
  Calendar,
  ShieldCheck,
  CheckCircle2,
  X,
  ArrowRight,
  UserCheck,
  FileText,
  MapPin,
  Phone,
  Mail,
  Lock,
  Building2,
  DollarSign,
  TrendingUp,
  Heart,
  ChevronLeft,
  AlertCircle,
  HelpCircle,
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { useT, usePick } from '@/components/i18n/LocaleProvider';

export default function UserOnboardingModal() {
  const tr = useT(); const pick = usePick();
  const router = useRouter();
  const {
    cities,
    serviceCategories,
    occasionTypes,
    isOnboardingOpen,
    setIsOnboardingOpen,
    onboardingInitialRole,
    setOnboardingInitialRole,
    onboardingGate,
    setOnboardingGate,
    registerCustomer,
    registerVendor,
    loginUser,
    permissionNotice,
    clearPermissionNotice,
    switchRole,
  } = useApp();

  // Active step: 'select_role' | 'customer_form' | 'vendor_form' | 'login' | 'success'
  const [step, setStep] = useState<'gate' | 'select_role' | 'customer_form' | 'vendor_form' | 'login' | 'success'>('select_role');
  const [selectedRoleForOnboarding, setSelectedRoleForOnboarding] = useState<'client' | 'vendor'>('client');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successInfo, setSuccessInfo] = useState<{ name: string; role: 'client' | 'vendor' | 'admin'; redirectPath: string } | null>(null);

  // Customer Form Data
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    email: '',
    cityId: 'riyadh',
    upcomingOccasionType: 'wedding',
    occasionDate: '',
    password: '',
    acceptTerms: true,
  });

  // Vendor Form Data
  const [vendorData, setVendorData] = useState({
    businessName: '',
    businessNameEn: '',
    categoryId: 'photography',
    cityId: 'riyadh',
    neighborhood: 'الملقا',
    crNumber: '',
    freelanceLicense: '',
    vatNumber: '',
    contactName: '',
    contactPhone: '',
    whatsappNumber: '',
    startingPrice: '2500',
    bioAr: '',
    password: '',
    acceptTerms: true,
  });

  // Login Form Data
  const [loginIdentifier, setLoginIdentifier] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [captchaToken, setCaptchaToken] = useState(''), [captchaNeeded, setCaptchaNeeded] = useState(false), [captchaRound, setCaptchaRound] = useState(0);
  const onCaptcha = useCallback((token: string) => setCaptchaToken(token), []);
  const freshCaptcha = () => { setCaptchaToken(''); setCaptchaRound(n => n + 1); };   // a token works once
  // Accounts with an authenticator app are asked for a code after the password is accepted.
  const [mfaStep, setMfaStep] = useState(false);
  const [loginCode, setLoginCode] = useState('');
  // Set when the server locks sign-in after repeated wrong passwords; the form stays disabled until the time passes.
  const [lockedUntil, setLockedUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { if (lockedUntil <= Date.now()) return; const t = setInterval(() => { const n = Date.now(); setNow(n); if (n >= lockedUntil) { setLockedUntil(0); setErrorMessage(''); } }, 1000); return () => clearInterval(t); }, [lockedUntil]);
  const lockSeconds = lockedUntil > now ? Math.ceil((lockedUntil - now) / 1000) : 0;

  // Which sign-in methods the administrator enabled (password only until the answer arrives).
  const signIn = useSignInMethods();
  const passwordOn = signIn?.methods.password !== false;
  // Coming back from Google / Apple with a problem: reopen the sign-in step and say what happened.
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('auth_error'); if (!code) return;
    const messages: Record<string, string> = { cancelled: 'تم إلغاء الدخول.', mfa: 'هذا الحساب محمي بتطبيق مصادقة؛ سجّل الدخول بكلمة المرور أو برمز التحقق ثم أدخل رمز التطبيق.', disabled: 'هذا الحساب معطل؛ تواصل مع الإدارة.', rate: 'محاولات كثيرة؛ حاول بعد قليل.', profile: 'لم يكتمل إنشاء الحساب؛ حاول مرة أخرى.', unavailable: 'طريقة الدخول هذه غير متاحة حالياً.', failed: 'تعذر تسجيل الدخول؛ حاول مرة أخرى.' };
    const url = new URL(window.location.href); url.searchParams.delete('auth_error'); window.history.replaceState(null, '', url.pathname + url.search + url.hash);
    setOnboardingInitialRole(null); setIsOnboardingOpen(true); setStep('login'); setErrorMessage(tr(messages[code] || messages.failed));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync initial role when modal opens
  useEffect(() => {
    if (isOnboardingOpen) {
      setErrorMessage('');
      if (onboardingGate) {
        setSelectedRoleForOnboarding('client');
        setStep('gate');
      } else if (onboardingInitialRole === 'vendor') {
        setSelectedRoleForOnboarding('vendor');
        setStep('vendor_form');
      } else if (onboardingInitialRole === 'client') {
        setSelectedRoleForOnboarding('client');
        setStep('customer_form');
      } else {
        setStep('select_role');
      }
    }
  }, [isOnboardingOpen, onboardingInitialRole, onboardingGate]);

  if (!isOnboardingOpen && !permissionNotice?.open) return null;

  // Trigger celebration confetti
  const triggerConfetti = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#0d5c3a', '#c2933d', '#f59e0b', '#10b981'],
      });
    } catch (e) {
      // safe fallback
    }
  };

  const handleCustomerSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!customerData.name.trim() || !customerData.phone.trim()) {
      setErrorMessage(tr('يرجى كتابة الاسم ورقم الجوال بشكل صحيح.'));
      return;
    }

    setIsSubmitting(true);
    const res = await registerCustomer({
      name: customerData.name,
      phone: customerData.phone,
      email: customerData.email,
      cityId: customerData.cityId,
      upcomingOccasionType: customerData.upcomingOccasionType,
      occasionDate: customerData.occasionDate,
      password: customerData.password,
      captchaToken,
    });

    setIsSubmitting(false);
    if (!res.success) {
      freshCaptcha();
      setErrorMessage(res.error || tr('حدث خطأ أثناء التسجيل'));
      return;
    }

    triggerConfetti();
    setSuccessInfo({
      name: res.user?.name || customerData.name,
      role: 'client',
      redirectPath: '/',
    });
    setStep('success');
  };

  const handleVendorSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!vendorData.businessName.trim() || !vendorData.contactPhone.trim()) {
      setErrorMessage(tr('يرجى إدخال اسم المنشأة ورقم التواصل.'));
      return;
    }

    setIsSubmitting(true);
    const res = await registerVendor({
      captchaToken,
      businessName: vendorData.businessName,
      businessNameEn: vendorData.businessNameEn,
      categoryId: vendorData.categoryId,
      cityId: vendorData.cityId,
      neighborhood: vendorData.neighborhood,
      crNumber: vendorData.crNumber,
      freelanceLicense: vendorData.freelanceLicense,
      vatNumber: vendorData.vatNumber,
      contactName: vendorData.contactName || vendorData.businessName,
      contactPhone: vendorData.contactPhone,
      whatsappNumber: vendorData.whatsappNumber || vendorData.contactPhone,
      startingPrice: Number(vendorData.startingPrice) || 1500,
      bioAr: vendorData.bioAr,
      password: vendorData.password,
    });

    setIsSubmitting(false);
    if (!res.success) {
      freshCaptcha();
      setErrorMessage(res.error || tr('حدث خطأ أثناء تسجيل المورد'));
      return;
    }

    triggerConfetti();
    setSuccessInfo({
      name: res.user?.businessName || vendorData.businessName,
      role: 'vendor',
      redirectPath: '/vendor',
    });
    setStep('success');
  };

  const handleLoginSubmit = async (identifier: string, requestedRole?: 'client' | 'vendor' | 'admin') => {
    setErrorMessage('');
    setIsSubmitting(true);
    const res = await loginUser(identifier, requestedRole, loginPassword, mfaStep ? loginCode : undefined, captchaNeeded ? captchaToken : undefined);
    setIsSubmitting(false);
    if (captchaNeeded) freshCaptcha();
    if (res.captchaRequired) setCaptchaNeeded(true);

    if (res.mfaRequired) { setMfaStep(true); setLoginCode(''); setErrorMessage(''); return; }
    if (!res.success) {
      if (mfaStep) setLoginCode('');
      setErrorMessage(res.error || tr('فشل تسجيل الدخول'));
      if (res.retryAfter) { setNow(Date.now()); setLockedUntil(Date.now() + res.retryAfter * 1000); setLoginPassword(''); }
      return;
    }

    triggerConfetti();
    const dest = res.user?.hasSystemAccess ? '/system-admin' : res.user?.role === 'admin' ? '/admin' : res.user?.role === 'vendor' ? '/vendor' : '/';
    setSuccessInfo({
      name: res.user?.name || 'مرحباً بك',
      role: res.user?.role || 'client',
      redirectPath: dest,
    });
    setStep('success');
  };

  const handleFinishSuccess = () => {
    // Signed in mid-shopping: go back to where the shopper was instead of the home page.
    const dest = onboardingGate?.returnTo || successInfo?.redirectPath || '/';
    setIsOnboardingOpen(false);
    setOnboardingGate(null);
    clearPermissionNotice();
    router.push(dest);
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="dlg-9634-1" className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 backdrop-blur-md animate-fadeIn">
      {/* Modal Card */}
      <div className="relative w-full max-w-2xl bg-white rounded-3xl shadow-2xl border border-saudi-sand-300 overflow-hidden max-h-[92vh] flex flex-col">
        {/* Header Ribbon */}
        <div className="bg-saudi-green-950 text-white p-5 sm:p-6 relative">
          <button
            onClick={() => {
              setIsOnboardingOpen(false);
              setOnboardingGate(null);
              clearPermissionNotice();
            }}
            className="absolute left-4 top-4 p-2 text-gray-300 hover:text-white rounded-full bg-white/10 hover:bg-white/20 transition"
            title={tr('إغلاق')}
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-saudi-gold-400 text-xs font-bold mb-1">
            <Sparkles className="w-4 h-4" />
            <span>{tr('منصة مناسبتـي الرقمية')}</span>
          </div>

          <h2 className="text-xl sm:text-2xl font-black font-cairo text-white" id="dlg-9634-1">
            {step === 'gate' && tr('سجّل الدخول أو أنشئ حساباً للمتابعة')}
            {step === 'select_role' && tr('اختر نوع الحساب للانطلاق')}
            {step === 'customer_form' && tr('إنشاء حساب صاحب المناسبة')}
            {step === 'vendor_form' && tr('تسجيل منشأة أو مورد جديد')}
            {step === 'login' && tr('تسجيل الدخول إلى حسابك')}
            {step === 'success' && tr('أهلاً وسهلاً بك في مناسبتـي!')}
          </h2>

          <p className="text-xs sm:text-sm text-gray-300 mt-1">
            {step === 'gate' && tr('تصفّح الخدمات متاح للجميع. نحتاج حسابك فقط لحفظ السلة وإتمام طلبك، ولن تفقد اختياراتك.')}
            {step === 'select_role' && tr('سواء كنت تخطط لاحتفال فاخر أو تقدم خدمات احترافية، نوفر لك تجربة مخصصة بالكامل.')}
            {step === 'customer_form' && tr('احجز أفضل الموردين والقاعات ونظّم ميزانيتك وبطاقات دعواتك في مكان واحد.')}
            {step === 'vendor_form' && tr('انضم إلى شبكة الموردين المعتمدين في المملكة واستقبل طلبات الحجز وعروض الأسعار.')}
            {step === 'login' && tr('سجّل الدخول للوصول إلى حجوزاتك، عروضك، ومساحة العمل الخاصة بك.')}
            {step === 'success' && tr('تم تجهيز مساحة عملك بنجاح وتطبيق الصلاحيات الملائمة.')}
          </p>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 overflow-y-auto flex-1 space-y-5">
          {/* Permission Notice Banner if triggered from guarded route */}
          {permissionNotice?.open && step === 'select_role' && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-start gap-3 text-amber-900 animate-fadeIn">
              <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="text-xs sm:text-sm">
                <p className="font-bold">{permissionNotice.messageAr}</p>
                <p className="text-amber-700 text-xs mt-0.5">
                  {tr('يرجى تحديد هويتك أدناه أو تسجيل الدخول بالحساب المناسب لمتابعة التصفح.')}
                </p>
              </div>
            </div>
          )}

          {errorMessage && (
            <div role="alert" id="login-error" className="bg-red-50 border border-red-200 text-red-800 rounded-2xl p-3.5 text-sm flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 0: Shopping gate (sign in or sign up before the cart) */}
          {step === 'gate' && (
            <div className="space-y-3">
              <button
                type="button"
                autoFocus
                onClick={() => setStep('login')}
                className="w-full rounded-2xl bg-saudi-green-800 hover:bg-saudi-green-900 px-5 py-3.5 text-sm font-bold text-white transition"
              >
                {tr('تسجيل الدخول')}
              </button>
              <button
                type="button"
                onClick={() => { setSelectedRoleForOnboarding('client'); setStep('customer_form'); }}
                className="w-full rounded-2xl border-2 border-saudi-green-800 bg-white hover:bg-saudi-green-50 px-5 py-3.5 text-sm font-bold text-saudi-green-900 transition"
              >
                {tr('إنشاء حساب جديد')}
              </button>
              <button
                type="button"
                onClick={() => { setIsOnboardingOpen(false); setOnboardingGate(null); }}
                className="w-full rounded-2xl px-5 py-2.5 text-sm font-bold text-gray-600 hover:bg-saudi-sand-100 transition"
              >
                {tr('متابعة التسوق دون حساب')}
              </button>
            </div>
          )}

          {/* STEP 1: Select Role */}
          {step === 'select_role' && (
            <div className="space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* 1. Customer Option Card */}
                <div
                  onClick={() => {
                    setSelectedRoleForOnboarding('client');
                    setStep('customer_form');
                  }}
                  className="group relative cursor-pointer rounded-2xl border-2 border-saudi-sand-300 hover:border-saudi-green-800 bg-white p-5 transition duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-saudi-green-100 text-saudi-green-900 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                        <Calendar className="w-6 h-6 text-saudi-green-800" />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-saudi-green-50 text-saudi-green-800 border border-saudi-green-200">
                        {tr('صاحب المناسبة')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black font-cairo text-gray-900 group-hover:text-saudi-green-900 transition">
                        {tr('صاحب المناسبة (عميل)')}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {tr('أبحث عن خدمات وموردين وباقات لتنظيم مناسبتي الخاصة أو العائلية.')}
                      </p>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-saudi-sand-200 text-xs text-gray-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 flex-shrink-0" />
                        <span>{tr('استعراض وحجز أكثر من 10 تصنيفات معتمدة')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 flex-shrink-0" />
                        <span>{tr('مخطط الطاولات والميزانية والبطاقات بالـ QR')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-green-700 flex-shrink-0" />
                        <span>{tr('عانية ونقوط رقمية تصل لصاحب المناسبة')}</span>
                      </li>
                    </ul>
                  </div>

                  <button className="mt-5 w-full py-2.5 px-4 rounded-xl bg-saudi-green-800 group-hover:bg-saudi-green-900 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition">
                    <span>{tr('متابعة كصاحب مناسبة')}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>

                {/* 2. Supplier Option Card */}
                <div
                  onClick={() => {
                    setSelectedRoleForOnboarding('vendor');
                    setStep('vendor_form');
                  }}
                  className="group relative cursor-pointer rounded-2xl border-2 border-saudi-sand-300 hover:border-saudi-gold-600 bg-white p-5 transition duration-200 hover:shadow-xl hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="w-12 h-12 rounded-2xl bg-saudi-gold-100 text-saudi-gold-800 flex items-center justify-center shadow-inner group-hover:scale-105 transition">
                        <Store className="w-6 h-6 text-saudi-gold-700" />
                      </div>
                      <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-saudi-gold-50 text-saudi-gold-800 border border-saudi-gold-200">
                        {tr('مورد / مزود خدمة')}
                      </span>
                    </div>

                    <div>
                      <h3 className="text-lg font-black font-cairo text-gray-900 group-hover:text-saudi-gold-700 transition">
                        {tr('مورد / مزود خدمة')}
                      </h3>
                      <p className="text-xs text-gray-600 mt-1 leading-relaxed">
                        {tr('أقدم خدمات أو منتجات احتفالية وأرغب في عرضها واستقبال الحجوزات.')}
                      </p>
                    </div>

                    <ul className="space-y-2 pt-2 border-t border-saudi-sand-200 text-xs text-gray-700">
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-gold-600 flex-shrink-0" />
                        <span>{tr('ظهور في سوق المناسبات عبر 10 مدن رئيسية')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-gold-600 flex-shrink-0" />
                        <span>{tr('استقبال الحجوزات المباشرة وعروض الأسعار (RFQ)')}</span>
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle2 className="w-3.5 h-3.5 text-saudi-gold-600 flex-shrink-0" />
                        <span>{tr('عروض أسعار تتضمن ضريبة القيمة المضافة 15%')}</span>
                      </li>
                    </ul>
                  </div>

                  <button className="mt-5 w-full py-2.5 px-4 rounded-xl bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-xs flex items-center justify-center gap-2 shadow-sm transition">
                    <span>{tr('متابعة كمورد معتمد')}</span>
                    <ChevronLeft className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Bottom Quick Switch & Demo Access */}
              <div className="pt-4 border-t border-saudi-sand-200 space-y-3">
                <div className="flex items-center justify-between text-xs text-gray-600">
                  <span>{tr('لديك حساب بالفعل على المنصة؟')}</span>
                  <button
                    onClick={() => setStep('login')}
                    className="font-bold text-saudi-green-800 hover:underline flex items-center gap-1"
                  >
                    <span>{tr('تسجيل الدخول')}</span>
                    <ChevronLeft className="w-3.5 h-3.5" />
                  </button>
                </div>


              </div>
            </div>
          )}

          {/* STEP 2A: Customer Registration Form */}
          {step === 'customer_form' && (
            <form onSubmit={handleCustomerSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select_role')}
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1 mb-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{tr('العودة لاختيار نوع الحساب')}</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('الاسم الكامل *')}</label>
                  <input
                    type="text"
                    required
                    value={customerData.name}
                    onChange={(e) => setCustomerData({ ...customerData, name: e.target.value })}
                    placeholder={tr('مثال: سارة عبدالعزيز العتيبي')}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('رقم الجوال السعودي *')}</label>
                  <input
                    type="tel"
                    required
                    value={customerData.phone}
                    onChange={(e) => setCustomerData({ ...customerData, phone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('البريد الإلكتروني (اختياري)')}</label>
                  <input
                    type="email"
                    value={customerData.email}
                    onChange={(e) => setCustomerData({ ...customerData, email: e.target.value })}
                    placeholder="sara@example.com"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('المدينة *')}</label>
                  <select
                    value={customerData.cityId}
                    onChange={(e) => setCustomerData({ ...customerData, cityId: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 bg-white"
                  >
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {pick(city.nameAr, city.nameEn)} ({pick(city.regionAr, city.regionEn)})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('نوع المناسبة القادمة')}</label>
                  <select
                    value={customerData.upcomingOccasionType}
                    onChange={(e) => setCustomerData({ ...customerData, upcomingOccasionType: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 bg-white"
                  >
                    {occasionTypes.map((t) => (
                      <option key={t.id} value={t.id}>
                        {pick(t.nameAr, t.nameEn)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('تاريخ المناسبة التقريبي')}</label>
                  <input
                    type="date"
                    value={customerData.occasionDate}
                    onChange={(e) => setCustomerData({ ...customerData, occasionDate: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800 bg-white"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('تعيين كلمة المرور')}</label>
                  <PasswordInput
                    required minLength={12} maxLength={128} autoComplete="new-password"
                    value={customerData.password}
                    onChange={(e) => setCustomerData({ ...customerData, password: e.target.value })}
                    placeholder="••••••••"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-green-800"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                {captchaConfigured && <Turnstile key={captchaRound} onToken={onCaptcha} />}
                <button
                  type="submit"
                  disabled={isSubmitting || (captchaConfigured && !captchaToken)}
                  className="w-full py-3.5 px-4 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>{tr('جاري إنشاء الحساب...')}</span>
                  ) : (
                    <>
                      <span>{tr('إنشاء الحساب وبدء التخطيط')}</span>
                      <ChevronLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2B: Supplier Registration Form */}
          {step === 'vendor_form' && (
            <form onSubmit={handleVendorSubmit} className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select_role')}
                className="text-xs font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1 mb-2"
              >
                <ArrowRight className="w-3.5 h-3.5" />
                <span>{tr('العودة لاختيار نوع الحساب')}</span>
              </button>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('اسم المنشأة أو العلامة التجارية *')}</label>
                  <input
                    type="text"
                    required
                    value={vendorData.businessName}
                    onChange={(e) => setVendorData({ ...vendorData, businessName: e.target.value })}
                    placeholder={tr('مثال: لافندر لتنسيق الكوش والزهور')}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('الاسم التجاري بالإنجليزية')}</label>
                  <input
                    type="text"
                    value={vendorData.businessNameEn}
                    onChange={(e) => setVendorData({ ...vendorData, businessNameEn: e.target.value })}
                    placeholder="Lavender Events"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('تصنيف الخدمة الأساسي *')}</label>
                  <select
                    value={vendorData.categoryId}
                    onChange={(e) => setVendorData({ ...vendorData, categoryId: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 bg-white"
                  >
                    {serviceCategories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {pick(cat.nameAr, cat.nameEn)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('المدينة الرئيسية *')}</label>
                  <select
                    value={vendorData.cityId}
                    onChange={(e) => setVendorData({ ...vendorData, cityId: e.target.value })}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 bg-white"
                  >
                    {cities.map((city) => (
                      <option key={city.id} value={city.id}>
                        {pick(city.nameAr, city.nameEn)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('الحي / المنطقة')}</label>
                  <input
                    type="text"
                    value={vendorData.neighborhood}
                    onChange={(e) => setVendorData({ ...vendorData, neighborhood: e.target.value })}
                    placeholder={tr('مثال: حطين / النرجس')}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('السجل التجاري أو وثيقة العمل الحر')}</label>
                  <input
                    type="text"
                    value={vendorData.crNumber}
                    onChange={(e) => setVendorData({ ...vendorData, crNumber: e.target.value })}
                    placeholder={tr('1010XXXXXX أو FL-XXXXX')}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('اسم المسؤول / مدير الحساب')}</label>
                  <input
                    type="text"
                    value={vendorData.contactName}
                    onChange={(e) => setVendorData({ ...vendorData, contactName: e.target.value })}
                    placeholder={tr('اسم ممثل المنشأة')}
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('رقم الجوال للتواصل *')}</label>
                  <input
                    type="tel"
                    required
                    value={vendorData.contactPhone}
                    onChange={(e) => setVendorData({ ...vendorData, contactPhone: e.target.value })}
                    placeholder="05XXXXXXXX"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('رقم الواتساب لاستقبال الحجوزات')}</label>
                  <input
                    type="tel"
                    value={vendorData.whatsappNumber}
                    onChange={(e) => setVendorData({ ...vendorData, whatsappNumber: e.target.value })}
                    placeholder="05XXXXXXXX"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500 text-right"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('متوسط السعر المبدئي (⃁)')}</label>
                  <input
                    type="number"
                    value={vendorData.startingPrice}
                    onChange={(e) => setVendorData({ ...vendorData, startingPrice: e.target.value })}
                    placeholder="1500"
                    className="w-full text-xs sm:text-sm px-3.5 py-2.5 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-gray-700 mb-1">{tr('نبذة تعريفية بالخدمات والمنتجات')}</label>
                  <textarea
                    rows={2}
                    value={vendorData.bioAr}
                    onChange={(e) => setVendorData({ ...vendorData, bioAr: e.target.value })}
                    placeholder={tr('اكتب نبذة مختصرة عن خبرتكم في تنظيم وتجهيز المناسبات...')}
                    className="w-full text-xs sm:text-sm px-3.5 py-2 rounded-xl border border-gray-300 focus:outline-none focus:ring-2 focus:ring-saudi-gold-500"
                  />
                </div>
              </div>

              <div className="pt-2 space-y-3">
                <label className="block text-xs font-bold">{tr('كلمة المرور (12 حرفاً على الأقل)')}<PasswordInput required minLength={12} maxLength={128} autoComplete="new-password" value={vendorData.password} onChange={e => setVendorData({ ...vendorData, password: e.target.value })} className="w-full rounded-xl border p-3 mt-1" /></label>
                {captchaConfigured && <Turnstile key={captchaRound} onToken={onCaptcha} />}
                <button
                  type="submit"
                  disabled={isSubmitting || (captchaConfigured && !captchaToken)}
                  className="w-full py-3.5 px-4 rounded-xl bg-saudi-gold-500 hover:bg-saudi-gold-600 text-saudi-green-950 font-bold text-sm shadow-md transition flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <span>{tr('جاري تسجيل المورد وتفعيل البوابة...')}</span>
                  ) : (
                    <>
                      <span>{tr('إتمام تسجيل المنشأة وتفعيل بوابة الموردين')}</span>
                      <ChevronLeft className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2C: Login Form */}
          {step === 'login' && (
            <div className="space-y-4">
              <button
                type="button"
                onClick={() => setStep('select_role')}
                className="text-sm font-bold text-saudi-green-800 hover:text-saudi-green-950 flex items-center gap-1 mb-2"
              >
                <ArrowRight className="w-4 h-4" />
                <span>{tr('العودة لاختيار نوع الحساب')}</span>
              </button>

              {passwordOn && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (lockSeconds > 0) return;
                  if (!loginIdentifier.trim()) {
                    setErrorMessage(tr('يرجى إدخال رقم الجوال أو البريد الإلكتروني'));
                    return;
                  }
                  handleLoginSubmit(loginIdentifier);
                }}
                className="space-y-4"
                aria-describedby={errorMessage ? 'login-error' : undefined}
              >
                <div>
                  <label htmlFor="login-identifier" className="block text-sm font-bold text-gray-800 mb-1.5">{tr('رقم الجوال أو البريد الإلكتروني')}</label>
                  <input
                    id="login-identifier"
                    type="text"
                    required
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    value={loginIdentifier}
                    onChange={(e) => { setLoginIdentifier(e.target.value); setMfaStep(false); }}
                    placeholder={tr('05XXXXXXXX أو البريد الإلكتروني')}
                    className="w-full text-base px-4 py-3 rounded-xl border border-gray-300 text-start focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800 focus-visible:border-saudi-green-800"
                  />
                </div>

                <div>
                  <label htmlFor="login-password" className="block text-sm font-bold text-gray-800 mb-1.5">{tr('كلمة المرور')}</label>
                  <PasswordInput
                    id="login-password"
                    required
                    autoComplete="current-password"
                    value={loginPassword}
                    onChange={e => { setLoginPassword(e.target.value); setMfaStep(false); }}
                    placeholder="••••••••"
                    className="w-full text-base px-4 py-3 rounded-xl border border-gray-300 focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800 focus-visible:border-saudi-green-800"
                  />
                </div>

                {mfaStep && (
                  <div>
                    <label htmlFor="login-code" className="block text-sm font-bold text-gray-800 mb-1.5">{tr('رمز التحقق من تطبيق المصادقة')}</label>
                    <input
                      id="login-code"
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      autoFocus
                      required
                      maxLength={16}
                      value={loginCode}
                      onChange={(e) => setLoginCode(e.target.value)}
                      placeholder="123456"
                      className="w-full text-base px-4 py-3 rounded-xl border border-gray-300 tracking-widest focus:outline-none focus-visible:ring-2 focus-visible:ring-saudi-green-800 focus-visible:border-saudi-green-800"
                    />
                    <p className="mt-1.5 text-sm text-gray-600">{tr('افتح تطبيق المصادقة وأدخل الرمز المكوّن من 6 أرقام. إذا فقدت هاتفك، أدخل أحد رموز الاسترداد.')}</p>
                  </div>
                )}

                {captchaNeeded && <Turnstile key={captchaRound} onToken={onCaptcha} />}
                <p className="text-center text-sm"><a href="/forgot-password" className="font-bold text-saudi-green-800 underline underline-offset-2">{tr('نسيت كلمة المرور؟')}</a></p>
                <button
                  type="submit"
                  disabled={isSubmitting || lockSeconds > 0 || (captchaNeeded && !captchaToken)}
                  className="w-full py-3.5 px-4 rounded-xl bg-saudi-green-800 hover:bg-saudi-green-900 disabled:bg-gray-300 disabled:text-gray-600 disabled:cursor-not-allowed text-white font-bold text-base transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-saudi-green-800"
                >
                  {lockSeconds > 0
                    ? `${tr('أعد المحاولة بعد')} ${Math.floor(lockSeconds / 60)}:${String(lockSeconds % 60).padStart(2, '0')}`
                    : isSubmitting ? tr('جاري التحقق...') : tr('تسجيل الدخول')}
                </button>
              </form>
              )}
              {signIn && <AlternativeSignIn methods={signIn.methods} roles={signIn.roles} onError={setErrorMessage} />}
            </div>
          )}

          {/* STEP 3: Success Confirmation */}
          {step === 'success' && (
            <div className="text-center py-6 space-y-4 animate-fadeIn">
              <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 mx-auto flex items-center justify-center shadow-md">
                <CheckCircle2 className="w-10 h-10" />
              </div>

              <div>
                <h3 className="text-xl font-black font-cairo text-gray-900">
                  {tr('مرحباً بك،')} {successInfo?.name}!
                </h3>
                <p className="text-xs sm:text-sm text-gray-600 mt-1 max-w-md mx-auto">
                  {successInfo?.role === 'vendor'
                    ? tr('تم تفعيل حساب المورد وحفظ هويتك في قاعدة البيانات بنجاح. تم توجيهك إلى بوابة الموردين لإدارة الخدمات والطلبات.')
                    : successInfo?.role === 'admin'
                    ? tr('تم تسجيل الدخول بصلاحيات الإدارة والتحكم الكاملة.')
                    : tr('تم تسجيلك بنجاح كصاحب مناسبة. يمكنك الآن اكتشاف الموردين، طلب عروض الأسعار، وتخطيط مناسبتك بكل يسر.')}
                </p>
              </div>

              <div className="pt-2">
                <button
                  onClick={handleFinishSuccess}
                  className="px-8 py-3.5 bg-saudi-green-800 hover:bg-saudi-green-900 text-white font-bold rounded-2xl text-sm shadow-lg transition"
                >
                  {onboardingGate ? tr('متابعة التسوق ←') : tr('الانتقال إلى لوحة التحكم الآن ←')}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
