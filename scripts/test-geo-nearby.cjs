const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { distanceKm, nearestCity, nearbyCities, insideSaudiArabia, NEARBY_KM } = require('../src/lib/geo/nearby.ts');

const city = (id, latitude, longitude, isAvailable = true) => ({ id, nameAr: id, nameEn: id, regionAr: '', countryCode: 'SA', aliases: [], isAvailable, defaultAvailable: true, version: 1, latitude, longitude });
const s = { cities: [city('riyadh', 24.7136, 46.6753), city('jeddah', 21.5433, 39.1728), city('makkah', 21.3891, 39.8579), city('taif', 21.2703, 40.4158), city('madinah', 24.5247, 39.5692), city('dammam', 26.4207, 50.0888), city('nocoords', null, null), city('off', 21.4, 39.8, false)] };

// distances are sensible (Riyadh to Jeddah is about 850 km by air)
const rj = distanceKm(24.7136, 46.6753, 21.5433, 39.1728); assert(rj > 800 && rj < 900, 'Riyadh-Jeddah ' + rj);
assert.equal(Math.round(distanceKm(24.7, 46.7, 24.7, 46.7)), 0);

// a position resolves to the nearest covered city, never to a closed one or one without coordinates
assert.equal(nearestCity(s, 24.75, 46.7).city.id, 'riyadh');
assert.equal(nearestCity(s, 21.45, 39.82).city.id, 'makkah', 'closed city "off" sits closer but is not covered');
assert.equal(nearestCity(s, 21.5, 39.2).city.id, 'jeddah');
// far from every city: no match (central desert, about 600 km from the nearest covered city)
assert.equal(nearestCity(s, 20.0, 49.0), null);
assert.equal(nearestCity({ cities: [city('x', null, null)] }, 24, 46), null);

// nearby cities: Makkah has Jeddah and Taif within range, not Riyadh or Madinah
const near = nearbyCities(s, 'makkah');
assert.deepEqual(near.map(n => n.id), ['taif', 'jeddah']);
assert(near.every(n => n.km <= NEARBY_KM) && near[0].km <= near[1].km, 'sorted nearest first');
assert.deepEqual(nearbyCities(s, 'riyadh'), [], 'nothing near Riyadh within range');
assert.deepEqual(nearbyCities(s, 'nocoords'), []);
assert.deepEqual(nearbyCities(s, 'unknown'), []);
assert.deepEqual(nearbyCities(s, null), []);
assert.deepEqual(nearbyCities(s, 'makkah', 5), [], 'a small radius leaves nothing');

assert(insideSaudiArabia(24.7, 46.7)); assert(!insideSaudiArabia(30.0, 31.2) && !insideSaudiArabia(48.8, 2.3));
console.log('PASS: haversine distance, nearest covered city, closed and coordinate-less cities ignored, out-of-area positions, nearby cities sorted within range.');
