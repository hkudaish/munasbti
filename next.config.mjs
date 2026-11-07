/** @type {import('next').NextConfig} */
const isDev = process.env.NODE_ENV !== 'production';

// Next.js needs inline scripts/styles; images and media may come from supplier-provided HTTPS URLs.
// Cloudflare Turnstile (CAPTCHA) loads a script and an iframe from challenges.cloudflare.com; allowed only when it is configured.
const turnstile = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ? ' https://challenges.cloudflare.com' : '';
const contentSecurityPolicy = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${turnstile}${isDev ? " 'unsafe-eval'" : ''}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https:",
  "media-src 'self' blob: https:",
  "font-src 'self' data:",
  `connect-src 'self'${turnstile}${isDev ? ' ws: wss:' : ''}`,
  `frame-src 'self'${turnstile}`,
  "frame-ancestors 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
].join('; ');

const nextConfig = {
  poweredByHeader: false,
  // Self-hosted builds (Hostinger VPS) set BUILD_STANDALONE=1 for a small self-contained server in .next/standalone; Netlify keeps its own output.
  ...(process.env.BUILD_STANDALONE === '1' ? { output: 'standalone' } : {}),
  distDir: process.env.NEXT_TEST_DIST_DIR || '.next',
  typescript: { tsconfigPath: process.env.NEXT_TEST_TSCONFIG || 'tsconfig.json' },
  reactStrictMode: true,
  async headers() {
    // Pages behind a sign-in are never stored by the browser or its back/forward cache, so Back after
    // a sign-out cannot show a stale dashboard.
    const protectedPaths = ['/reset-password', '/verify-email', '/forgot-password', '/admin', '/system-admin', '/access', '/bookings', '/occasion', '/settings', '/reception-screen', '/scan', '/commerce/orders', '/commerce/manage', '/vendor/catalog', '/vendor/orders'];
    const noStore = [
      { source: '/vendor', headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] },
      ...protectedPaths.flatMap(path => [path, path + '/:path*']).map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'no-store, max-age=0' }] })),
    ];
    // A second layer besides robots.txt and the page's own robots tag: private areas are never indexed, even when someone links to them.
    const privateAreas = ['/reset-password', '/verify-email', '/forgot-password', '/admin', '/system-admin', '/access', '/system-setup', '/vendor', '/cart', '/checkout', '/commerce/cart', '/commerce/orders', '/commerce/manage', '/bookings', '/occasion', '/settings', '/invite', '/scan', '/reception-screen', '/coverage-preview', '/compare'];
    const noIndex = privateAreas.flatMap(path => [path, path + '/:path*']).map(source => ({ source, headers: [{ key: 'X-Robots-Tag', value: 'noindex, nofollow' }] }));
    // Public static files that rarely change: the browser keeps them, so repeat visits skip the download.
    const staticAssets = [
      { source: '/fonts/:path*', headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }] },
      ...['/icon-32.png', '/icon-192.png', '/icon-512.png', '/icon-maskable-512.png', '/apple-touch-icon.png', '/og-default.png', '/og-default-en.png']
        .map(source => ({ source, headers: [{ key: 'Cache-Control', value: 'public, max-age=604800, stale-while-revalidate=86400' }] })),
    ];
    return [...noStore, ...noIndex, ...staticAssets, { source: '/:path*', headers: [
      { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      ...(isDev ? [] : [{ key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' }]),
      { key: 'Content-Security-Policy', value: contentSecurityPolicy },
      { key: 'Permissions-Policy', value: 'camera=(self), microphone=(), geolocation=(self)' },
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
    ] }];
  },
  swcMinify: true,
  compiler: {
    removeConsole: process.env.NODE_ENV === 'production' ? { exclude: ['error'] } : false,
  },
  experimental: {
    optimizePackageImports: ['lucide-react'],
  },
  images: {
    formats: ['image/avif', 'image/webp'],
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
      },
      {
        protocol: 'https',
        hostname: 'plus.unsplash.com',
      },
    ],
  },
};

export default nextConfig;
