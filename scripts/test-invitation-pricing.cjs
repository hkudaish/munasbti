const assert = require('node:assert/strict'), fs = require('node:fs'), ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText, filename);
const { quoteInvitations, INVITATION_PLANS, MIN_INVITATIONS, MAX_INVITATIONS, MAX_COMPANIONS } = require('../src/lib/invitations/pricing.ts');

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
console.log('PASS: invitation price quote per plan, companion pricing only with a QR plan, limits and bad input handled.');
