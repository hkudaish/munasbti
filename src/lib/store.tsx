'use client';
import { notify } from '@/lib/notify';

import { formatSAR } from '@/lib/utils';

import React, { createContext, useContext, useState, useEffect, useRef } from 'react';
import {
  Occasion,
  Guest,
  SeatingTable,
  BudgetItem,
  PlanningTask,
  WishlistGift,
  RFQRequest,
  Booking,
  Review,
  AdminPlatformConfig,
  OccasionType,
  ServiceCategory,
  SaudiCity,
  Vendor,
  ServiceItem,
  SmartPackage,
  InspirationPost,
  PaymentMethod,
  RunOfShowItem,
  EaniyahGift,
  CartItem,
  VendorCartGroup,
  Coupon,
  MultiVendorOrder,
  RankingWeights,
  VendorRecommendationResult,
  ServicePackage,
  CartItemAddon,
  UserProfile,
  UserRole,
  CustomerRegistrationPayload,
  VendorRegistrationPayload,
} from './types';
import {
  INITIAL_TABLES,
  INITIAL_BUDGET_ITEMS,
  INITIAL_TASKS,
  INITIAL_WISHLIST,
  INITIAL_RFQS,
  INITIAL_BOOKINGS,
  INITIAL_REVIEWS,
  INITIAL_ADMIN_CONFIG,
  INITIAL_RUN_OF_SHOW_ITEMS,
  OCCASION_TYPES,
  SERVICE_CATEGORIES,
  SAUDI_CITIES,
  VENDORS,
  SERVICE_ITEMS,
  SMART_PACKAGES,
  INSPIRATION_POSTS,
  INITIAL_EANIYAH_GIFTS,
  INITIAL_COUPONS,
} from './seed-data';
import { 
  generateBookingNumber, 
  generateOrderNumber,
  calculateCartTotals,
  ensureServiceDetails,
  ensureVendorDetails,
} from './utils';
import { useGeo } from '@/components/geo/GeoProvider';
import { requestJSON } from './api-client';
import { useRouter, usePathname } from 'next/navigation';
import { broadcastAuth, subscribeAuth, isProtectedPath, isRevokePending, revokeServerSession, revokeWithRecovery } from './auth-session';
import { DEFAULT_RANKING_WEIGHTS } from './ranking-engine';

interface AppContextType {
  // Navigation & Role
  currentRole: 'client' | 'vendor' | 'admin';
  setCurrentRole: (role: 'client' | 'vendor' | 'admin') => void;
  selectedCity: string;
  setSelectedCity: (cityId: string) => void;
  isAIOpen: boolean;
  setIsAIOpen: (open: boolean) => void;

  // User Profile & Authentication & Onboarding
  currentUser: UserProfile | null;
  setCurrentUser: (user: UserProfile | null) => void;
  isAuthenticated: boolean;
  isOnboardingOpen: boolean;
  setIsOnboardingOpen: (open: boolean) => void;
  onboardingInitialRole: 'client' | 'vendor' | null;
  setOnboardingInitialRole: (role: 'client' | 'vendor' | null) => void;
  openOnboarding: (role?: 'client' | 'vendor', options?: { gate?: boolean; returnTo?: string }) => void;
  /** Set when sign-in was requested mid-shopping: show the sign-in/sign-up prompt, then return to `returnTo`. */
  onboardingGate: { returnTo?: string } | null;
  setOnboardingGate: (gate: { returnTo?: string } | null) => void;
  registerCustomer: (payload: CustomerRegistrationPayload) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  registerVendor: (payload: VendorRegistrationPayload) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
  loginUser: (identifier: string, requestedRole?: UserRole, password?: string, code?: string, captchaToken?: string) => Promise<{ success: boolean; user?: UserProfile; error?: string; retryAfter?: number; mfaRequired?: boolean; captchaRequired?: boolean }>;
  logoutUser: () => void;
  /** True once the server has answered whether anyone is signed in (safe to guard protected pages). */
  authReady: boolean;
  /** Increments on every sign-out; components keyed on it start fresh with no previous-account state. */
  signOutEpoch: number;
  switchRole: (role: UserRole) => { allowed: boolean; messageAr?: string };
  permissionNotice: { open: boolean; targetRole: UserRole | null; messageAr: string } | null;
  clearPermissionNotice: () => void;

  // Occasions
  occasions: Occasion[];
  activeOccasionId: string;
  activeOccasion: Occasion | undefined;
  setActiveOccasionId: (id: string) => void;
  createOccasion: (data: Partial<Occasion>) => Promise<string | null>;
  updateOccasion: (id: string, data: Partial<Occasion>) => void;
  deleteOccasion: (id: string) => void;

  // Static/Config Data
  occasionTypes: OccasionType[];
  serviceCategories: ServiceCategory[];
  cities: SaudiCity[];
  vendors: Vendor[];
  services: ServiceItem[];
  packages: SmartPackage[];
  inspirationPosts: InspirationPost[];

  // Occasion Details & Management
  guests: Guest[];
  addGuest: (guest: Omit<Guest, 'id' | 'qrCode'>) => Promise<boolean>;
  updateGuestStatus: (guestId: string, status: Guest['status']) => Promise<boolean>;
  deleteGuest: (guestId: string) => void;

  tables: SeatingTable[];
  addTable: (table: Omit<SeatingTable, 'id'>) => void;
  assignGuestToTable: (guestId: string, tableId: string, tableName?: string) => void;

  budgetItems: BudgetItem[];
  addBudgetItem: (item: Omit<BudgetItem, 'id'>) => void;
  updateBudgetItem: (id: string, item: Partial<BudgetItem>) => void;
  deleteBudgetItem: (id: string) => void;

  tasks: PlanningTask[];
  toggleTaskCompleted: (taskId: string) => void;
  addTask: (task: Omit<PlanningTask, 'id'>) => void;

  // Run of Show (Day-of Schedule)
  runOfShowItems: RunOfShowItem[];
  addRunOfShowItem: (item: Omit<RunOfShowItem, 'id'>) => void;
  updateRunOfShowItem: (id: string, data: Partial<RunOfShowItem>) => void;
  deleteRunOfShowItem: (id: string) => void;

  wishlistGifts: WishlistGift[];
  addWishlistGift: (gift: Omit<WishlistGift, 'id'>) => void;
  contributeToGift: (giftId: string, amount: number, contributorName: string) => void;

  // Digital Eaniyah & Cash Gifting
  eaniyahGifts: EaniyahGift[];
  sendEaniyahGift: (gift: Omit<EaniyahGift, 'id' | 'createdAt' | 'status' | 'transactionRef'>) => EaniyahGift;
  transferEaniyahPayout: (occasionId: string, iban: string, bankName: string) => void;

  // Marketplace & RFQ & Bookings
  rfqRequests: RFQRequest[];
  createRFQ: (rfq: Omit<RFQRequest, 'id' | 'quotes' | 'quotesCount' | 'createdAt'>) => Promise<string>;
  acceptRFQQuote: (rfqId: string, quoteId: string) => void;

