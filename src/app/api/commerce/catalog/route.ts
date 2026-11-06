import { api } from '@/lib/server/http';
import { publicCatalogCached } from '@/lib/server/commerce-v2/catalog';
export const dynamic='force-dynamic';
export const GET=api(()=>publicCatalogCached());
