export type GeoStatus = 'AVAILABLE'|'UNAVAILABLE'|'SOON';
export interface Country { code:string; nameAr:string; nameEn:string; aliases:string[]; enabled:boolean; version:number }
export interface City { id:string; nameAr:string; nameEn:string; regionAr:string; regionEn?:string; regionId?:string|null; countryCode:string|null; aliases:string[]; isAvailable:boolean; defaultAvailable:boolean; version:number; externalId?:string|null; latitude?:number|null; longitude?:number|null }
export interface GeoService { key:string; id:string; name:string; kind:'feature'|'category'|'item'; enabled:boolean; visible:boolean; cityId?:string; vendorId?:string; categoryId?:string }
export interface Rule { cityId:string; key:string; status:GeoStatus; startsAt?:string|null; endsAt?:string|null; reason?:string|null; message?:string|null }
export interface Policy { unknownCity:'PROMPT'|'DENY'|'ALLOW'; hideUnavailable:boolean; analyticsEnabled:boolean; reverseEnabled:boolean; ipEnabled:boolean }
export interface GeoSnapshot { revision:number; countries:Country[]; cities:City[]; services:GeoService[]; categories?:import('../types').ServiceCategory[]; rules:Rule[]; policy:Policy; regions:{id:string;countryCode:string;nameAr:string;nameEn:string}[] }
export type GeoChange = { type:'country'; id:string; enabled:boolean } | { type:'city'; id:string; enabled:boolean; defaultAvailable?:boolean } | { type:'rules'; cityIds:string[]; keys:string[]; status:GeoStatus; startsAt?:string|null; endsAt?:string|null; reason?:string; message?:string } | { type:'copy'; sourceId:string; targetIds:string[] } | { type:'policy'; value:Policy };
export interface Availability { key:string; available:boolean; status:GeoStatus; reason:string; message:string }
export interface GeoSelection { cityId:string|null; countryCode:string|null; unknownName?:string|null; source:'MANUAL'|'GPS'|'IP'|'UNKNOWN'|'PREVIEW' }
export interface GeoContextData { snapshot:GeoSnapshot; selection:GeoSelection; availability:Availability[]; summary:'FULL'|'PARTIAL'|'NONE'|'UNKNOWN'; preview?:{id:string;visitorType:string}; reverseConfigured:boolean }