  bookings: Booking[];
  createBooking: (bookingData: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt'>) => Promise<string>;
  updateBookingStatus: (bookingId: string, status: Booking['status']) => void;
  payBookingDeposit: (bookingId: string, method: PaymentMethod) => void;
  payRemainingBooking: (bookingId: string, method: PaymentMethod) => void;

  reviews: Review[];
  addReview: (review: Omit<Review, 'id' | 'date'>) => void;
  toggleReviewFeatured: (reviewId: string) => void;
  updateReviewStatus: (reviewId: string, status: Review['status']) => void;
  deleteReview: (reviewId: string) => void;
  replyToReview: (reviewId: string, reply: string) => void;

  // Full Admin & Catalog Management Actions
  addVendor: (vendor: Omit<Vendor, 'id'>) => string;
  updateVendor: (id: string, data: Partial<Vendor>) => void;
  deleteVendor: (id: string) => void;
  updateVendorStatus: (vendorId: string, status: Vendor['status'], verified: boolean) => void;

  addService: (service: Omit<ServiceItem, 'id'>) => string;
  updateService: (id: string, data: Partial<ServiceItem>) => void;
  deleteService: (id: string) => void;

  addPackage: (pkg: Omit<SmartPackage, 'id'>) => string;
  updatePackage: (id: string, data: Partial<SmartPackage>) => void;
  deletePackage: (id: string) => void;

  releaseEscrowPayout: (bookingId: string) => void;
  refundBooking: (bookingId: string) => void;
  toggleCityAvailability: (cityId: string) => void;

  // Admin Config
  adminConfig: AdminPlatformConfig;
  updateAdminConfig: (config: Partial<AdminPlatformConfig>) => void;

  // Shopping Cart & Multi-Vendor Commerce
  cart: CartItem[];
  savedForLater: CartItem[];
  appliedCoupon: Coupon | null;
  coupons: Coupon[];
  addToCart: (
    serviceOrItem: any,
    selectedPackage?: any,
    selectedAddons?: any[],
    config?: any
  ) => void;
  updateCartItemQuantity: (id: string, delta: number) => void;
  removeFromCart: (id: string) => void;
  clearCart: () => void;
  saveItemForLater: (id: string) => void;
  moveToCartFromSaved: (id: string) => void;
  applyCouponCode: (code: string) => { success: boolean; messageAr: string };
  removeCoupon: () => void;
  cartTotals: {
    subtotal: number;
    discount: number;
    taxableAmount: number;
    tax: number;
    total: number;
    depositAmount: number;
    remainingAmount: number;
  };
  vendorCartGroups: VendorCartGroup[];

  // Orders
  multiVendorOrders: MultiVendorOrder[];
  checkoutCart: (checkoutData: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    eventDate?: string;
    scheduleDate?: string;
    eventTime?: string;
    scheduleTime?: string;
    cityId?: string;
    cityNameAr?: string;
    locationCity?: string;
    venueName?: string;
    locationAddress?: string;
    occasionId?: string;
    paymentMethod: PaymentMethod;
    isDepositOnly: boolean;
  }) => Promise<MultiVendorOrder>;

  // Favorites & Comparison
  favoriteVendorIds: string[];
  favoriteServiceIds: string[];
  toggleFavoriteVendor: (vendorId: string) => void;
  toggleFavoriteService: (serviceId: string) => void;
  comparisonVendorIds: string[];
  addToComparison: (vendorId: string) => boolean;
  removeFromComparison: (vendorId: string) => void;
  clearComparison: () => void;

