import type { Metadata, Viewport } from 'next';
import { getLocale, getPaths } from '@/lib/i18n/server';
import { EN } from '@/lib/i18n/dictionary';
import LocaleProvider from '@/components/i18n/LocaleProvider';
import { buildMetadata } from '@/lib/seo/metadata';
import JsonLd from '@/components/seo/JsonLd';
import { siteUrl, SITE_NAME } from '@/lib/site';
import { Tajawal, Cairo } from 'next/font/google';
import './globals.css';
import { AppProvider } from '@/lib/store';
import FeatureProvider, { FeatureContent } from '@/components/system/FeatureProvider';
import { featureStatesForLayout } from '@/lib/server/features';
import { defaultFeatures } from '@/lib/system/feature-catalog';
import GeoProvider from '@/components/geo/GeoProvider';
import CoverageNotice from '@/components/geo/CoverageNotice';
import LocationPrompt from '@/components/geo/LocationPrompt';
import SiteChrome from '@/components/geo/SiteChrome';
import { geoContext } from '@/lib/server/geo/context';
import Navbar from '@/components/layout/Navbar';
import MobileBottomNav from '@/components/layout/MobileBottomNav';
import Footer from '@/components/layout/Footer';
import LumaAIDrawer from '@/components/ai/LumaAIDrawer';
import UserOnboardingModal from '@/components/common/UserOnboardingModal';
import Toaster from '@/components/common/Toaster';
import ImageFallback from '@/components/common/ImageFallback';
import SessionBoundary from '@/components/system/SessionBoundary';

const tajawal = Tajawal({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '700', '800', '900'],
  variable: '--font-tajawal',
  display: 'swap',
});

const cairo = Cairo({
  subsets: ['arabic', 'latin'],
  weight: ['300', '400', '500', '600', '700', '800', '900'],
  variable: '--font-cairo',
  display: 'swap',
});

/** Title, description, canonical and language alternates, robots, Open Graph and Twitter cards for the page and language being served. */
export async function generateMetadata(): Promise<Metadata> {
  const { innerPath } = await getPaths();
  return buildMetadata({ path: innerPath, locale: await getLocale() });
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#004D3F',
};

export default async function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Independent database reads: run them together so the layout waits for the slower one, not both.
  const [location, features] = await Promise.all([
    geoContext({ layout: true }).catch(() => null),
    featureStatesForLayout().catch(() => defaultFeatures().map(f => ({ ...f, enabled: false, visible: false }))),
  ]);
  const locale = await getLocale(), { innerPath } = await getPaths(), base = siteUrl();
  return (
    <html lang={locale} dir={locale === 'en' ? 'ltr' : 'rtl'} className={`${tajawal.variable} ${cairo.variable}`}>
      <body className="min-h-screen flex flex-col bg-[#FAF7F2] text-[#1E293B] antialiased selection:bg-saudi-gold-400 selection:text-saudi-green-950">
        {innerPath === '/' && <JsonLd data={[
          { '@context': 'https://schema.org', '@type': 'Organization', '@id': base + '/#organization', name: SITE_NAME.ar, alternateName: SITE_NAME.en, url: base, logo: base + '/icon-512.png', areaServed: { '@type': 'Country', name: 'Saudi Arabia' }, description: locale === 'en' ? 'Saudi Arabia’s smart platform to plan and book events.' : 'المنصة السعودية لتخطيط وحجز المناسبات.' },
          { '@context': 'https://schema.org', '@type': 'WebSite', '@id': base + '/#website', url: base, name: SITE_NAME[locale], inLanguage: ['ar-SA', 'en'], publisher: { '@id': base + '/#organization' }, potentialAction: { '@type': 'SearchAction', target: { '@type': 'EntryPoint', urlTemplate: base + (locale === 'en' ? '/en' : '') + '/commerce?q={search_term_string}' }, 'query-input': 'required name=search_term_string' } },
        ]} />}
        <LocaleProvider locale={locale} dictionary={locale === 'en' ? EN : undefined}>
        <GeoProvider initial={location}><FeatureProvider initial={features}><AppProvider>
          <SiteChrome><Navbar /><CoverageNotice /><LocationPrompt /></SiteChrome>
          <main className="flex-1">
            <SessionBoundary>{children}</SessionBoundary>
          </main>
          {locale === 'ar' && <SiteChrome><FeatureContent id="luma"><SessionBoundary><LumaAIDrawer /></SessionBoundary></FeatureContent></SiteChrome>}
          <UserOnboardingModal />
          <Toaster />
          <ImageFallback />
          <SiteChrome><MobileBottomNav /><Footer /></SiteChrome>
        </AppProvider></FeatureProvider></GeoProvider>
        </LocaleProvider>
      </body>
    </html>
  );
}
