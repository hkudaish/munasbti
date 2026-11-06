export type GenderSection = 'men' | 'women' | 'families' | 'all';
export type VenueType = 'hall' | 'home' | 'istiraha' | 'chalet' | 'farm' | 'hotel' | 'undecided';
export type OccasionTier = 'economy' | 'medium' | 'luxury' | 'ultra_luxury';
export type BookingStatus = 'requested' | 'awaiting_vendor' | 'quote_received' | 'deposit_required' | 'confirmed' | 'in_preparation' | 'underway' | 'completed' | 'cancelled' | 'disputed';
export type PaymentMethod = 'mada' | 'apple_pay' | 'stc_pay' | 'visa_mastercard' | 'tabby' | 'tamara';

export interface SaudiCity {
  regionEn?: string;
  id: string;
  nameAr: string;
  nameEn: string;
  regionAr: string;
  neighborhoods: string[];
  isAvailable: boolean;
}

export interface OccasionType {
  descriptionEn?: string;
  id: string;
  nameAr: string;
  nameEn: string;
  iconName: string;
  categoryTag: string;
  descriptionAr: string;
  popular: boolean;
  coverImage: string;
  color: string;
  suggestedServiceCategories: string[];
  defaultChecklist: { title: string; daysBefore: number; category: string }[];
}

export interface ServiceCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  iconName: string;
  descriptionAr: string;
  color: string;
  itemCount: number;
}

export interface Vendor {
  id: string;
  businessName: string;
  businessNameEn: string;
  categoryId: string;
  categoryNameAr: string;
  logo: string;
  bannerImage: string;
  rating: number;
  reviewsCount: number;
  completedBookingsCount: number;
  verified: boolean;
  crNumber?: string;
  freelanceLicense?: string;
  vatNumber?: string;
  cityId: string;
  cityNameAr: string;
  neighborhood: string;
  serviceAreas: string[];
  startingPrice: number;
  instantBooking: boolean;
  responseTimeMinutes: number;
  badges: string[];
  bioAr: string;
  portfolio: string[];
  videoUrls?: string[];
  libraryUrl?: string | null;
  contactPhone: string;
  whatsappNumber: string;
  genderSpecialty?: 'men_specialist' | 'women_specialist' | 'both';
  cancellationPolicyAr: string;
  status: 'active' | 'under_review' | 'suspended';
  metrics?: VendorMetrics;
  featured?: boolean;
  specialtiesAr?: string[];
  availability?: ServiceAvailability;
}

export interface VendorMetrics {
  averageRating: number;
  reviewsCount: number;
  completedOrders: number;
  cancelledOrders: number;
  repeatCustomerRate: number;
  responseTimeMinutes: number;
  acceptanceRate: number;
  onTimeRate: number;
  satisfactionRate: number;
  yearsOfExperience: number;
}

export interface ServicePackage {
  id: string;
  nameAr: string;
  nameEn?: string;
  tier?: 'basic' | 'standard' | 'premium' | 'vip';
  price: number;
  descriptionAr?: string;
  durationHours?: number;
  featuresAr: string[];
  isPopular?: boolean;
}

export interface ServiceAddon {
  id: string;
  titleAr: string;
  nameAr?: string; // alias
  descriptionAr?: string;
  price: number;
  pricingType: 'fixed' | 'per_unit' | 'per_hour' | 'per_person';
  isAvailable: boolean;
  maxQuantity?: number;
}

export interface ServiceAvailability {
  workingDays: number[];
  timeSlots: string[];
  capacityPerSlot: number;
  blackoutDates: string[];
  minNoticeDays: number;
  maxAdvanceDays: number;
}

export interface ServiceItem {
  titleEn?: string;
  descriptionEn?: string;
  subcategoryId?: string | null;
  artistId?: string | null;
  subcategory?: import('./catalog/types').CatalogSubcategory | null;
  artist?: import('./catalog/types').CatalogArtist | null;
  previewAudioUrl?: string | null;
  videoUrls?: string[];
  isPublished?: boolean;
  id: string;
  vendorId: string;
  vendorName: string;
  vendorRating: number;
  vendorLogo: string;
  categoryId: string;
  categoryNameAr: string;
  cityId: string;
  cityNameAr: string;
  titleAr: string;
  descriptionAr: string;
  price: number;
  priceType: 'fixed' | 'per_person' | 'starting_at';
  images: string[];
  featuresAr: string[];
  capacityMax?: number;
  instantBooking: boolean;
  genderPreference?: 'men' | 'women' | 'unisex';
  badge?: string;
  isPopular?: boolean;
  packages?: ServicePackage[];
  addons?: ServiceAddon[];
  availability?: ServiceAvailability;
  discountPercent?: number;
  originalPrice?: number;
  executionDurationHours?: number;
}

