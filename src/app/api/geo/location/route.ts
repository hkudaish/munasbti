import { prisma } from '@/lib/db';
import { api,body,HttpError,text } from '@/lib/server/http';
import { rateLimit,sessionUser } from '@/lib/server/auth';
import { visitorId,geoContext,makeContext } from '@/lib/server/geo/context';
import { readGeo } from '@/lib/server/geo/data';
import { matchCity } from '@/lib/geo/engine';
import { insideSaudiArabia,nearestCity } from '@/lib/geo/nearby';
export const POST=api(async request=>{
 const d=await body(request,4096);const visitorHash=(await visitorId(true))!;const s=await readGeo();let cityId:string|null=null,countryCode:string|null=null,unknownName:string|null=null;
 if(d.source==='MANUAL'){
  cityId=text(d.cityId,100,true);const city=s.cities.find(c=>c.id===cityId);if(!city)throw new HttpError(400,'اختر مدينة من القائمة');countryCode=city.countryCode;
 }else if(d.source==='GPS'){
  if(d.consent!==true)throw new HttpError(400,'مشاركة الموقع تحتاج موافقتك');
  const offline=s.cities.some(c=>typeof c.latitude==='number'&&typeof c.longitude==='number');
  if(!s.policy.reverseEnabled||(!offline&&!process.env.GEOAPIFY_API_KEY))throw new HttpError(503,'تحديد المدينة تلقائياً غير مهيأ حالياً؛ اختر مدينتك يدوياً');
  if(typeof d.latitude!=='number'||typeof d.longitude!=='number'||!Number.isFinite(d.latitude)||!Number.isFinite(d.longitude)||Math.abs(d.latitude)>90||Math.abs(d.longitude)>180)throw new HttpError(400,'إحداثيات غير صالحة');
  const current=await geoContext();if(current.selection.source==='MANUAL'&&d.replaceManual!==true)return current;
  await rateLimit('geo-resolve:'+visitorHash,10,3600000);
  if(offline){
   // matched on our own server against the city centres: no third party sees the position and it is not stored, only the city
   const near=nearestCity(s,d.latitude,d.longitude);
   cityId=near?.city.id??null;countryCode=near?near.city.countryCode:insideSaudiArabia(d.latitude,d.longitude)?'SA':null;unknownName=null;
  }else{
  const url=new URL('https://api.geoapify.com/v1/geocode/reverse');url.search=new URLSearchParams({lat:String(d.latitude),lon:String(d.longitude),type:'city',format:'json',lang:'ar',apiKey:process.env.GEOAPIFY_API_KEY!}).toString();
  let result:any;try{const r=await fetch(url,{signal:AbortSignal.timeout(8000),redirect:'error',cache:'no-store'});if(!r.ok)throw Error();result=(await r.json()).results?.[0];}catch{throw new HttpError(503,'تعذر تحديد المدينة؛ يمكنك اختيارها يدوياً');}
  countryCode=typeof result?.country_code==='string'?result.country_code.toUpperCase():null;
  unknownName=typeof result?.city==='string'?result.city.slice(0,120):null;
  cityId=countryCode?matchCity(s,countryCode,[unknownName||'',result?.name||'']):null;
  }
 }else throw new HttpError(400,'مصدر الموقع غير صالح');
 const user=await sessionUser();await prisma.geoPreference.upsert({where:{visitorHash},create:{visitorHash,userId:user?.id,cityId,countryCode,unknownName,source:d.source,expiresAt:new Date(Date.now()+180*86400000)},update:{userId:user?.id,cityId,countryCode,unknownName,source:d.source,expiresAt:new Date(Date.now()+180*86400000)}});
 return makeContext(s,{cityId,countryCode,unknownName,source:d.source});
});
