import 'server-only';
import { prisma } from '@/lib/db';
import { resolve } from '@/lib/availability/resolver';
import { loadSnapshotForListing } from '@/lib/server/availability/loader';
import { serviceContext, serviceRows } from '@/lib/server/availability/matrix';
import { servicePublicReviews } from '@/lib/server/reviews';
import { siteUrl } from '@/lib/site';
import { localizePath, type Locale } from '@/lib/i18n/locale';

const clip = (text: string, max: number) => { const flat = text.replace(/\s+/g, ' ').trim(); return flat.length <= max ? flat : flat.slice(0, max - 1).replace(/\s+\S*$/, '') + '…'; };
const httpsImage = (url: unknown) => (typeof url === 'string' && /^https:\/\//.test(url) ? url : undefined);
/** What a search engine should know about one service: only for services the public can see. null when there is no such public service. */
export async function serviceSeo(id: string, locale: Locale) {
  const rows = await prisma.$queryRaw<any[]>`SELECT "id", "sourceId", "body" FROM "CommerceService" WHERE "id" = ${id}`;
  const service = rows[0];
  if (!service) return null;
  const body = service.body ?? {};
  const [listed, snapshot, offers, categories, cities] = await Promise.all([
    serviceRows(), loadSnapshotForListing(),
    prisma.$queryRaw<{ amount: number | null }[]>`SELECT ("body"->'policy'->>'baseAmount')::int AS amount FROM "CommerceOffer" WHERE "serviceId" = ${id} AND "body"->>'enabled' = 'true'`,
    prisma.serviceCategory.findUnique({ where: { id: body.categoryId ?? '' }, select: { nameAr: true, nameEn: true } }),
    prisma.saudiCity.findMany({ where: { id: { in: Array.isArray(body.cities) ? body.cities : [] } }, select: { id: true, nameAr: true, nameEn: true } }),
  ]);
  const row = listed.find(s => s.id === id);
  const published = body.published === true && body.approved === true && !!row;
  const decisions = row ? (row.kind === 'DIGITAL' ? [resolve(snapshot, serviceContext(row, null))] : row.cities.map(c => resolve(snapshot, serviceContext(row, c)))) : [];
  const visible = published && decisions.some(d => d.isVisible);
  const { reviews, summary } = published ? await servicePublicReviews(id, service.sourceId) : { reviews: [], summary: { count: 0, average: null } };
  const prices = offers.map(o => o.amount ?? 0).filter(n => n > 0);
  const vendorName = row?.vendorName ?? null;
  const title: string = (locale === 'en' && body.titleEn) || body.titleAr || id;
  const description: string = clip((locale === 'en' && body.descriptionEn) || body.descriptionAr || '', 160);
  return {
    published: visible, title, hasEnglish: !!(body.titleEn && body.descriptionEn), description, image: httpsImage(body.images?.[0]), provider: vendorName ?? (locale === 'en' ? 'Munasbti' : 'منصة مناسبتـي'),
    category: locale === 'en' ? categories?.nameEn : categories?.nameAr, cities: cities.map(c => (locale === 'en' ? c.nameEn || c.nameAr : c.nameAr)),
    lowPrice: prices.length ? Math.min(...prices) / 100 : null, highPrice: prices.length ? Math.max(...prices) / 100 : null, offerCount: offers.length,
    availability: decisions.some(d => d.canBook) ? 'https://schema.org/InStock' : decisions.some(d => d.effectiveStatus === 'COMING_SOON') ? 'https://schema.org/PreOrder' : 'https://schema.org/OutOfStock',
    reviews: reviews.slice(0, 5), rating: summary,
  };
}
/** schema.org Service (+ breadcrumb) for a service page. Rating and reviews are included only when the page shows them. */
export function serviceJsonLd(id: string, locale: Locale, seo: NonNullable<Awaited<ReturnType<typeof serviceSeo>>>) {
  const url = siteUrl() + localizePath('/commerce/service/' + encodeURIComponent(id), locale);
  const home = siteUrl() + localizePath('/', locale), store = siteUrl() + localizePath('/commerce', locale);
  return [
    {
      '@context': 'https://schema.org', '@type': 'Service', '@id': url + '#service', name: seo.title, description: seo.description || undefined, url, inLanguage: locale === 'en' && seo.hasEnglish ? 'en' : 'ar-SA',
      ...(seo.image ? { image: [seo.image] } : {}), ...(seo.category ? { serviceType: seo.category } : {}),
      provider: { '@type': 'Organization', name: seo.provider }, areaServed: seo.cities.map(name => ({ '@type': 'City', name })),
      ...(seo.offerCount ? { offers: { '@type': seo.lowPrice != null && seo.highPrice != null && seo.lowPrice !== seo.highPrice ? 'AggregateOffer' : 'Offer', priceCurrency: 'SAR', ...(seo.lowPrice != null ? (seo.highPrice !== seo.lowPrice ? { lowPrice: seo.lowPrice, highPrice: seo.highPrice, offerCount: seo.offerCount } : { price: seo.lowPrice }) : {}), availability: seo.availability, url } } : {}),
      ...(seo.rating.count && seo.rating.average ? { aggregateRating: { '@type': 'AggregateRating', ratingValue: seo.rating.average, reviewCount: seo.rating.count, bestRating: 5, worstRating: 1 }, review: seo.reviews.map(r => ({ '@type': 'Review', author: { '@type': 'Person', name: r.reviewerName }, datePublished: r.date, reviewBody: r.commentAr, reviewRating: { '@type': 'Rating', ratingValue: Math.round(r.rating), bestRating: 5, worstRating: 1 } })) } : {}),
    },
    { '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [{ '@type': 'ListItem', position: 1, name: locale === 'en' ? 'Home' : 'الرئيسية', item: home }, { '@type': 'ListItem', position: 2, name: locale === 'en' ? 'Services' : 'الخدمات', item: store }, { '@type': 'ListItem', position: 3, name: seo.title, item: url }] },
  ];
}