export interface PackageItem {
  categoryName: string;
  serviceName: string;
  vendorName: string;
  vendorId: string;
  pricePortion: number;
  included: boolean;
  customizable: boolean;
  options?: string[];
}

export interface SmartPackage {
  titleEn?: string;
  subtitleEn?: string;
  id: string;
  titleAr: string;
  subtitleAr: string;
  occasionTypeId: string;
  occasionTypeNameAr: string;
  cityId: string;
  guestCount: number;
  originalPrice: number;
  packagePrice: number;
  savings: number;
  badge: string;
  image: string;
  items: PackageItem[];
  customizable: boolean;
  rating: number;
  reviewsCount: number;
  descriptionAr: string;
}

export interface Occasion {
  serviceSelections?: import('./catalog/types').ServiceSelection[];
  shareCode?: string;
  shareOrigin?: string;
  id: string;
  title: string;
  occasionTypeId: string;
  occasionTypeNameAr: string;
  cityId: string;
  cityNameAr: string;
  neighborhood?: string;
  date: string;
  time?: string;
  isApproximateDate: boolean;
  guestCount: number;
  guestsSection: GenderSection;
  venueType: VenueType;
  venueName?: string;
  budget: number;
  spent: number;
  tier: OccasionTier;
  readinessPercentage: number;
  status: 'planning' | 'confirmed' | 'in_progress' | 'completed';
  createdAt: string;
  notes?: string;
  coPlanners?: { name: string; role: 'owner' | 'coplanner' | 'viewer'; phone: string }[];
}

export interface Guest {
  email?: string;
  revokedAt?: string;
  rsvpCompanionCount?: number;
  id: string;
  occasionId: string;
  name: string;
  phone: string;
  category: 'men' | 'women' | 'family';
  familyGroup?: string;
  companionCount: number;
  status: 'invited' | 'viewed' | 'confirmed' | 'declined' | 'maybe' | 'attended' | 'absent';
  qrCode: string;
  tableId?: string;
  tableName?: string;
  invitedVia: 'whatsapp' | 'sms' | 'email' | 'link';
  invitationSentAt?: string;
  rsvpTime?: string;
  notes?: string;
}

export interface SeatingTable {
  id: string;
  occasionId: string;
  name: string;
  capacity: number;
  section: 'men' | 'women' | 'vip' | 'general';
  assignedGuestIds: string[];
}

export interface BudgetItem {
  id: string;
  occasionId: string;
  categoryId: string;
  categoryNameAr: string;
  allocatedAmount: number;
  spentAmount: number;
  status: 'estimated' | 'booked' | 'paid';
  vendorId?: string;
  vendorName?: string;
  notes?: string;
}

export interface PlanningTask {
  id: string;
  occasionId: string;
  title: string;
  category: string;
  dueDaysBefore: number;
  dueDate: string;
  assignedTo?: string;
  isCompleted: boolean;
  priority: 'high' | 'medium' | 'low';
}

export interface RunOfShowItem {
  id: string;
  occasionId: string;
  time: string; // e.g., "16:00" or "04:00 م"
  titleAr: string;
  descriptionAr: string;
  responsibleRole: 'coordinator' | 'family' | 'photographer' | 'catering' | 'music' | 'hall_manager' | 'other';
  responsibleRoleAr: string;
  responsiblePerson?: string;
  responsiblePhone?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'delayed';
  durationMinutes: number;
  notes?: string;
  iconName?: string;
}


export interface WishlistGift {
  id: string;
  occasionId: string;
  title: string;
  price: number;
  category: string;
  imageUrl: string;
  isFulfilled: boolean;
  giftedBy?: string;
  allowContributions: boolean;
  contributedAmount: number;
  isServiceGift?: boolean;
  serviceVendorName?: string;
}

