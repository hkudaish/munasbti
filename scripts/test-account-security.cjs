// Account security: e-mail verification, password reset, known-device lockout bypass and CAPTCHA gating.
// Isolated integration test: a temporary PostgreSQL schema, a separate Next server, and a file "outbox" instead of SMTP.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, scryptSync } = require('node:crypto'); const { PrismaClient } = require('@prisma/client');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
const schema = 'account_security_test_' + randomBytes(8).toString('hex');
const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
const dist = '.next-account-test-' + process.pid, testTsconfig = '.account-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(testTsconfig, fs.readFileSync('tsconfig.json'));
const outbox = fs.mkdtempSync(path.join(os.tmpdir(), 'outbox-'));
const PORT = 3103, base = 'http://localhost:' + PORT;
const baseEnv = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: testTsconfig, NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: base, MAIL_OUTBOX_DIR: outbox, SESSION_SECRET: randomBytes(32).toString('hex') };
const prisma = new PrismaClient({ datasourceUrl: url.toString() }); let server, logs = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function start(extra = {}) {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env: { ...baseEnv, ...extra }, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', d => { logs += d; }); server.stderr.on('data', d => { logs += d; });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) { try { if ((await fetch(base + '/api/features')).ok) return; } catch { } await sleep(500); }
  throw new Error('server did not start: ' + logs.slice(-2000));
}
async function stop() { if (!server) return; server.kill(); if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']); server = null; await sleep(1000); }
// every call comes from its own "address" (single X-Forwarded-For entry, as the app trusts one proxy hop)
let n = 0;
async function call(route, method = 'GET', data, cookie, ip) {
  const r = await fetch(base + route, { method, headers: { origin: base, 'x-forwarded-for': ip || `198.51.100.${(++n % 250) + 1}`, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : []; const value = await r.json().catch(() => ({}));
  return { status: r.status, data: value, cookie: raw.map(c => c.split(';')[0]).join('; ') };
}
const mails = () => fs.readdirSync(outbox).sort().map(f => JSON.parse(fs.readFileSync(path.join(outbox, f), 'utf8')));
const tokenOf = mail => new URL(mail.text.match(/https?:\/\/\S+/)[0]).searchParams.get('token');
const PASSWORD = 'First-Password-2026!', NEW_PASSWORD = 'Second-Password-2027!';

(async () => {
  assert.equal(spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: baseEnv, encoding: 'utf8' }).status, 0, 'schema push');
  await prisma.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض' } });
  await start();

  // ---- registration sends a verification link; the link works once ----
  const reg = await call('/api/auth/register', 'POST', { userType: 'client', customerData: { name: 'سارة', phone: '0555000111', email: 'sara@example.test', password: PASSWORD, cityId: 'riyadh' } });
  assert.equal(reg.status, 200, JSON.stringify(reg.data)); assert.equal(reg.data.user.emailVerified, false);
  for (let i = 0; i < 40 && !mails().length; i++) await sleep(250);
  const verifyMail = mails().find(m => /verify-email/.test(m.text)); assert(verifyMail, 'a verification e-mail is sent after registering with an address');
  assert(verifyMail.text.startsWith('مرحباً') && verifyMail.text.includes(base + '/verify-email?token='), 'the link uses the configured public address');
  const vt = tokenOf(verifyMail);
  assert.equal((await call('/api/auth/verify-email', 'POST', { token: 'x'.repeat(43) })).status, 400, 'unknown token refused');
  assert.equal((await call('/api/auth/verify-email', 'POST', { token: vt })).status, 200, 'token confirms the address');
  assert.equal((await call('/api/auth/verify-email', 'POST', { token: vt })).status, 400, 'a verification token works once');
  assert((await prisma.user.findUnique({ where: { phone: '0555000111' } })).emailVerifiedAt, 'verified timestamp stored');
  assert.equal((await prisma.accountToken.findFirst({ where: { tokenHash: vt } })), null, 'only a hash is stored, never the token');

  // ---- forgot password: same answer for known and unknown accounts, mail only for the real one ----
  const before = mails().length;
  const known = await call('/api/auth/forgot-password', 'POST', { identifier: 'sara@example.test' });
  const unknown = await call('/api/auth/forgot-password', 'POST', { identifier: 'nobody@example.test' });
  const byPhone = await call('/api/auth/forgot-password', 'POST', { identifier: '0555000111' });
  assert.equal(known.status, 200); assert.deepEqual(unknown.data, known.data); assert.equal(unknown.status, known.status, 'no account enumeration');
  assert.equal(byPhone.status, 200);
  for (let i = 0; i < 40 && mails().length < before + 2; i++) await sleep(250);
  const resets = mails().slice(before).filter(m => /reset-password/.test(m.text)); assert.equal(resets.length, 2, 'only the real account gets mail (phone and e-mail lookups)');
  assert.equal(mails().filter(m => m.to === 'nobody@example.test').length, 0);
  // per-account throttle: a fourth request in an hour is refused whatever the address
  const flood = []; for (let i = 0; i < 3; i++) flood.push((await call('/api/auth/forgot-password', 'POST', { identifier: 'sara@example.test' })).status);
  assert(flood.includes(429), 'repeat requests for one account are throttled: ' + flood);

  // ---- reset: the newest link wins, policy first, one use, all sessions end, old password dies ----
  const oldLogin = await call('/api/auth/login', 'POST', { identifier: '0555000111', password: PASSWORD }); assert.equal(oldLogin.status, 200);
  const sessionCookie = oldLogin.cookie.split('; ').find(c => c.startsWith('munasabati_session'));
  assert.equal((await call('/api/auth/session', 'GET', undefined, sessionCookie)).data.user?.phone, '0555000111');
  for (let i = 0; i < 40 && mails().filter(m => /reset-password/.test(m.text)).length < 4; i++) await sleep(250);   // the throttled requests above also sent links
  const allResets = mails().filter(m => /reset-password/.test(m.text));
  const newest = tokenOf(allResets[allResets.length - 1]), older = tokenOf(allResets[0]);
  assert.equal((await call('/api/auth/reset-password', 'POST', { token: older, password: NEW_PASSWORD })).status, 400, 'an earlier link stops working when a newer one is issued');
  assert.equal((await call('/api/auth/reset-password', 'POST', { token: newest, password: 'short' })).status, 400, 'weak password refused');
  assert.equal((await call('/api/auth/reset-password', 'POST', { token: newest, password: NEW_PASSWORD })).status, 200, 'a refused password did not spend the link');
  assert.equal((await call('/api/auth/reset-password', 'POST', { token: newest, password: 'Third-Password-2028!' })).status, 400, 'a link works once');
  assert.equal((await call('/api/auth/session', 'GET', undefined, sessionCookie)).data.user, null, 'every session is signed out');
  assert.equal((await call('/api/auth/login', 'POST', { identifier: '0555000111', password: PASSWORD })).status, 401, 'the old password no longer works');
  assert.equal((await call('/api/auth/login', 'POST', { identifier: '0555000111', password: NEW_PASSWORD })).status, 200, 'the new one does');

  // ---- expired link ----
  await prisma.authAttempt.deleteMany({});   // fresh throttle counters for the next phase
  const hadBefore = mails().length;
  await call('/api/auth/forgot-password', 'POST', { identifier: 'sara@example.test' }, undefined, '203.0.113.77');
  for (let i = 0; i < 40 && mails().length <= hadBefore; i++) await sleep(250);
  const last = mails().filter(m => /reset-password/.test(m.text)).pop();
  await prisma.accountToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await call('/api/auth/reset-password', 'POST', { token: tokenOf(last), password: PASSWORD })).status, 400, 'expired link refused');
  await prisma.authAttempt.deleteMany({});
  const hadUnlock = mails().length;
  await call('/api/auth/forgot-password', 'POST', { identifier: 'sara@example.test' }, undefined, '203.0.113.78');
  for (let i = 0; i < 40 && mails().length <= hadUnlock; i++) await sleep(250);
  const unlock = mails().pop();

  // ---- guessing cannot lock the real owner out of a device they already use ----
  const owner = await call('/api/auth/login', 'POST', { identifier: '0555000111', password: NEW_PASSWORD }, undefined, '192.0.2.1');
  assert(owner.cookie.includes('munasabati_device='), 'a signed device cookie is set on sign-in');
  const device = owner.cookie.split('; ').find(c => c.startsWith('munasabati_device='));
  for (let i = 0; i < 22; i++) await call('/api/auth/login', 'POST', { identifier: '0555000111', password: 'wrong-guess-' + i }, undefined, `192.0.2.${10 + i}`);
  const stranger = await call('/api/auth/login', 'POST', { identifier: '0555000111', password: NEW_PASSWORD }, undefined, '192.0.2.200');
  assert.equal(stranger.status, 429, 'the account is locked for devices that have not signed in before');
  const forged = await call('/api/auth/login', 'POST', { identifier: '0555000111', password: NEW_PASSWORD }, 'munasabati_device=' + device.split('=')[1].replace(/.$/, c => (c === 'A' ? 'B' : 'A')), '192.0.2.201');
  assert.equal(forged.status, 429, 'a forged device cookie does not help');
  const wrongOnDevice = await call('/api/auth/login', 'POST', { identifier: '0555000111', password: 'nope-nope-nope' }, device, '192.0.2.202');
  assert.equal(wrongOnDevice.status, 401, 'the known device still needs the right password');
  const back = await call('/api/auth/login', 'POST', { identifier: '0555000111', password: NEW_PASSWORD }, device, '192.0.2.203');
  assert.equal(back.status, 200, 'the owner on a known device gets in during the lock: ' + JSON.stringify(back.data));
  // a reset (proof of the mailbox) lifts the lock for everyone; its link was requested before the lock began
  assert.equal((await call('/api/auth/reset-password', 'POST', { token: tokenOf(unlock), password: PASSWORD })).status, 200);
  assert.equal((await call('/api/auth/login', 'POST', { identifier: '0555000111', password: PASSWORD }, undefined, '192.0.2.210')).status, 200, 'reset lifts the account lock');

  // ---- CAPTCHA (Turnstile) is demanded only where abuse is likely; checks run before any network call ----
  await stop(); await start({ TURNSTILE_SECRET_KEY: '1x0000000000000000000000000000000AA' });
  const noToken = await call('/api/auth/register', 'POST', { userType: 'client', customerData: { name: 'بوت', phone: '0555000222', password: PASSWORD, cityId: 'riyadh' } });
  assert.equal(noToken.status, 400); assert.equal(noToken.data.captchaRequired, true, 'registration without a challenge token is refused');
  assert.equal((await call('/api/auth/forgot-password', 'POST', { identifier: 'sara@example.test' })).data.captchaRequired, true, 'so is a reset request');
  assert.equal(await prisma.user.count({ where: { phone: '0555000222' } }), 0, 'no account was created');
  assert.equal((await call('/api/auth/login', 'POST', { identifier: '0555000111', password: PASSWORD }, undefined, '192.0.2.220')).status, 200, 'a normal sign-in carries no challenge');
  const ip = '192.0.2.230'; const codes = [];
  for (let i = 0; i < 5; i++) { const r = await call('/api/auth/login', 'POST', { identifier: 'sara@example.test', password: 'wrong-one-' + i }, undefined, ip); codes.push([r.status, r.data.captchaRequired === true]); }
  assert.deepEqual(codes.slice(0, 2).map(c => c[0]), [401, 401]);
  assert(codes.slice(2).every(c => c[1]), 'after three wrong passwords the form must carry a challenge: ' + JSON.stringify(codes));
  console.log('PASS account security: e-mail verification, single-use expiring reset links, no enumeration, sessions revoked, known-device lock bypass, reset lifts the lock, CAPTCHA only after repeated failures.');
})().catch(e => { console.error(e); console.error(logs.slice(-1500)); process.exitCode = 1; }).finally(async () => {
  await stop();
  try { await prisma.$disconnect(); const admin = new PrismaClient(); await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.$disconnect(); } catch { }
  fs.rmSync(dist, { recursive: true, force: true }); fs.rmSync(testTsconfig, { force: true }); fs.rmSync(outbox, { recursive: true, force: true });
});
