import type { Locale } from '@/lib/i18n/locale';

export interface PageMeta { title: Record<Locale, string>; description: Record<Locale, string>; keywords?: string[] }
const SUFFIX: Record<Locale, string> = { ar: ' | مناسبتـي', en: ' | Munasbti' };
const page = (ar: [string, string], en: [string, string]): PageMeta => ({ title: { ar: ar[0] + SUFFIX.ar, en: en[0] + SUFFIX.en }, description: { ar: ar[1], en: en[1] } });

export const HOME: PageMeta = {
  title: { ar: 'مناسبتـي | منصة التخطيط الذكي وحجز المناسبات والاحتفالات السعودية', en: 'Munasbti | Smart event planning and booking in Saudi Arabia' },
  description: { ar: 'خططها. احجزها. اعزمهم. احتفل. المنصة السعودية الأولى لتنظيم وحجز كافة خدمات وباقات المناسبات والأعراس والتخرج بالذكاء الاصطناعي.', en: 'Plan it. Book it. Invite them. Celebrate. Saudi Arabia’s smart platform to plan and book weddings, engagements, graduations and every celebration: halls, kosha, hospitality, photography and ready-made packages.' },
  keywords: ['مناسبتي', 'تخطيط مناسبات', 'كوشة بالرياض', 'ضيافة سعودية', 'قهوجيين', 'حفلات تخرج', 'زواج', 'ملكة', 'عروض أسعار', 'event planning Saudi Arabia', 'wedding services Riyadh', 'book event vendors'],
};
const STORE = page(['خدمات المناسبات والموردون', 'تصفح خدمات وعروض موردي المناسبات في مدينتك: قاعات، كوش، ضيافة، تصوير وأكثر، بأسعار واضحة وحجز مباشر.'], ['Event services and vendors', 'Browse event services and vendor offers in your city: halls, kosha, hospitality, photography and more, with clear prices and direct booking.']);
/** Titles and descriptions of the public pages (the key is the page path, without /en). Anything not listed uses the site default. */
export const PAGES: Record<string, PageMeta> = {
  '/': HOME,
  '/commerce': STORE,
  '/marketplace': STORE,
  '/packages': page(['باقات المناسبات الجاهزة', 'باقات مناسبات جاهزة تجمع عروض عدة موردين بسعر واحد وخصم على الباقة: أعراس، ملكة، تخرج وغيرها.'], ['Ready-made event packages', 'Ready-made event packages that bring several vendors’ offers together at one price with a package discount: weddings, engagements, graduations and more.']),
  '/plan': page(['خطط مناسبتك', 'أنشئ مناسبتك واحصل على خطة ومهام وميزانية مقترحة بمساعدة الذكاء الاصطناعي.'], ['Plan your event', 'Create your event and get a suggested plan, tasks and budget with AI help.']),
  '/calculator': page(['حاسبة ميزانية المناسبة', 'قدّر تكلفة مناسبتك وتوزيع الميزانية على الخدمات قبل الحجز.'], ['Event budget calculator', 'Estimate your event cost and how to split the budget across services before you book.']),
  '/inspiration': page(['معرض الإلهام', 'أفكار وتصاميم لمناسبتك من أعراس وحفلات تخرج وملكة وتنسيقات.'], ['Inspiration gallery', 'Ideas and designs for your event: weddings, graduations, engagements and decor.']),
  '/artists': page(['الفنانون والفرق', 'استعرض الفنانين والفرق الفنية المتاحة لحفلك.'], ['Artists and bands', 'Browse the artists and bands available for your event.']),
  '/zaffah': page(['الزفات والفنون الشعبية', 'مكتبة الزفات والفرق الشعبية ومولّد نصوص الزفة.'], ['Zaffah and folk arts', 'Zaffah and folk-arts library with a zaffah text generator.']),
  '/rfq': page(['طلب عروض أسعار', 'اطلب عروض أسعار من عدة موردين وقارنها قبل أن تقرر.'], ['Request quotes', 'Ask several vendors for quotes and compare them before you decide.']),
};
/** Pages that must never appear in search results: accounts, carts, workspaces and the control panels. */
export const PRIVATE_PREFIXES = ['/admin', '/system-admin', '/system-setup', '/vendor', '/cart', '/checkout', '/commerce/cart', '/commerce/orders', '/commerce/manage', '/bookings', '/occasion', '/settings', '/invite', '/scan', '/reception-screen', '/coverage-preview', '/compare'];
export const isPrivatePath = (path: string) => PRIVATE_PREFIXES.some(p => path === p || path.startsWith(p + '/'));
export const pageMeta = (path: string): PageMeta | undefined => PAGES[path.replace(/\/+$/, '') || '/'];
/** Pages listed in the sitemap, with how often they change. Services are added from the database. */
export const SITEMAP_PAGES: { path: string; priority: number; changeFrequency: 'daily' | 'weekly' | 'monthly' }[] = [
  { path: '/', priority: 1, changeFrequency: 'daily' }, { path: '/commerce', priority: 0.9, changeFrequency: 'daily' }, { path: '/marketplace', priority: 0.8, changeFrequency: 'daily' }, { path: '/packages', priority: 0.8, changeFrequency: 'weekly' },
  { path: '/plan', priority: 0.7, changeFrequency: 'monthly' }, { path: '/calculator', priority: 0.5, changeFrequency: 'monthly' }, { path: '/inspiration', priority: 0.5, changeFrequency: 'weekly' }, { path: '/artists', priority: 0.5, changeFrequency: 'weekly' }, { path: '/zaffah', priority: 0.5, changeFrequency: 'monthly' }, { path: '/rfq', priority: 0.5, changeFrequency: 'monthly' },
];
