export const FEATURE_CATALOG = [
  { id: 'zaffah_generator', name: 'مولّد نصوص وقصائد الزفة', description: 'المولّد داخل مكتبة الفنون والفرق الشعبية', paths: [], apiPaths: ['/api/zaffah/generate'], visible: false, enabled: false },
  { id: 'folk_arts', name: 'مكتبة الفنون والفرق الشعبية', description: 'استعراض الفنون والفرق وحجوزاتها', paths: ['/zaffah'], apiPaths: [], visible: true, enabled: true },
  { id: 'marketplace', name: 'سوق الخدمات والموردين', description: 'الدليل وصفحات الخدمات والموردين', paths: ['/marketplace','/service'], apiPaths: ['/api/catalog/vendors'], visible: true, enabled: true },
  { id: 'packages', name: 'الباقات', description: 'عرض الباقات الجاهزة', paths: ['/packages'], apiPaths: [], visible: true, enabled: true },
  { id: 'planning', name: 'تخطيط المناسبات', description: 'إنشاء المناسبات ومساحة العمل', paths: ['/plan','/occasion'], apiPaths: ['/api/occasions'], visible: true, enabled: true },
  { id: 'invitations', name: 'الدعوات وتأكيد الحضور', description: 'البطاقات وروابط الضيوف وقنوات الإرسال', paths: ['/invite'], apiPaths: ['/api/invitations','/api/invitation-studio','/api/guests'], visible: true, enabled: true },
  { id: 'digital_cards', name: 'بطاقات ودعوات رقمية (خدمة مباشرة)', description: 'صفحة مستقلة لطلب البطاقات من الموردين وتصميمها ذاتياً دون مناسبة', paths: ['/invitations'], apiPaths: ['/api/invitation-pricing'], visible: true, enabled: true },
  { id: 'gate_scanner', name: 'بوابة الدخول', description: 'التحقق من رموز الضيوف', paths: ['/scan'], apiPaths: [], visible: true, enabled: true },
  { id: 'reception', name: 'شاشة الاستقبال', description: 'شاشة الترحيب بالحضور', paths: ['/reception-screen'], apiPaths: [], visible: true, enabled: true },
  { id: 'calculator', name: 'حاسبة الميزانية', description: 'تقدير تكاليف المناسبة', paths: ['/calculator'], apiPaths: [], visible: true, enabled: true },
  { id: 'rfq', name: 'طلبات عروض الأسعار', description: 'طلبات عروض الأسعار والمقارنة', paths: ['/rfq','/compare'], apiPaths: [], visible: true, enabled: true },
  { id: 'inspiration', name: 'الإلهام', description: 'الأفكار والمحتوى المرئي', paths: ['/inspiration'], apiPaths: [], visible: true, enabled: true },
  { id: 'commerce', name: 'الحجوزات والشراء', description: 'السلة والدفع والحجوزات', paths: ['/cart','/checkout','/bookings'], apiPaths: ['/api/oms/orders'], visible: true, enabled: true },
  { id: 'vendor_portal', name: 'بوابة الموردين', description: 'لوحة المورد وإدارة طلباته', paths: ['/vendor'], apiPaths: [], visible: true, enabled: true },
  { id: 'booking_exceptions', name: 'طلبات الاستثناء وتعديل المواعيد', description: 'طلب استثناء من مدة الحجز المسبق وتعديل مواعيد الحجوزات بموافقات ثلاثية', paths: ['/exceptions'], apiPaths: ['/api/exceptions'], visible: false, enabled: false },
  { id: 'reviews', name: 'تقييمات وتعليقات العملاء', description: 'تقييم الخدمات المكتملة وردود الموردين بعد اعتماد الإدارة', paths: [], apiPaths: ['/api/reviews'], visible: true, enabled: true },
  { id: 'luma', name: 'المخططة الذكية لُمى', description: 'المساعد داخل صفحات التطبيق', paths: [], apiPaths: [], visible: true, enabled: true },
] as const;
export type FeatureId = typeof FEATURE_CATALOG[number]['id'];
export interface FeatureState { id: FeatureId; visible: boolean; enabled: boolean; version: number }
export const defaultFeatures = (): FeatureState[] => FEATURE_CATALOG.map(f => ({ id: f.id, visible: f.visible, enabled: f.enabled, version: 0 }));
export function featureForPath(path: string, api = false) {
  if(!api && (path==='/bookings'||path.startsWith('/bookings/')))return undefined;
  return FEATURE_CATALOG.find(f => (api ? f.apiPaths : f.paths).some(prefix => path === prefix || path.startsWith(prefix + '/')));
}
