const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { quoteInvitations, sanitizePricing, DEFAULT_PRICING } = require('../src/lib/invitations/pricing.ts');
const INVITATION_PLANS = DEFAULT_PRICING.plans, MIN_INVITATIONS = DEFAULT_PRICING.minInvitations, MAX_INVITATIONS = DEFAULT_PRICING.maxInvitations, MAX_COMPANIONS = DEFAULT_PRICING.maxCompanions;

// the free plan costs nothing whatever the numbers
assert.equal(quoteInvitations('free', 150, 3).total, 0);
// WhatsApp only: per-invitation price, no check-in fee, companions are not priced (no entry code)
const w = quoteInvitations('whatsapp', 150, 5); assert.equal(w.total, 90); assert.equal(w.companionTotal, 0); assert.equal(w.checkInFee, 0);
// WhatsApp + QR: 150 x 1 + 60 fee + companions 150 x 2 x 0.4
const q = quoteInvitations('whatsapp_qr', 150, 2); assert.equal(q.baseTotal, 150); assert.equal(q.companionTotal, 120); assert.equal(q.total, 330); assert.equal(q.maxAttendees, 450);
// limits are enforced: below the minimum, above the maximum, garbage input
assert.equal(quoteInvitations('whatsapp', 1, 0).invitations, MIN_INVITATIONS);
assert.equal(quoteInvitations('whatsapp', 99999, 99).invitations, MAX_INVITATIONS);
assert.equal(quoteInvitations('whatsapp_qr', 100, 99).companions, MAX_COMPANIONS);
assert.equal(quoteInvitations('whatsapp', NaN, -4).invitations, MIN_INVITATIONS);
assert.equal(quoteInvitations('whatsapp_qr', 100, -4).companions, 0);
// an unknown plan falls back to the free one instead of throwing
assert.equal(quoteInvitations('nope', 100, 0).plan.id, 'free');
// totals have at most two decimals and exactly one plan is recommended
for (const p of INVITATION_PLANS) { const t = quoteInvitations(p.id, 137, 3).total; assert.equal(t, Math.round(t * 100) / 100); }
assert.equal(INVITATION_PLANS.filter(p => p.recommended).length, 1);
// custom prices from the admin change the quote
const custom = sanitizePricing({ ...DEFAULT_PRICING, companionPrice: 1, plans: DEFAULT_PRICING.plans.map(p => p.id === 'whatsapp' ? { ...p, perInvitation: 2 } : p) });
assert.equal(quoteInvitations('whatsapp', 100, 0, custom).total, 200);
assert.equal(quoteInvitations('whatsapp_qr', 100, 2, custom).companionTotal, 200);
// saved prices round-trip unchanged and are cleaned (rounding, trimmed names)
assert.deepEqual(sanitizePricing(JSON.parse(JSON.stringify(DEFAULT_PRICING))), DEFAULT_PRICING);
assert.equal(sanitizePricing({ ...DEFAULT_PRICING, companionPrice: 0.456 }).companionPrice, 0.46);
// bad admin input is refused with an Arabic message, never stored
const bad = (patch, why) => assert.throws(() => sanitizePricing({ ...DEFAULT_PRICING, ...patch }), why);
bad({ minInvitations: 500, maxInvitations: 100 }, /الأدنى/);
bad({ companionPrice: -1 }, /سعر المرافق/);
bad({ maxCompanions: 1.5 }, /للمرافقين/);
bad({ plans: DEFAULT_PRICING.plans.slice(1) }, /جميع الباقات/);
bad({ plans: DEFAULT_PRICING.plans.map(p => ({ ...p, nameAr: ' ' })) }, /اسم الباقة/);
bad({ plans: DEFAULT_PRICING.plans.map(p => ({ ...p, perInvitation: 'free' })) }, /سعر غير صالح/);
bad({ plans: DEFAULT_PRICING.plans.map(p => ({ ...p, recommended: true })) }, /باقة واحدة/);
assert.throws(() => sanitizePricing(null), /غير صالحة/);
// a plan cannot be made to carry a QR code or change id from the admin screen
const forced = sanitizePricing({ ...DEFAULT_PRICING, plans: DEFAULT_PRICING.plans.map(p => ({ ...p, qr: !p.qr })) });
assert.deepEqual(forced.plans.map(p => p.qr), DEFAULT_PRICING.plans.map(p => p.qr));
console.log('PASS: invitation price quote per plan, companion pricing only with a QR plan, limits and bad input handled, admin-edited prices validated and applied.');