export interface InspirationPost {
  id: string;
  titleAr: string;
  occasionTypeId: string;
  occasionTypeNameAr: string;
  mediaType: 'image' | 'video';
  mediaUrl: string;
  likesCount: number;
  savesCount: number;
  tags: string[];
  taggedVendors: {
    vendorId: string;
    vendorName: string;
    category: string;
    servicePrice: number;
  }[];
  descriptionAr: string;
  cityNameAr: string;
}

export interface RFQQuote {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  rating: number;
  basePrice: number;
  setupFee: number;
  transportFee: number;
  vat: number;
  total: number;
  optionalItems: { title: string; price: number }[];
  deliveryTimeAr: string;
  notesAr: string;
  status: 'pending' | 'accepted' | 'declined';
  isBestValue?: boolean;
  isFastest?: boolean;
  isHighestRated?: boolean;
  isClosestBudget?: boolean;
}

export interface RFQRequest {
  id: string;
  occasionId?: string;
  occasionTitle: string;
  occasionTypeAr: string;
  cityAr: string;
  date: string;
  guestCount: number;
  budget: number;
  requirementsAr: string;
  quotesCount: number;
  quotes: RFQQuote[];
  status: 'open' | 'awarded' | 'closed';
  createdAt: string;
}

export interface Booking {
  id: string;
  bookingNumber: string;
  occasionId?: string;
  occasionTitle: string;
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  serviceId?: string;
  serviceTitleAr: string;
  packageId?: string;
  date: string;
  time?: string;
  cityAr: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  totalAmount: number;
  depositAmount: number;
  remainingAmount: number;
  depositPaid: boolean;
  isFullyPaid: boolean;
  paymentMethod?: PaymentMethod;
  status: BookingStatus;
  cancellationPolicyAr: string;
  createdAt: string;
  deliverablesAr: string[];
  payoutReleased?: boolean;
  payoutRef?: string;
  commissionAmount?: number;
}

export interface Review {
  id: string;
  vendorId: string;
  vendorName: string;
  bookingId: string;
  customerName: string;
  customerCityAr: string;
  occasionTypeAr: string;
  rating: number;
  qualityRating: number;
  punctualityRating: number;
  communicationRating: number;
  valueRating: number;
  date: string;
  commentAr: string;
  isVerifiedBooking: boolean;
  vendorReplyAr?: string;
  featured?: boolean;
  status?: 'approved' | 'pending' | 'rejected';
  avatarUrl?: string;
}

export interface PaymentRecord {
  id: string;
  bookingId: string;
  bookingNumber: string;
  occasionTitle: string;
  amount: number;
  vatAmount: number;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  type: 'deposit' | 'remaining' | 'full';
  status: 'completed' | 'pending' | 'refunded';
  transactionRef: string;
  invoiceNumber: string;
  paidAt: string;
}

export interface AdminPlatformConfig {
  platformNameAr: string;
  platformNameEn: string;
  taglineAr: string;
  commissionRatePercent: number;
  vatPercent: number;
  currencyAr: string;
  emergencyPhone: string;
  aiAssistantNameAr: string;
  activeCitiesCount: number;
  totalGMV: number;
  totalBookings: number;
  totalUsers: number;
  totalVendors: number;
  announcementText?: string;
  isMaintenanceMode?: boolean;
  defaultEscrowDays?: number;
  autoApproveReviews?: boolean;
  rankingWeights?: RankingWeights;
}

export interface EaniyahGift {
  id: string;
  occasionId: string;
  senderName: string;
  senderPhone?: string;
  amount: number;
  blessingMessage: string;
  recipientTitle: string;
  paymentMethod: 'apple_pay' | 'mada' | 'stc_pay';
  isPrivateAmount: boolean;
  cardStyle: 'royal_gold' | 'emerald_luxury' | 'saudi_violet' | 'traditional_sadu';
  status: 'completed' | 'transferred';
  createdAt: string;
  transactionRef: string;
}

export interface CartItemAddon {
  addonId: string;
  titleAr: string;
  price: number;
  quantity: number;
}

