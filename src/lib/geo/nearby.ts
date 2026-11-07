import type { City, GeoSnapshot } from './types';

/** A city whose services are offered to a customer who is not in it: close enough to travel or deliver. */
export const NEARBY_KM = 150;
/** Farther than this from every covered city, a position is treated as outside the covered area. */
export const MAX_MATCH_KM = 250;

type Point = { latitude?: number | null; longitude?: number | null };
const hasPoint = (c: Point): c is { latitude: number; longitude: number } => typeof c.latitude === 'number' && typeof c.longitude === 'number';

/** Great-circle distance in kilometres (haversine). */
export function distanceKm(aLat: number, aLon: number, bLat: number, bLon: number) {
  const rad = (d: number) => d * Math.PI / 180, dLat = rad(bLat - aLat), dLon = rad(bLon - aLon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLon / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** The covered city nearest to a position, or null when none has coordinates or all are farther than `maxKm`. */
export function nearestCity(snapshot: Pick<GeoSnapshot, 'cities'>, latitude: number, longitude: number, maxKm = MAX_MATCH_KM): { city: City; km: number } | null {
  let best: { city: City; km: number } | null = null;
  for (const city of snapshot.cities) {
    if (!city.isAvailable || !hasPoint(city)) continue;
    const km = distanceKm(latitude, longitude, city.latitude, city.longitude);
    if (!best || km < best.km) best = { city, km };
  }
  return best && best.km <= maxKm ? best : null;
}

/** Cities within `km` of the given city (not including it), nearest first. */
export function nearbyCities(snapshot: Pick<GeoSnapshot, 'cities'>, cityId: string | null | undefined, km = NEARBY_KM): { id: string; km: number }[] {
  const origin = snapshot.cities.find(c => c.id === cityId);
  if (!origin || !hasPoint(origin)) return [];
  return snapshot.cities
    .filter(c => c.id !== origin.id && c.isAvailable && hasPoint(c))
    .map(c => ({ id: c.id, km: distanceKm(origin.latitude!, origin.longitude!, c.latitude!, c.longitude!) }))
    .filter(c => c.km <= km)
    .sort((a, b) => a.km - b.km);
}

/** Inside the rough bounding box of Saudi Arabia (used only to label a position outside every covered city). */
export const insideSaudiArabia = (latitude: number, longitude: number) => latitude >= 16 && latitude <= 32.5 && longitude >= 34.5 && longitude <= 55.7;
