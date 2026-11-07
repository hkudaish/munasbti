import 'server-only';
import { cookies, headers } from 'next/headers';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/db';
import { digest, requireSystemAdmin, sessionUser } from '@/lib/server/auth';
import { HttpError } from '@/lib/server/http';
import { applyChanges, availability, matchCity, summary } from '@/lib/geo/engine';
import { GeoChange, GeoContextData, GeoSelection, GeoSnapshot } from '@/lib/geo/types';
import { readGeo } from './data';
export const VISITOR_COOKIE='munasabati_geo';
export async function visitorId(create=false){
 let id=(await cookies()).get(VISITOR_COOKIE)?.value;
 if(!id||!/^[-\w]{43}$/.test(id)){if(!create)return null;id=randomBytes(32).toString('base64url');(await cookies()).set(VISITOR_COOKIE,id,{httpOnly:true,sameSite:'lax',secure:process.env.NODE_ENV==='production',path:'/',maxAge:180*86400});}
 return digest(id);
}
export function ipSelection(s:GeoSnapshot,h:Headers, trusted:boolean):GeoSelection {
 if(!trusted||!s.policy.ipEnabled)return {cityId:null,countryCode:null,source:'UNKNOWN'};
 const countryCode=(h.get('x-vercel-ip-country')||'').toUpperCase();let city='';try{city=decodeURIComponent(h.get('x-vercel-ip-city')||'');}catch{}
 if(!/^[A-Z]{2}$/.test(countryCode))return {cityId:null,countryCode:null,source:'UNKNOWN'};
 return {countryCode,cityId:matchCity(s,countryCode,[city]),unknownName:city.slice(0,120)||null,source:'IP'};
}
export async function selection(s:GeoSnapshot):Promise<GeoSelection>{
 const hash=await visitorId(); const user=await sessionUser();
 const preferences=await prisma.geoPreference.findMany({where:{expiresAt:{gt:new Date()},OR:[...(hash?[{visitorHash:hash}]:[]),...(user?[{userId:user.id}]:[])]},orderBy:{updatedAt:'desc'},take:30});
 for(const source of ['MANUAL','GPS','IP']){const p=preferences.find(p=>p.source===source);if(p)return {cityId:p.cityId,countryCode:p.countryCode,unknownName:p.unknownName,source:source as GeoSelection['source']};}
 return ipSelection(s,new Headers(await headers()),process.env.VERCEL==='1');
}
export async function previewContext(id:string):Promise<GeoContextData>{
 const user=await requireSystemAdmin();const preview=await prisma.geoPreview.findFirst({where:{id,ownerId:user.id,expiresAt:{gt:new Date()}}});
 if(!preview)throw new HttpError(404,'المعاينة غير متاحة أو انتهت صلاحيتها');
 let snapshot=await readGeo();
 if(preview.draftId){const draft=await prisma.geoDraft.findFirst({where:{id:preview.draftId,ownerId:user.id,status:'DRAFT'}});if(!draft)throw new HttpError(409,'المسودة نُشرت أو أُلغيت؛ أنشئ معاينة جديدة');snapshot=applyChanges(snapshot,(draft.payload as any).changes as GeoChange[]);}
 return makeContext(snapshot,{cityId:preview.cityId,countryCode:preview.countryCode,source:'PREVIEW'},{id,visitorType:preview.visitorType});
}
export function makeContext(snapshot:GeoSnapshot,location:GeoSelection,preview?:GeoContextData['preview']):GeoContextData {
 const rows=availability(snapshot,location);return {snapshot,selection:location,availability:rows,summary:summary(snapshot,location,rows),preview,reverseConfigured:!!process.env.GEOAPIFY_API_KEY||snapshot.cities.some(c=>typeof c.latitude==='number'&&typeof c.longitude==='number')};
}
// Page layouts render on every request; share the (visitor-independent) snapshot for a few seconds.
// APIs and admin screens keep reading fresh data. Disabled outside production so tests see their own writes.
const LAYOUT_TTL_MS=10_000;
let layoutSnapshot:{at:number;value:Promise<GeoSnapshot>}|null=null;
function readGeoForLayout(){
 if(process.env.NODE_ENV!=='production')return readGeo();
 if(!layoutSnapshot||Date.now()-layoutSnapshot.at>LAYOUT_TTL_MS){
  const value=readGeo();layoutSnapshot={at:Date.now(),value};
  value.catch(()=>{if(layoutSnapshot?.value===value)layoutSnapshot=null;});
 }
 return layoutSnapshot.value;
}
export async function geoContext(options:{layout?:boolean}={}){const s=await(options.layout?readGeoForLayout():readGeo());return makeContext(s,await selection(s));}
export async function requireGeo(key:string,cityId?:string,db?:Parameters<typeof readGeo>[0]){
 const snapshot=await readGeo(db);const chosen=cityId?{cityId,countryCode:snapshot.cities.find(c=>c.id===cityId)?.countryCode||null,source:'MANUAL' as const}:await selection(snapshot);
 const row=availability(snapshot,chosen).find(a=>a.key===key);
 if(!row?.available)throw new HttpError(403,row?.message||row?.reason||'الخدمة غير متاحة في المدينة المختارة');
 return chosen.cityId;
}
export async function assertNotPreview(request:Request){if(request.headers.get('x-coverage-preview'))throw new HttpError(403,'المعاينة للعرض فقط ولا تسمح بتنفيذ عمليات فعلية');}
