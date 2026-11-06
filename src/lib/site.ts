/** The public address of the site (no trailing slash). NEXT_PUBLIC_APP_URL is set on Netlify; localhost otherwise. */
export function siteUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL || process.env.URL || 'http://localhost:3000').replace(/\/+$/, '');
}
export const SITE_NAME = { ar: 'مناسبتـي', en: 'Munasbti' } as const;
