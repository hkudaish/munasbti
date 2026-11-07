-- City centres: let the server match a visitor's position to the nearest covered city and offer services in nearby cities.
ALTER TABLE "SaudiCity" ADD COLUMN IF NOT EXISTS "latitude" DOUBLE PRECISION;
ALTER TABLE "SaudiCity" ADD COLUMN IF NOT EXISTS "longitude" DOUBLE PRECISION;

UPDATE "SaudiCity" c SET "latitude" = v.lat, "longitude" = v.lon
FROM (VALUES
  ('riyadh', 24.7136, 46.6753),
  ('jeddah', 21.5433, 39.1728),
  ('dammam', 26.4207, 50.0888),
  ('makkah', 21.3891, 39.8579),
  ('madinah', 24.5247, 39.5692),
  ('taif', 21.2703, 40.4158),
  ('qassim', 26.3260, 43.9750),
  ('abha', 18.2164, 42.5053)
) AS v(id, lat, lon)
WHERE c."id" = v.id AND c."latitude" IS NULL;

-- Automatic location is now resolved on our own server (no map provider, coordinates are never stored), so switch it on.
UPDATE "GeoPolicy" SET "reverseEnabled" = true, "version" = "version" + 1, "updatedAt" = now() WHERE "id" = 'default' AND "reverseEnabled" = false;
UPDATE "GeoRevision" SET "version" = "version" + 1 WHERE "id" = 'default';