  // Ranking weights
  rankingWeights: RankingWeights;
  updateRankingWeights: (weights: Partial<RankingWeights>) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const STORAGE_KEY = 'munasabati_state_v1';

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [currentRole, setCurrentRole] = useState<'client' | 'vendor' | 'admin'>('client');
  const geo=useGeo();
  const router = useRouter();
  const pathname = usePathname();
  const preview=!!geo.data?.preview || (typeof window!=='undefined' && window.location.pathname.startsWith('/coverage-preview/'));
  const selectedCity=geo.data?.selection.cityId||'';
  const setSelectedCity=(id:string)=>{void geo.chooseCity(id).catch(()=>{});};
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);

  // User Profile & Onboarding State
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [databaseError, setDatabaseError] = useState('');
  const accountRef = useRef<string | null>(null);
  const [isOnboardingOpen, setIsOnboardingOpen] = useState<boolean>(false);
  const [onboardingInitialRole, setOnboardingInitialRole] = useState<'client' | 'vendor' | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [signOutEpoch, setSignOutEpoch] = useState(0);
  const quietRedirect = useRef(false);
  const [onboardingGate, setOnboardingGate] = useState<{ returnTo?: string } | null>(null);
  const [permissionNotice, setPermissionNotice] = useState<{ open: boolean; targetRole: UserRole | null; messageAr: string } | null>(null);

  const [occasions, setOccasions] = useState<Occasion[]>([]);
  const [activeOccasionId, setActiveOccasionId] = useState<string>('');

  const [occasionTypes, setOccasionTypes] = useState<OccasionType[]>(OCCASION_TYPES);
  const [serviceCategories, setServiceCategories] = useState<ServiceCategory[]>(geo.data?.snapshot.categories||SERVICE_CATEGORIES);
  const [cities, setCities] = useState<SaudiCity[]>(()=>(geo.data?.snapshot.cities||[]).map(c=>({...c,neighborhoods:SAUDI_CITIES.find(old=>old.id===c.id)?.neighborhoods||[]})));
  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [packages, setPackages] = useState<SmartPackage[]>(SMART_PACKAGES);
  const [inspirationPosts, setInspirationPosts] = useState<InspirationPost[]>(INSPIRATION_POSTS);

  const [guests, setGuests] = useState<Guest[]>([]);
  const [tables, setTables] = useState<SeatingTable[]>(INITIAL_TABLES);
  const [budgetItems, setBudgetItems] = useState<BudgetItem[]>(INITIAL_BUDGET_ITEMS);
  const [tasks, setTasks] = useState<PlanningTask[]>(INITIAL_TASKS);
  const [runOfShowItems, setRunOfShowItems] = useState<RunOfShowItem[]>(INITIAL_RUN_OF_SHOW_ITEMS);
  const [wishlistGifts, setWishlistGifts] = useState<WishlistGift[]>(INITIAL_WISHLIST);
  const [eaniyahGifts, setEaniyahGifts] = useState<EaniyahGift[]>(INITIAL_EANIYAH_GIFTS);
  const [rfqRequests, setRfqRequests] = useState<RFQRequest[]>(INITIAL_RFQS);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [reviews, setReviews] = useState<Review[]>(INITIAL_REVIEWS);
  const [adminConfig, setAdminConfig] = useState<AdminPlatformConfig>(INITIAL_ADMIN_CONFIG);

  // Commerce & Marketplace State
  const [cart, setCart] = useState<CartItem[]>([]);
  const [savedForLater, setSavedForLater] = useState<CartItem[]>([]);
  const [appliedCoupon, setAppliedCoupon] = useState<Coupon | null>(null);
  const [coupons, setCoupons] = useState<Coupon[]>(INITIAL_COUPONS);
  const [multiVendorOrders, setMultiVendorOrders] = useState<MultiVendorOrder[]>([]);
  const [favoriteVendorIds, setFavoriteVendorIds] = useState<string[]>(['vendor-1', 'vendor-3']);
  const [favoriteServiceIds, setFavoriteServiceIds] = useState<string[]>(['srv-1']);
  const [comparisonVendorIds, setComparisonVendorIds] = useState<string[]>([]);
  const [rankingWeights, setRankingWeights] = useState<RankingWeights>(
    INITIAL_ADMIN_CONFIG.rankingWeights || DEFAULT_RANKING_WEIGHTS
  );

  // Load from localStorage if available
  useEffect(() => {
    if (preview) return;
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if ((parsed.occasions?.length || parsed.guests?.length) && !localStorage.getItem('munasabati_legacy_invitations_backup_v1')) {
          localStorage.setItem('munasabati_legacy_invitations_backup_v1', JSON.stringify({ occasions: parsed.occasions || [], guests: parsed.guests || [] }));
        }
        if ((parsed.bookings?.length || parsed.multiVendorOrders?.length) && !localStorage.getItem('munasabati_legacy_commerce_backup_v1')) localStorage.setItem('munasabati_legacy_commerce_backup_v1', JSON.stringify({ bookings: parsed.bookings || [], orders: parsed.multiVendorOrders || [] }));
        if (parsed.activeOccasionId) setActiveOccasionId(parsed.activeOccasionId);
        if (parsed.budgetItems) setBudgetItems(parsed.budgetItems);
        if (parsed.tasks) setTasks(parsed.tasks);
        if (parsed.runOfShowItems) setRunOfShowItems(parsed.runOfShowItems);
        if (parsed.eaniyahGifts) setEaniyahGifts(parsed.eaniyahGifts);

        if (parsed.rfqRequests) setRfqRequests(parsed.rfqRequests);
        if (parsed.adminConfig) setAdminConfig(parsed.adminConfig);
        if (parsed.packages) setPackages(parsed.packages);
        if (parsed.reviews) setReviews(parsed.reviews);
        if (parsed.cart) setCart(parsed.cart);
        if (parsed.savedForLater) setSavedForLater(parsed.savedForLater);
        if (parsed.appliedCoupon) setAppliedCoupon(parsed.appliedCoupon);

        if (parsed.favoriteVendorIds) setFavoriteVendorIds(parsed.favoriteVendorIds);
        if (parsed.favoriteServiceIds) setFavoriteServiceIds(parsed.favoriteServiceIds);
        if (parsed.comparisonVendorIds) setComparisonVendorIds(parsed.comparisonVendorIds);
        if (parsed.rankingWeights) setRankingWeights(parsed.rankingWeights);
      }
    } catch (e) {
      console.warn('Failed to parse local storage', e);
    }
  }, [preview]);

  // Sync to localStorage
  useEffect(() => {
    if (preview) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...(() => { const old = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}'); return old.occasions && !localStorage.getItem('munasabati_legacy_invitations_backup_v1') ? { occasions: old.occasions, guests: old.guests } : {}; })(),
          activeOccasionId,
          budgetItems,
          tasks,
          runOfShowItems,
          eaniyahGifts,
          rfqRequests,
          adminConfig,
          packages,
          reviews,
          cart,
          savedForLater,
          appliedCoupon,
          favoriteVendorIds,
          favoriteServiceIds,
          comparisonVendorIds,
          rankingWeights,
        })
      );
    } catch (e) {
      console.warn('Failed to save to local storage', e);
    }
  }, [
    preview,
    occasions,
    activeOccasionId,
    guests,
    budgetItems,
    tasks,
    runOfShowItems,
    eaniyahGifts,
    bookings,
    rfqRequests,
    adminConfig,
    vendors,
    services,
    packages,
    reviews,
    cities,
    cart,
    savedForLater,
    appliedCoupon,
    multiVendorOrders,
    favoriteVendorIds,
    favoriteServiceIds,
    comparisonVendorIds,
    rankingWeights,
  ]);

  useEffect(() => {
    let stopped = false;
    const refresh = () => Promise.all([requestJSON('/api/catalog/vendors'),requestJSON('/api/catalog/services')]).then(([data,catalog]) => { if (!stopped) {setVendors(data.vendors.map(ensureVendorDetails));setServices(catalog.services.map(ensureServiceDetails));} }).catch(() => { if (!stopped) {setVendors([]);setServices([]);} });
    void refresh(); const timer = setInterval(refresh, 10000); window.addEventListener('catalog-updated', refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('catalog-updated', refresh); };
  }, [currentUser?.id]);

  useEffect(()=>{if(geo.data?.snapshot.categories)setServiceCategories(geo.data.snapshot.categories);},[geo.data?.snapshot.categories]);
  useEffect(()=>{if(geo.data)setCities(geo.data.snapshot.cities.map(c=>({...c,regionAr:c.regionAr,isAvailable:c.isAvailable,neighborhoods:SAUDI_CITIES.find(old=>old.id===c.id)?.neighborhoods||[]})));},[geo.data]);

  // The server session is authoritative; browser profiles are never credentials.
  useEffect(() => {
    if(preview){setCurrentUser(geo.data?.preview?.visitorType==='guest'?null:{id:'preview-user',name:'مستخدم المعاينة',phone:'',role:'client'});setAuthReady(true);return;}
    let cancelled = false;
    (async () => {
      // A sign-out whose server revoke never finished is completed first; the UI stays signed out meanwhile.
      if (isRevokePending() && !(await revokeServerSession())) {
        if (!cancelled) { setCurrentUser(null); setCurrentRole('client'); setAuthReady(true); }
        revokeWithRecovery();
        return;
      }
      try {
        const data = await requestJSON('/api/auth/session');
        if (cancelled) return;
        setCurrentUser(data.user); if (data.user) setCurrentRole(data.user.role);
        setAuthReady(true);
      } catch (error) { if (!cancelled) setDatabaseError(error instanceof Error ? error.message : 'تعذر التحقق من الجلسة'); }
    })();
    return () => { cancelled = true; };
  }, [preview, geo.data?.preview?.visitorType]);
  const authenticatedUserId = currentUser?.id;
  useEffect(() => {
    accountRef.current = authenticatedUserId || null;
    setOccasions([]); setGuests([]);
    if (!authenticatedUserId || preview) return;
    const id = authenticatedUserId;
    let stopped = false;
    const refresh = () => requestJSON('/api/occasions').then(data => {
      if (stopped || accountRef.current !== id) return;
      setOccasions(data.occasions); setGuests(data.guests);
      setActiveOccasionId(previous => data.occasions.some((o: Occasion) => o.id === previous) ? previous : data.occasions[0]?.id || '');
    }).catch(error => { if (!stopped) setDatabaseError(error.message); });
    void refresh(); const timer = setInterval(refresh, 10000);
    const onFocus = () => void refresh(); window.addEventListener('focus', onFocus);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('focus', onFocus); };
  }, [authenticatedUserId, preview]);
  useEffect(() => {
    setBookings([]); setMultiVendorOrders([]);
    if (!authenticatedUserId || preview) return;
    let stopped = false;
    const refresh = () => requestJSON('/api/oms/orders').then(data => {
      if (stopped) return;
      setMultiVendorOrders(data.orders);
      setBookings(data.orders.flatMap((order: any) => order.suborders.map((sub: any) => ({
        id: sub.id, bookingNumber: sub.bookingNumber, occasionId: order.occasionId, occasionTitle: '',
        vendorId: sub.vendorId, vendorName: sub.vendorName, vendorLogo: sub.vendorLogo,
        serviceId: sub.items[0]?.serviceId || '', serviceTitleAr: sub.items.map((i: any) => i.serviceTitleAr).join(' + '),
        date: order.eventDate, time: order.eventTime || '', cityAr: order.cityNameAr,
        customerName: order.customerName, customerPhone: order.customerPhone, customerEmail: order.customerEmail,
        totalAmount: sub.totalAmount, depositAmount: sub.depositAmount, remainingAmount: sub.remainingAmount,
        depositPaid: order.paymentStatus === 'PAID', isFullyPaid: order.paymentStatus === 'PAID' && !order.isDepositOnly,
        paymentMethod: order.paymentMethod, status: sub.omsStatus === 'ACCEPTED' ? 'deposit_required' : sub.status === 'pending' ? 'awaiting_vendor' : sub.status,
        cancellationPolicyAr: 'تطبق سياسة المورد المتفق عليها.', createdAt: order.createdAt, deliverablesAr: sub.items.map((i: any) => i.serviceTitleAr),
      }))));
    }).catch(error => { if (!stopped) setDatabaseError(error.message); });
    void refresh(); const timer = setInterval(refresh, 10000);
    window.addEventListener('munasabati-orders-refresh', refresh);
    return () => { stopped = true; clearInterval(timer); window.removeEventListener('munasabati-orders-refresh', refresh); };
  }, [authenticatedUserId, preview]);
  async function databaseAction(action: () => Promise<void>): Promise<boolean> {
    try { await action(); setDatabaseError(''); return true; }
    catch (error) { setDatabaseError(error instanceof Error ? error.message : 'تعذر الحفظ في قاعدة البيانات'); return false; }
  }

  const openOnboarding = (role?: 'client' | 'vendor', options?: { gate?: boolean; returnTo?: string }) => {
    setOnboardingGate(options?.gate ? { returnTo: options.returnTo } : null);
    setOnboardingInitialRole(role || null);
    setIsOnboardingOpen(true);
  };

  const clearPermissionNotice = () => {
    setPermissionNotice(null);
  };

  const switchRole = (newRole: UserRole): { allowed: boolean; messageAr?: string } => {
    if (newRole === 'admin') {
      if (!currentUser?.hasAdminAccess && currentUser?.role !== 'admin') {
        const msg = 'لوحة الإدارة تتطلب صلاحيات المشرف أو مدير المنصة.';
        setPermissionNotice({
          open: true,
          targetRole: 'admin',
          messageAr: msg,
        });
        return { allowed: false, messageAr: msg };
      }
    }

    if (newRole === 'vendor') {
      if (currentUser?.role === 'client' && !currentUser?.vendorId) {
        openOnboarding('vendor');
        const msg = 'ليس لديك حساب مورد مسجل بعد. يمكنك تسجيل منشأتك الآن للانضمام لبوابة الموردين.';
        setPermissionNotice({
          open: true,
          targetRole: 'vendor',
          messageAr: msg,
        });
        return { allowed: false, messageAr: msg };
      }
    }

    setCurrentRole(newRole);
    if (typeof window !== 'undefined') {
      localStorage.setItem('munasabati_active_role_v2', newRole);
    }
    return { allowed: true };
  };

  const registerCustomer = async (payload: CustomerRegistrationPayload) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'client', customerData: payload, captchaToken: payload.captchaToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل التسجيل');
      }

      const cityObj = cities.find((c) => c.id === payload.cityId);
      const userProfile: UserProfile = {
        ...data.user,
        cityNameAr: cityObj?.nameAr || 'الرياض',
      };

      setCurrentUser(userProfile);
      setCurrentRole('client');
      setAuthReady(true);
      broadcastAuth('login');
      if (payload.cityId) setSelectedCity(payload.cityId);

      if (payload.upcomingOccasionType) {
        await createOccasion({
          title: `مناسبة ${userProfile.name}`,
          occasionTypeId: payload.upcomingOccasionType,
          cityId: payload.cityId,
          date: payload.occasionDate || '2026-11-20',
        });
      }


      return { success: true, user: userProfile };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء التسجيل' };
    }
  };

  const registerVendor = async (payload: VendorRegistrationPayload) => {
    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userType: 'vendor', vendorData: payload, captchaToken: payload.captchaToken }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'فشل تسجيل المورد');
      }

      const cityObj = cities.find((c) => c.id === payload.cityId);
      const userProfile: UserProfile = {
        ...data.user,
        cityNameAr: cityObj?.nameAr || 'الرياض',
      };

      if (data.vendor) {
        const newVendorObj: Vendor = ensureVendorDetails({
          ...data.vendor,
          categoryNameAr: serviceCategories.find((c) => c.id === payload.categoryId)?.nameAr || 'خدمة مناسبات',
          cityNameAr: cityObj?.nameAr || 'الرياض',
          status: 'active',
        });
        setVendors((prev) => [newVendorObj, ...prev]);
      }

      setCurrentUser(userProfile);
      setCurrentRole('vendor');
      setAuthReady(true);
      broadcastAuth('login');
      if (payload.cityId) setSelectedCity(payload.cityId);


      return { success: true, user: userProfile };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء تسجيل المورد' };
    }
  };

  const loginUser = async (identifier: string, requestedRole?: UserRole, password?: string, code?: string, captchaToken?: string) => {
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ identifier, password, code, captchaToken }),
      });
      const data = await res.json();
      if (data.mfaRequired) return { success: false, mfaRequired: true };
      if (!res.ok || !data.success) {
        throw Object.assign(new Error(data.error || 'فشل تسجيل الدخول'), { retryAfter: typeof data.retryAfter === 'number' ? data.retryAfter : undefined, captchaRequired: data.captchaRequired === true });
      }

      const cityObj = cities.find((c) => c.id === data.user.cityId);
      const userProfile: UserProfile = {
        ...data.user,
        cityNameAr: cityObj?.nameAr || 'الرياض',
      };

      setCurrentUser(userProfile);
      setCurrentRole(userProfile.role);
      setAuthReady(true);
      broadcastAuth('login');
      if (userProfile.cityId) setSelectedCity(userProfile.cityId);


      return { success: true, user: userProfile };
    } catch (err: any) {
      return { success: false, error: err.message || 'حدث خطأ أثناء تسجيل الدخول', retryAfter: err.retryAfter, captchaRequired: err.captchaRequired === true };
    }
  };

  // Everything tied to the signed-in account goes back to its signed-out value. Public catalog data stays.
  const resetUserState = () => {
    accountRef.current = null;
    setCurrentUser(null); setCurrentRole('client');
    setOccasions([]); setGuests([]); setBookings([]); setMultiVendorOrders([]); setActiveOccasionId('');
    setBudgetItems(INITIAL_BUDGET_ITEMS); setTasks(INITIAL_TASKS); setRunOfShowItems(INITIAL_RUN_OF_SHOW_ITEMS);
    setWishlistGifts(INITIAL_WISHLIST); setEaniyahGifts(INITIAL_EANIYAH_GIFTS); setRfqRequests(INITIAL_RFQS); setTables(INITIAL_TABLES);
    setCart([]); setSavedForLater([]); setAppliedCoupon(null);
    setFavoriteVendorIds(['vendor-1', 'vendor-3']); setFavoriteServiceIds(['srv-1']); setComparisonVendorIds([]);
    setIsOnboardingOpen(false); setOnboardingGate(null); setOnboardingInitialRole(null); setPermissionNotice(null);
    setIsAIOpen(false); setDatabaseError('');
    try {
      localStorage.removeItem(STORAGE_KEY); localStorage.removeItem('munasabati_active_role_v2');
      sessionStorage.removeItem('munasabati_pending_checkout'); sessionStorage.removeItem('booking-selection');
    } catch { /* storage unavailable */ }
    setSignOutEpoch(epoch => epoch + 1);
  };

  const applySignedOut = (options: { broadcast: boolean; redirect: boolean }) => {
    resetUserState();
    setAuthReady(true);
    if (options.broadcast) broadcastAuth('logout');
    if (options.redirect) {
      quietRedirect.current = true;
      if (isProtectedPath(window.location.pathname)) router.replace('/'); else router.refresh();
    }
  };
  const signedOutRef = useRef(applySignedOut);
  signedOutRef.current = applySignedOut;

  // Same path for administrators, vendors and customers: the screen changes first, the server catches up.
  const logoutUser = () => {
    applySignedOut({ broadcast: true, redirect: true });
    revokeWithRecovery(() => notify('تم تسجيل خروجك على هذا الجهاز. تعذّر إنهاء الجلسة على الخادم الآن وسنعيد المحاولة تلقائياً.', 'info'));
  };

  // Another tab signed out (or in): follow it without a reload.
  useEffect(() => {
    if (preview) return;
    return subscribeAuth(signal => {
      if (signal === 'logout') { signedOutRef.current({ broadcast: false, redirect: true }); return; }
      requestJSON('/api/auth/session').then(data => {
        if (data.user) { setCurrentUser(data.user); setCurrentRole(data.user.role); setAuthReady(true); }
      }).catch(() => {});
    });
  }, [preview]);

  // Coming back to the page (Back button, restored tab, regained focus): confirm the session is still alive.
  useEffect(() => {
    if (preview || !authenticatedUserId) return;
    let last = 0;
    const check = () => {
      if (Date.now() - last < 2000) return;
      last = Date.now();
      requestJSON('/api/auth/session').then(data => { if (!data.user) signedOutRef.current({ broadcast: false, redirect: true }); }).catch(() => {});
    };
    const onPageShow = (event: PageTransitionEvent) => { if (event.persisted) check(); };
    const onVisible = () => { if (document.visibilityState === 'visible') check(); };
    window.addEventListener('pageshow', onPageShow); document.addEventListener('visibilitychange', onVisible); window.addEventListener('focus', check);
    return () => { window.removeEventListener('pageshow', onPageShow); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('focus', check); };
  }, [authenticatedUserId, preview]);

  // Protected pages are never shown without an account (also on Back after sign-out or a typed/bookmarked URL).
  useEffect(() => {
    if (preview || !authReady || currentUser) return;
    if (!isProtectedPath(pathname)) { quietRedirect.current = false; return; }
    if (!quietRedirect.current) notify('سجّل الدخول للوصول إلى هذه الصفحة.', 'info');
    router.replace('/');
  }, [authReady, currentUser, pathname, preview, router]);

  const activeOccasion = occasions.find((o) => o.id === activeOccasionId) || occasions[0];

  const createOccasion = async (data: Partial<Occasion>): Promise<string | null> => {
    let newId = crypto.randomUUID();
    const occasionTypeObj = occasionTypes.find((t) => t.id === data.occasionTypeId);
    const cityObj = cities.find((c) => c.id === data.cityId);

    const newOccasion: Occasion = {
      id: newId,
      title: data.title || `مناسبة ${occasionTypeObj?.nameAr || 'جديدة'}`,
      occasionTypeId: data.occasionTypeId || 'graduation',
      occasionTypeNameAr: occasionTypeObj?.nameAr || 'تخرج',
      cityId: data.cityId || 'riyadh',
      cityNameAr: cityObj?.nameAr || 'الرياض',
      neighborhood: data.neighborhood || 'الملقا',
      date: data.date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      time: data.time || '08:00 م',
      isApproximateDate: !!data.isApproximateDate,
      guestCount: data.guestCount || 50,
      guestsSection: data.guestsSection || 'women',
      venueType: data.venueType || 'home',
      venueName: data.venueName || '',
      budget: data.budget || 15000,
      spent: 0,
      tier: data.tier || 'medium',
      readinessPercentage: 20,
      status: 'planning',
      createdAt: new Date().toISOString(),
      notes: data.notes || '',
      serviceSelections: data.serviceSelections || [],
    };

    let saved: Occasion | undefined;
    const ok = await databaseAction(async () => { saved = (await requestJSON('/api/occasions', 'POST', newOccasion)).occasion; });
    if (!ok || !saved) return null;
    newId = saved.id;
    setOccasions((prev) => [saved!, ...prev]);
    setActiveOccasionId(newId);

    // Auto generate default tasks based on occasion type checklist
    if (occasionTypeObj?.defaultChecklist) {
      const generatedTasks: PlanningTask[] = occasionTypeObj.defaultChecklist.map((item, idx) => {
        const dueDate = new Date(Date.now() + (30 - item.daysBefore) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0];
        return {
          id: `tsk-${newId}-${idx + 1}`,
          occasionId: newId,
          title: item.title,
          category: item.category,
          dueDaysBefore: item.daysBefore,
          dueDate: dueDate,
          isCompleted: false,
          priority: item.daysBefore >= 20 ? 'high' : 'medium',
        };
      });
      setTasks((prev) => [...generatedTasks, ...prev]);
    }

    // Auto generate estimated budget allocations
    const totalBudget = newOccasion.budget;
    const defaultAllocations: BudgetItem[] = [
      {
        id: `bgt-${newId}-1`,
        occasionId: newId,
        categoryId: 'decor',
        categoryNameAr: 'الكوشة والديكور وتنسيق الورد',
        allocatedAmount: Math.round(totalBudget * 0.35),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-2`,
        occasionId: newId,
        categoryId: 'hospitality',
        categoryNameAr: 'الضيافة السعودية والبوفيه والمشروبات',
        allocatedAmount: Math.round(totalBudget * 0.30),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-3`,
        occasionId: newId,
        categoryId: 'photography',
        categoryNameAr: 'التصوير وتوثيق المناسبة والفيديو',
        allocatedAmount: Math.round(totalBudget * 0.18),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-4`,
        occasionId: newId,
        categoryId: 'giveaways',
        categoryNameAr: 'التوزيعات والهدايا التذكارية',
        allocatedAmount: Math.round(totalBudget * 0.12),
        spentAmount: 0,
        status: 'estimated',
      },
      {
        id: `bgt-${newId}-5`,
        occasionId: newId,
        categoryId: 'invitations',
        categoryNameAr: 'الدعوات والبطاقات الرقمية',
        allocatedAmount: Math.round(totalBudget * 0.05),
        spentAmount: 0,
        status: 'estimated',
      },
    ];
    setBudgetItems((prev) => [...defaultAllocations, ...prev]);

    return newId;
  };

  const updateOccasion = (id: string, data: Partial<Occasion>) => {
    void databaseAction(async () => {
      const result = await requestJSON(`/api/occasions/${id}`, 'PATCH', data);
      setOccasions(prev => prev.map(o => o.id === id ? result.occasion : o));
    });
  };
  const deleteOccasion = (id: string) => {
    void databaseAction(async () => {
      await requestJSON(`/api/occasions/${id}`, 'DELETE');
      setOccasions(prev => prev.filter(o => o.id !== id)); setGuests(prev => prev.filter(g => g.occasionId !== id));
    });
  };
  const addGuest = (data: Omit<Guest, 'id' | 'qrCode'>) => databaseAction(async () => {
    const result = await requestJSON(`/api/occasions/${data.occasionId}/guests`, 'POST', data);
    setGuests(prev => [result.guest, ...prev]);
  });
  const updateGuestStatus = (id: string, status: Guest['status']) => databaseAction(async () => {
    const result = await requestJSON(`/api/guests/${id}`, 'PATCH', { status });
    setGuests(prev => prev.map(g => g.id === id ? result.guest : g));
  });
  const deleteGuest = (id: string) => {
    void databaseAction(async () => { await requestJSON(`/api/guests/${id}`, 'DELETE'); setGuests(prev => prev.filter(g => g.id !== id)); });
  };

  const addTable = (tableData: Omit<SeatingTable, 'id'>) => {
    const id = `tbl-${Date.now().toString().slice(-4)}`;
    setTables((prev) => [...prev, { ...tableData, id }]);
  };

  const assignGuestToTable = (guestId: string, tableId: string, tableName?: string) => {
    void databaseAction(async () => {
      const table = tables.find(t => t.id === tableId);
      const result = await requestJSON(`/api/guests/${guestId}`, 'PATCH', { tableId, tableName: tableName ?? table?.name ?? '' });
      setGuests(prev => prev.map(g => g.id === guestId ? result.guest : g));
      setTables(prev => prev.map(t => ({ ...t, assignedGuestIds: t.id === tableId ? [...t.assignedGuestIds.filter(id => id !== guestId), guestId] : t.assignedGuestIds.filter(id => id !== guestId) })));
    });
  };

  const addBudgetItem = (itemData: Omit<BudgetItem, 'id'>) => {
    const id = `bgt-${Date.now().toString().slice(-4)}`;
    setBudgetItems((prev) => [...prev, { ...itemData, id }]);
  };

  const updateBudgetItem = (id: string, itemData: Partial<BudgetItem>) => {
    setBudgetItems((prev) =>
      prev.map((b) => {
        if (b.id === id) {
          return { ...b, ...itemData };
        }
        return b;
      })
    );
  };

  const deleteBudgetItem = (id: string) => {
    setBudgetItems((prev) => prev.filter((b) => b.id !== id));
  };

  const toggleTaskCompleted = (taskId: string) => {
    setTasks((prev) =>
      prev.map((t) => {
        if (t.id === taskId) {
          return { ...t, isCompleted: !t.isCompleted };
        }
        return t;
      })
    );
  };

  const addTask = (taskData: Omit<PlanningTask, 'id'>) => {
    const id = `tsk-${Date.now().toString().slice(-4)}`;
    setTasks((prev) => [
      {
        ...taskData,
        id,
      },
      ...prev,
    ]);
  };

  const addWishlistGift = (giftData: Omit<WishlistGift, 'id'>) => {
    const id = `wsh-${Date.now().toString().slice(-4)}`;
    setWishlistGifts((prev) => [
      ...prev,
      {
        ...giftData,
        id,
      },
    ]);
  };

  const contributeToGift = (giftId: string, amount: number, contributorName: string) => {
    setWishlistGifts((prev) =>
      prev.map((w) => {
        if (w.id === giftId) {
          const newContributed = w.contributedAmount + amount;
          const isFulfilled = newContributed >= w.price;
          return {
            ...w,
            contributedAmount: newContributed,
            isFulfilled,
            giftedBy: isFulfilled ? contributorName : w.giftedBy,
          };
        }
        return w;
      })
    );
  };

  const sendEaniyahGift = (
    giftData: Omit<EaniyahGift, 'id' | 'createdAt' | 'status' | 'transactionRef'>
  ): EaniyahGift => {
    const id = `ean-${Date.now().toString().slice(-6)}`;
    const transactionRef = `EAN-SA-${Math.floor(100000 + Math.random() * 900000)}`;
    const newGift: EaniyahGift = {
      ...giftData,
      id,
      status: 'completed',
      createdAt: new Date().toISOString(),
      transactionRef,
    };
    setEaniyahGifts((prev) => [newGift, ...prev]);
    return newGift;
  };

  const transferEaniyahPayout = (occasionId: string, iban: string, bankName: string) => {
    setEaniyahGifts((prev) =>
      prev.map((g) => (g.occasionId === occasionId ? { ...g, status: 'transferred' as const } : g))
    );
  };

  const createRFQ = async (rfqData: Omit<RFQRequest, 'id' | 'quotes' | 'quotesCount' | 'createdAt'>): Promise<string> => {
    await requestJSON('/api/geo/authorize','POST',{key:'feature:rfq',cityId:selectedCity});
    const id = `rfq-${Date.now().toString().slice(-4)}`;
    const newRFQ: RFQRequest = {
      ...rfqData,
      id,
      quotesCount: 0,
      quotes: [],
      status: 'open',
      createdAt: new Date().toISOString(),
    };
    setRfqRequests((prev) => [newRFQ, ...prev]);
    return id;
  };

  const acceptRFQQuote = (rfqId: string, quoteId: string) => {
    setRfqRequests((prev) =>
      prev.map((rfq) => {
        if (rfq.id === rfqId) {
          const updatedQuotes = rfq.quotes.map((q) => {
            if (q.id === quoteId) return { ...q, status: 'accepted' as const };
            return { ...q, status: 'declined' as const };
          });
          return { ...rfq, quotes: updatedQuotes, status: 'awarded' as const };
        }
        return rfq;
      })
    );
  };

  const createBooking = async (_data: Omit<Booking, 'id' | 'bookingNumber' | 'createdAt'>): Promise<string> => {
    throw new Error('أضف الخدمة إلى السلة وأرسل طلب الحجز من صفحة إتمام الطلب');
  };
  const updateBookingStatus = (bookingId: string, status: Booking['status']) => {
    const targetState = ({ confirmed: 'ACCEPTED', in_preparation: 'IN_PROGRESS', completed: 'COMPLETED', cancelled: 'CANCELLED', disputed: 'DISPUTED' } as Record<string, string>)[status];
    if (!targetState) { setDatabaseError('انتقال الحالة غير مدعوم'); return; }
    void databaseAction(async () => {
      await requestJSON('/api/oms/orders/transition', 'POST', { suborderId: bookingId, targetState });
      window.dispatchEvent(new Event('munasabati-orders-refresh'));
    });
  };
  const payBookingDeposit = (_bookingId: string, _method: PaymentMethod) => {
    setDatabaseError('الدفع الإلكتروني غير مفعّل حالياً؛ لم يتم تحصيل أي مبلغ');
  };

  const addRunOfShowItem = (itemData: Omit<RunOfShowItem, 'id'>) => {
    const id = `ros-${Date.now().toString().slice(-4)}`;
    const newItem: RunOfShowItem = {
      ...itemData,
      id,
    };
    setRunOfShowItems((prev) => [...prev, newItem].sort((a, b) => a.time.localeCompare(b.time)));
  };

  const updateRunOfShowItem = (id: string, data: Partial<RunOfShowItem>) => {
    setRunOfShowItems((prev) =>
      prev
        .map((item) => (item.id === id ? { ...item, ...data } : item))
        .sort((a, b) => a.time.localeCompare(b.time))
    );
  };

  const deleteRunOfShowItem = (id: string) => {
    setRunOfShowItems((prev) => prev.filter((item) => item.id !== id));
  };

  const payRemainingBooking = (_bookingId: string, _method: PaymentMethod) => {
    setDatabaseError('الدفع الإلكتروني غير مفعّل حالياً؛ لم يتم تحصيل أي مبلغ');
  };

  const addReview = (reviewData: Omit<Review, 'id' | 'date'>) => {
    const id = `rev-${Date.now().toString().slice(-4)}`;
    const newReview: Review = {
      ...reviewData,
      id,
      date: new Date().toISOString().split('T')[0],
      status: reviewData.status || 'approved',
    };
    setReviews((prev) => [newReview, ...prev]);
  };

  const toggleReviewFeatured = (reviewId: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, featured: !r.featured } : r))
    );
  };

  const updateReviewStatus = (reviewId: string, status: Review['status']) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, status } : r))
    );
  };

  const deleteReview = (reviewId: string) => {
    setReviews((prev) => prev.filter((r) => r.id !== reviewId));
  };

  const replyToReview = (reviewId: string, reply: string) => {
    setReviews((prev) =>
      prev.map((r) => (r.id === reviewId ? { ...r, vendorReplyAr: reply } : r))
    );
  };

  // Vendor management actions
  const addVendor = (vendorData: Omit<Vendor, 'id'>): string => {
    const id = `vendor-${Date.now().toString().slice(-4)}`;
    const newVendor: Vendor = {
      ...vendorData,
      id,
    };
    setVendors((prev) => [newVendor, ...prev]);
    return id;
  };

  const updateVendor = (id: string, data: Partial<Vendor>) => {
    setVendors((prev) =>
      prev.map((v) => (v.id === id ? { ...v, ...data } : v))
    );
  };

  const deleteVendor = (id: string) => {
    setVendors((prev) => prev.filter((v) => v.id !== id));
  };

  const updateVendorStatus = (vendorId: string, status: Vendor['status'], verified: boolean) => {
    void databaseAction(async () => {
      await requestJSON('/api/admin/vendors', 'POST', { id: vendorId, status, verified });
      const data = await requestJSON('/api/catalog/vendors'); setVendors(data.vendors.map(ensureVendorDetails));
    });
  };

  const addService = (serviceData: Omit<ServiceItem, 'id'>): string => {
    const id = `srv-${Date.now().toString().slice(-4)}`;
    const newService: ServiceItem = {
      ...serviceData,
      id,
    };
    setServices((prev) => [newService, ...prev]);
    return id;
  };

  const updateService = (id: string, data: Partial<ServiceItem>) => {
    setServices((prev) =>
      prev.map((s) => (s.id === id ? { ...s, ...data } : s))
    );
  };

  const deleteService = (id: string) => {
    setServices((prev) => prev.filter((s) => s.id !== id));
  };

  // Package management actions
  const addPackage = (pkgData: Omit<SmartPackage, 'id'>): string => {
    const id = `pkg-${Date.now().toString().slice(-4)}`;
    const newPkg: SmartPackage = {
      ...pkgData,
      id,
    };
    setPackages((prev) => [newPkg, ...prev]);
    return id;
  };

  const updatePackage = (id: string, data: Partial<SmartPackage>) => {
    setPackages((prev) =>
      prev.map((p) => (p.id === id ? { ...p, ...data } : p))
    );
  };

  const deletePackage = (id: string) => {
    setPackages((prev) => prev.filter((p) => p.id !== id));
  };

  // Escrow and bookings actions
  const releaseEscrowPayout = (_bookingId: string) => {
    setDatabaseError('تحويل مستحقات الموردين يتطلب تكامل دفع وتحويلات فعلياً');
  };
  const refundBooking = (_bookingId: string) => {
    setDatabaseError('الاسترداد يتطلب تأكيداً من بوابة الدفع؛ لم يتم تنفيذ استرداد');
  };

  // City management actions
  const toggleCityAvailability = (_cityId: string) => { setDatabaseError('إدارة التغطية متاحة من قسم الدول والمدن والخدمات في لوحة مدير النظام.'); };

  const updateAdminConfig = (configData: Partial<AdminPlatformConfig>) => {
    setAdminConfig((prev) => ({ ...prev, ...configData }));
  };

  // Group cart items by vendor
  const vendorCartGroups: VendorCartGroup[] = React.useMemo(() => {
    const groups: Record<string, VendorCartGroup> = {};
    cart.forEach((item) => {
      if (!groups[item.vendorId]) {
        groups[item.vendorId] = {
          vendorId: item.vendorId,
          vendorName: item.vendorName,
          vendorLogo: item.vendorLogo,
          cityId: item.cityId,
          cityNameAr: item.cityNameAr,
          items: [],
          subtotal: 0,
          taxAmount: 0,
          totalAmount: 0,
        };
      }
      groups[item.vendorId].items.push(item);
      groups[item.vendorId].subtotal += item.subtotal;
      groups[item.vendorId].taxAmount += item.taxAmount;
      groups[item.vendorId].totalAmount += item.totalAmount;
    });
    return Object.values(groups);
  }, [cart]);

  const cartTotals = React.useMemo(() => {
    return calculateCartTotals(
      cart,
      appliedCoupon,
      adminConfig.vatPercent ? adminConfig.vatPercent / 100 : 0.15
    );
  }, [cart, appliedCoupon, adminConfig.vatPercent]);

  const addToCart = (serviceOrItem: any, selectedPackage?: any, selectedAddons?: any[], config?: any) => {
    const serviceId = serviceOrItem?.serviceId || serviceOrItem?.id;
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/coverage-preview/') && typeof serviceId === 'string') window.location.assign('/commerce/service/' + encodeURIComponent(serviceId));
  };

  const updateCartItemQuantity = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((it) => {
          if (it.id === id) {
            const newQty = it.quantity + delta;
            if (newQty <= 0) return null;
            const vatRate = adminConfig.vatPercent ? adminConfig.vatPercent / 100 : 0.15;
            const newSub = (it.basePrice + it.addonsTotal) * newQty;
            const newTax = Math.round(newSub * vatRate);
            return {
              ...it,
              quantity: newQty,
              subtotal: newSub,
              taxAmount: newTax,
              totalAmount: newSub + newTax,
            };
          }
          return it;
        })
        .filter(Boolean) as CartItem[]
    );
  };

  const removeFromCart = (id: string) => {
    setCart((prev) => prev.filter((it) => it.id !== id));
  };

  const clearCart = () => {
    setCart([]);
    setAppliedCoupon(null);
  };

  const saveItemForLater = (id: string) => {
    const item = cart.find((it) => it.id === id);
    if (!item) return;
    setCart((prev) => prev.filter((it) => it.id !== id));
    setSavedForLater((prev) => [item, ...prev]);
  };

  const moveToCartFromSaved = (id: string) => {
    const item = savedForLater.find((it) => it.id === id);
    if (!item) return;
    setSavedForLater((prev) => prev.filter((it) => it.id !== id));
    setCart((prev) => [item, ...prev]);
  };

  const applyCouponCode = (code: string): { success: boolean; messageAr: string } => {
    const clean = code.trim().toUpperCase();
    const found = coupons.find((c) => c.code.toUpperCase() === clean);
    if (!found) {
      return { success: false, messageAr: 'كوبون الخصم غير صحيح أو منتهي الصلاحية.' };
    }
    const currentSubtotal = cart.reduce((acc, it) => acc + it.subtotal, 0);
    if (currentSubtotal < found.minOrderAmount) {
      return {
        success: false,
        messageAr: `الحد الأدنى لتفعيل هذا الكوبون هو ${formatSAR(found.minOrderAmount)}. أضف المزيد للسلة.`,
      };
    }
    setAppliedCoupon(found);
    return { success: true, messageAr: `تم تفعيل كود الخصم: ${found.descriptionAr} بنجاح!` };
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
  };

  const checkoutCart = async (checkoutData: {
    customerName: string;
    customerPhone: string;
    customerEmail?: string;
    eventDate?: string;
    scheduleDate?: string;
    eventTime?: string;
    scheduleTime?: string;
    cityId?: string;
    cityNameAr?: string;
    locationCity?: string;
    venueName?: string;
    locationAddress?: string;
    occasionId?: string;
    paymentMethod: PaymentMethod;
    isDepositOnly: boolean;
  }): Promise<MultiVendorOrder> => {
    if (!currentUser) throw new Error('يرجى تسجيل الدخول قبل إرسال الطلب');
    const payload = {
      items: cart.map(item => ({ serviceId: item.serviceId, packageId: item.packageId || item.selectedPackage?.id, quantity: item.quantity, addons: item.addons, notes: item.notes })),
      customerInfo: {
        customerName: checkoutData.customerName, customerPhone: checkoutData.customerPhone, customerEmail: checkoutData.customerEmail,
        occasionId: checkoutData.occasionId || undefined,
        eventDate: checkoutData.eventDate || checkoutData.scheduleDate,
        eventTime: checkoutData.eventTime || checkoutData.scheduleTime,
        cityId: checkoutData.cityId || cities.find(c => c.nameAr === checkoutData.locationCity)?.id || selectedCity,
        venueName: checkoutData.venueName || checkoutData.locationAddress,
        paymentMethod: checkoutData.paymentMethod, isDepositOnly: checkoutData.isDepositOnly, couponCode: appliedCoupon?.code,
      },
    };
    // Preserve the same key across network failures and reloads, but never across changed requests/accounts.
    const fingerprint = JSON.stringify({ userId: currentUser.id, payload });
    let pending: { fingerprint: string; key: string } | null = null;
    try { pending = JSON.parse(sessionStorage.getItem('munasabati_pending_checkout') || 'null'); } catch {}
    if (!pending || pending.fingerprint !== fingerprint) pending = { fingerprint, key: crypto.randomUUID() };
    sessionStorage.setItem('munasabati_pending_checkout', JSON.stringify(pending));
    const result = await requestJSON('/api/oms/orders', 'POST', { ...payload, idempotencyKey: pending.key });
    const order = result.masterOrder;
    setMultiVendorOrders(previous => [order, ...previous.filter(o => o.id !== order.id)]);
    sessionStorage.removeItem('munasabati_pending_checkout');
    clearCart();
    window.dispatchEvent(new Event('munasabati-orders-refresh'));
    return order;
  };

  const toggleFavoriteVendor = (vendorId: string) => {
    setFavoriteVendorIds((prev) =>
      prev.includes(vendorId) ? prev.filter((id) => id !== vendorId) : [...prev, vendorId]
    );
  };

  const toggleFavoriteService = (serviceId: string) => {
    setFavoriteServiceIds((prev) =>
      prev.includes(serviceId) ? prev.filter((id) => id !== serviceId) : [...prev, serviceId]
    );
  };

  const addToComparison = (vendorId: string): boolean => {
    if (comparisonVendorIds.includes(vendorId)) return true;
    if (comparisonVendorIds.length >= 4) {
      notify('الحد الأقصى للمقارنة هو 4 موردين في نفس الوقت.');
      return false;
    }
    setComparisonVendorIds((prev) => [...prev, vendorId]);
    return true;
  };

  const removeFromComparison = (vendorId: string) => {
    setComparisonVendorIds((prev) => prev.filter((id) => id !== vendorId));
  };

  const clearComparison = () => {
    setComparisonVendorIds([]);
  };

  const updateRankingWeights = (weights: Partial<RankingWeights>) => {
    const updated = { ...rankingWeights, ...weights };
    setRankingWeights(updated);
    setAdminConfig((prev) => ({ ...prev, rankingWeights: updated }));
  };

  return (
    <AppContext.Provider
      value={{
        currentRole,
        setCurrentRole,
        selectedCity,
        setSelectedCity,
        isAIOpen,
        setIsAIOpen,

        // User Auth & Onboarding
        currentUser,
        setCurrentUser,
        isAuthenticated: !!currentUser,
        isOnboardingOpen,
        setIsOnboardingOpen,
        onboardingInitialRole,
        setOnboardingInitialRole,
        openOnboarding,
        onboardingGate,
        setOnboardingGate,
        registerCustomer,
        registerVendor,
        loginUser,
        logoutUser,
        authReady,
        signOutEpoch,
        switchRole,
        permissionNotice,
        clearPermissionNotice,

        occasions,
        activeOccasionId,
        activeOccasion,
        setActiveOccasionId,
        createOccasion,
        updateOccasion,
        deleteOccasion,

        occasionTypes,
        serviceCategories,
        cities,
        vendors,
        services,
        packages,
        inspirationPosts,

        guests,
        addGuest,
        updateGuestStatus,
        deleteGuest,

        tables,
        addTable,
        assignGuestToTable,

        budgetItems,
        addBudgetItem,
        updateBudgetItem,
        deleteBudgetItem,

        tasks,
        toggleTaskCompleted,
        addTask,

        runOfShowItems,
        addRunOfShowItem,
        updateRunOfShowItem,
        deleteRunOfShowItem,

        wishlistGifts,
        addWishlistGift,
        contributeToGift,

        eaniyahGifts,
        sendEaniyahGift,
        transferEaniyahPayout,

        rfqRequests,
        createRFQ,
        acceptRFQQuote,

        bookings,
        createBooking,
        updateBookingStatus,
        payBookingDeposit,
        payRemainingBooking,

        reviews,
        addReview,
        toggleReviewFeatured,
        updateReviewStatus,
        deleteReview,
        replyToReview,

        addVendor,
        updateVendor,
        deleteVendor,
        updateVendorStatus,

        addService,
        updateService,
        deleteService,

        addPackage,
        updatePackage,
        deletePackage,

        releaseEscrowPayout,
        refundBooking,
        toggleCityAvailability,

        adminConfig,
        updateAdminConfig,

        // Commerce & Cart
        cart,
        savedForLater,
        appliedCoupon,
        coupons,
        addToCart,
        updateCartItemQuantity,
        removeFromCart,
        clearCart,
        saveItemForLater,
        moveToCartFromSaved,
        applyCouponCode,
        removeCoupon,
        cartTotals,
        vendorCartGroups,

        // Orders
        multiVendorOrders,
        checkoutCart,

        // Favorites & Comparison
        favoriteVendorIds,
        favoriteServiceIds,
        toggleFavoriteVendor,
        toggleFavoriteService,
        comparisonVendorIds,
        addToComparison,
        removeFromComparison,
        clearComparison,

        // Ranking
        rankingWeights,
        updateRankingWeights,
      }}
    >
      {databaseError && <div role="alert" className="sticky top-0 z-[100] bg-red-50 border-b border-red-300 p-3 text-center text-sm text-red-900" dir="rtl">{databaseError}<button className="mx-3 underline" onClick={() => setDatabaseError('')}>إغلاق</button></div>}
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within an AppProvider');
  }
  return context;
}