export interface CartItem {
  id: string;
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  serviceId: string;
  serviceTitleAr: string;
  serviceImage: string;
  packageId?: string;
  packageNameAr?: string;
  selectedPackage: ServicePackage;
  packagePrice: number;
  addons: CartItemAddon[];
  selectedAddons?: (ServiceAddon | CartItemAddon)[];
  quantity: number;
  scheduledDate: string;
  scheduleDate?: string;
  scheduledTime?: string;
  scheduleTime?: string;
  cityId: string;
  cityNameAr: string;
  locationCity?: string;
  venueAddress?: string;
  notes?: string;
  basePrice: number;
  addonsTotal: number;
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  totalPrice: number;
}

export interface VendorCartGroup {
  vendorId: string;
  vendorName: string;
  vendorLogo: string;
  cityId: string;
  cityNameAr: string;
  items: CartItem[];
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
}

export interface Coupon {
  code: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderAmount: number;
  maxDiscountAmount?: number;
  descriptionAr: string;
  expiryDate: string;
  applicableVendorId?: string;
}

export interface MultiVendorOrder {
  id: string;
  orderNumber: string;
  customerId: string;
  customerName: string;
  customerPhone: string;
  customerEmail?: string;
  eventDate: string;
  eventTime?: string;
  cityId: string;
  cityNameAr: string;
  venueName?: string;
  suborders: {
    suborderId: string;
    vendorId: string;
    vendorName: string;
    vendorLogo: string;
    items: CartItem[];
    subtotal: number;
    taxAmount: number;
    totalAmount: number;
    depositAmount: number;
    remainingAmount: number;
    status: BookingStatus;
    bookingNumber: string;
  }[];
  totalSubtotal: number;
  totalTax: number;
  couponDiscount: number;
  couponCode?: string;
  finalTotal: number;
  totalDeposit: number;
  paymentMethod: PaymentMethod;
  isDepositOnly: boolean;
  createdAt: string;
  status: 'confirmed' | 'in_preparation' | 'completed' | 'cancelled';
}

export interface RankingWeights {
  ratingWeight: number; // e.g. 25
  priceWeight: number; // e.g. 20
  availabilityWeight: number; // e.g. 15
  ordersWeight: number; // e.g. 15
  onTimeWeight: number; // e.g. 10
  responseSpeedWeight: number; // e.g. 5
  verificationWeight: number; // e.g. 5
  distanceWeight: number; // e.g. 5
}

export interface VendorRecommendationResult {
  vendor: Vendor;
  matchedService?: ServiceItem;
  primaryService?: ServiceItem;
  compositeScore: number;
  priceScore: number;
  ratingScore: number;
  reliabilityScore: number;
  availabilityScore: number;
  bestValueScore: number;
  badges: ('الأفضل تقييماً' | 'أفضل قيمة' | 'الأقل سعراً' | 'الأسرع تجاوباً' | 'الأقرب' | 'اختيار لُـمى')[];
  reasonsAr: string[];
}

export interface VendorRecommendationCriteria {
  categoryId?: string;
  cityId?: string;
  maxPrice?: number;
  minRating?: number;
  verifiedOnly?: boolean;
  date?: string;
  sortPreference?: 'recommended' | 'cheapest' | 'best_rated' | 'fastest' | 'nearest' | 'best_value';
  occasionTypeId?: string;
}

// -------------------------------------------------------------
// User & Authentication / Onboarding Types
// -------------------------------------------------------------
export type UserRole = 'client' | 'vendor' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  phone: string;
  email?: string;
  role: UserRole;
  avatar?: string;
  cityId?: string;
  cityNameAr?: string;
  vendorId?: string;
  businessName?: string;
  crNumber?: string;
  freelanceLicense?: string;
  isVerified?: boolean;
  createdAt?: string;
  hasAdminAccess?: boolean;
  hasSystemAccess?: boolean;
}

export interface CustomerRegistrationPayload {
  captchaToken?: string;
  name: string;
  phone: string;
  email?: string;
  cityId: string;
  upcomingOccasionType?: string;
  occasionDate?: string;
  password?: string;
}

export interface VendorRegistrationPayload {
  captchaToken?: string;
  businessName: string;
  businessNameEn?: string;
  categoryId: string;
  cityId: string;
  neighborhood: string;
  crNumber?: string;
  freelanceLicense?: string;
  vatNumber?: string;
  contactName: string;
  contactPhone: string;
  whatsappNumber: string;
  startingPrice: number;
  bioAr: string;
  specialtiesAr?: string[];
  password?: string;
}


