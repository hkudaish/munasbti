// Roles, permissions and the new sign-in methods: sign-up and sign-in by code (SMS / e-mail), Google sign-in against a stand-in token server,
// account linking without duplicates, approval of pending accounts, privilege-escalation guards, session management and the security log.
// Isolated integration test: a temporary PostgreSQL schema, a separate Next server, and file "outboxes" instead of SMS / SMTP providers.
const assert = require('node:assert/strict');
const fs = require('node:fs'); const os = require('node:os'); const path = require('node:path'); const http = require('node:http'); const { spawn, spawnSync } = require('node:child_process');
const { randomBytes, scryptSync, generateKeyPairSync, createVerify } = require('node:crypto'); const { PrismaClient } = require('@prisma/client'); const { Client } = require('pg'); const ts = require('typescript');
for (const line of fs.readFileSync('.env', 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }

// ---- load TypeScript helpers without a build (the same approach the i18n test uses) ----
const cache = {};
function load(file) {
  if (cache[file]) return cache[file].exports;
  const js = ts.transpileModule(fs.readFileSync(file, 'utf8'), { compilerOptions: { module: 'commonjs', target: 'es2020' } }).outputText;
  const m = { exports: {} }; cache[file] = m;
  new Function('module', 'exports', 'require', js)(m, m.exports, spec => { const base = spec.startsWith('.') ? path.resolve(path.dirname(file), spec) : null; if (!base) return require(spec); for (const c of [base + '.ts', path.join(base, 'index.ts')]) if (fs.existsSync(c)) return load(c); throw new Error('cannot resolve ' + spec); });
  return m.exports;
}
const { DEFAULT_ROLES, PERMISSIONS } = load('src/lib/system/permissions.ts');
const { checkClaims, appleClientSecret } = load('src/lib/server/oauth-claims.ts');

const schema = 'rbac_test_' + randomBytes(8).toString('hex');
const url = new URL(process.env.DATABASE_URL); url.searchParams.set('schema', schema);
const dist = '.next-rbac-test-' + process.pid, testTsconfig = '.rbac-test-tsconfig-' + process.pid + '.json';
fs.writeFileSync(testTsconfig, fs.readFileSync('tsconfig.json'));
const mailbox = fs.mkdtempSync(path.join(os.tmpdir(), 'mail-')), smsbox = fs.mkdtempSync(path.join(os.tmpdir(), 'sms-'));
const PORT = 3104, TOKEN_PORT = 3105, base = 'http://localhost:' + PORT;
const GOOGLE_ID = 'test-client.apps.googleusercontent.com';
const baseEnv = { ...process.env, DATABASE_URL: url.toString(), NEXT_TEST_DIST_DIR: dist, NEXT_TEST_TSCONFIG: testTsconfig, NODE_ENV: 'development', NEXT_PUBLIC_APP_URL: base, MAIL_OUTBOX_DIR: mailbox, OTP_OUTBOX_DIR: smsbox, OTP_RESEND_SECONDS: '1', SESSION_SECRET: randomBytes(32).toString('hex'),
  GOOGLE_CLIENT_ID: GOOGLE_ID, GOOGLE_CLIENT_SECRET: 'secret', GOOGLE_TOKEN_URL: `http://127.0.0.1:${TOKEN_PORT}/token` };
const prisma = new PrismaClient({ datasourceUrl: url.toString() }); let server, tokenServer, logs = '';
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function start() {
  server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'dev', '--hostname', '127.0.0.1', '--port', String(PORT)], { env: baseEnv, stdio: ['ignore', 'pipe', 'pipe'] });
  server.stdout.on('data', d => { logs += d; }); server.stderr.on('data', d => { logs += d; });
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) { try { if ((await fetch(base + '/api/features')).ok) return; } catch { } await sleep(500); }
  throw new Error('server did not start: ' + logs.slice(-2000));
}
async function stop() { if (server) { server.kill(); if (process.platform === 'win32') spawnSync('taskkill', ['/pid', String(server.pid), '/T', '/F']); server = null; await sleep(1000); } if (tokenServer) tokenServer.close(); }
let n = 0;
async function call(route, method = 'GET', data, cookie, ip) {
  const r = await fetch(base + route, { method, redirect: 'manual', headers: { origin: base, 'x-forwarded-for': ip || `198.51.100.${(++n % 250) + 1}`, ...(data === undefined ? {} : { 'Content-Type': 'application/json' }), ...(cookie ? { Cookie: cookie } : {}) }, body: data === undefined ? undefined : JSON.stringify(data) });
  const raw = r.headers.getSetCookie ? r.headers.getSetCookie() : []; const value = await r.json().catch(() => ({}));
  return { status: r.status, data: value, location: r.headers.get('location'), cookie: raw.map(c => c.split(';')[0]).join('; ') };
}
const hash = pw => { const salt = randomBytes(16).toString('hex'); return `scrypt:${salt}:${scryptSync(pw, salt, 64).toString('hex')}`; };
const box = dir => fs.readdirSync(dir).sort().map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')));
const lastCode = async (to, dir = smsbox) => { for (let i = 0; i < 40; i++) { const m = box(dir).filter(x => x.to === to).pop(); if (m) return m.code; await sleep(150); } throw new Error('no message for ' + to); };
// a new code is only issued after the (shortened) resend delay
const send = async (channel, target, ip) => { await sleep(1100); return call('/api/auth/otp/request', 'POST', { channel, target }, undefined, ip); };
const PASSWORD = 'Correct-Horse-Battery-2026!';
const e164 = t => t.startsWith('+') ? t : '+966' + t.replace(/^0/, '');   // the outbox records the normalised number
const fresh = async (channel, target) => { assert.equal((await send(channel, target)).status, 200); return channel === 'email' ? mailCode(target.toLowerCase()) : lastCode(e164(target)); };
// the e-mail provider writes the whole message; pull the code from the text
const mailCode = async to => { for (let i = 0; i < 40; i++) { const m = box(mailbox).filter(x => x.to === to).pop(); if (m) return m.text.match(/\d{6}/)[0]; await sleep(150); } throw new Error('no mail for ' + to); };

(async () => {
  // ---- pure checks: ID token claims and Apple client secret ----
  const good = { iss: 'https://accounts.google.com', aud: GOOGLE_ID, sub: '1234', exp: Math.floor(Date.now() / 1000) + 600, nonce: 'n1', email: 'A@Example.com', email_verified: true };
  assert.equal(checkClaims('google', good, 'n1', GOOGLE_ID).providerUserId, '1234'); assert.equal(checkClaims('google', good, 'n1', GOOGLE_ID).email, 'a@example.com');
  for (const [label, claims] of [['issuer', { ...good, iss: 'https://evil.test' }], ['audience', { ...good, aud: 'other' }], ['expired', { ...good, exp: 1 }], ['nonce', { ...good, nonce: 'n2' }], ['sub', { ...good, sub: '' }]]) assert.equal(checkClaims('google', claims, 'n1', GOOGLE_ID), null, 'rejects wrong ' + label);
  assert.equal(checkClaims('google', { ...good, email_verified: false }, 'n1', GOOGLE_ID).emailVerified, false, 'an unverified e-mail is not trusted');
  assert.equal(checkClaims('apple', { ...good, iss: 'https://appleid.apple.com', email_verified: 'true' }, 'n1', GOOGLE_ID).emailVerified, true, 'Apple sends "true" as a string');
  const { privateKey, publicKey } = generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
  const secret = appleClientSecret({ teamId: 'TEAM123456', keyId: 'KEY1234567', clientId: 'com.example.web', privateKey: privateKey.export({ type: 'pkcs8', format: 'pem' }) });
  const [h, b, sig] = secret.split('.'); assert.equal(JSON.parse(Buffer.from(h, 'base64url')).alg, 'ES256'); assert.equal(JSON.parse(Buffer.from(b, 'base64url')).aud, 'https://appleid.apple.com');
  assert(createVerify('sha256').update(`${h}.${b}`).verify({ key: publicKey, dsaEncoding: 'ieee-p1363' }, Buffer.from(sig, 'base64url')), 'Apple client secret carries a valid ES256 signature');

  assert.equal(spawnSync(process.execPath, ['node_modules/prisma/build/index.js', 'db', 'push', '--skip-generate'], { env: baseEnv, encoding: 'utf8' }).status, 0, 'schema push');
  // The migration file seeds the default roles; apply it on top of the pushed schema, exactly as scripts/migrate.cjs would on a real database.
  const pg = new Client({ connectionString: process.env.DATABASE_URL }); await pg.connect(); await pg.query(`SET search_path TO "${schema}"`);
  await pg.query(fs.readFileSync('netlify/database/migrations/202611080001_rbac_login_identities.sql', 'utf8')); await pg.end();
  // The TypeScript copy of the defaults and the SQL seed must agree.
  const dbRoles = await prisma.role.findMany({ include: { permissions: { select: { permission: { select: { code: true } } } } } });
  assert.equal(dbRoles.length, DEFAULT_ROLES.length, 'same number of default roles');
  for (const r of DEFAULT_ROLES) {
    const row = dbRoles.find(x => x.key === r.key); assert(row, 'role ' + r.key + ' seeded');
    assert.equal(row.legacyRole, r.legacyRole, r.key + ' legacy role'); assert.equal(row.selfRegistration, r.selfRegistration, r.key + ' self registration'); assert.equal(row.requiresApproval, r.requiresApproval, r.key + ' approval'); assert.equal(row.isSystem, r.isSystem, r.key + ' system flag');
    const want = (r.permissions === 'all' ? PERMISSIONS.map(p => p.code) : r.permissions).sort(); assert.deepEqual(row.permissions.map(p => p.permission.code).sort(), want, r.key + ' permissions match the TypeScript defaults');
  }
  assert.equal(await prisma.permission.count(), PERMISSIONS.length, 'permission catalogue matches the migration');
  await prisma.saudiCity.create({ data: { id: 'riyadh', nameAr: 'الرياض', nameEn: 'Riyadh', regionAr: 'الرياض' } });
  const sysadmin = await prisma.user.create({ data: { name: 'مدير', phone: '0500000001', email: 'root@example.test', passwordHash: hash(PASSWORD), role: 'SUPER_ADMIN', emailVerifiedAt: new Date() } });   // no role rows: the fallback applies
  const ops = await prisma.user.create({ data: { name: 'إداري', phone: '0500000002', passwordHash: hash(PASSWORD), role: 'ADMIN' } });
  await prisma.userRoleAssignment.create({ data: { userId: ops.id, roleId: 'role_admin' } });
  await start();
  const admin = (await call('/api/auth/login', 'POST', { identifier: '0500000001', password: PASSWORD })).cookie; assert(admin.includes('munasabati_session'));
  const opsCookie = (await call('/api/auth/login', 'POST', { identifier: '0500000002', password: PASSWORD })).cookie;

  // ---- defaults: only the password form; the three self-registration roles ----
  let methods = (await call('/api/auth/methods')).data;
  assert.equal(methods.methods.password, true); assert.deepEqual(methods.methods.channels, []); assert.equal(methods.methods.google, false);
  assert.deepEqual(methods.roles.map(r => r.key).sort(), ['client', 'coordinator', 'marketer'], 'administrators, supervisors and vendors are not offered at sign-up');
  assert.equal((await call('/api/auth/otp/request', 'POST', { channel: 'sms', target: '0555000001' })).status, 400, 'a channel nobody switched on is refused');

  // ---- the settings screen: guarded, validated, never leaves nobody able to sign in ----
  assert.equal((await call('/api/access')).status, 401); assert.equal((await call('/api/access', 'GET', undefined, opsCookie)).status, 200, 'an administrator may view');
  const settings = { passwordLogin: true, googleLogin: true, appleLogin: false, smsOtp: true, whatsappOtp: false, emailOtp: true, defaultChannel: 'sms', providers: { sms: 'dev', whatsapp: 'meta', email: 'smtp' } };
  assert.equal((await call('/api/access', 'POST', { action: 'saveSettings', settings }, opsCookie)).status, 403, 'administrators cannot change sign-in settings');
  assert.equal((await call('/api/access', 'POST', { action: 'saveSettings', settings: { ...settings, passwordLogin: false, googleLogin: false, smsOtp: false, emailOtp: false } }, admin)).status, 409, 'at least one usable method must stay on');
  assert.equal((await call('/api/access', 'POST', { action: 'saveSettings', settings: { ...settings, providers: { ...settings.providers, sms: 'nope' } } }, admin)).status, 400, 'unknown provider');
  assert.equal((await call('/api/access', 'POST', { action: 'saveSettings', settings }, admin)).status, 200);
  methods = (await call('/api/auth/methods')).data.methods; assert.deepEqual(methods.channels.sort(), ['email', 'sms']); assert.equal(methods.google, true);

  // ---- sign-up by SMS code: unified flow, hashed code, no enumeration, throttles ----
  const phone = '+966555000001';
  assert.equal((await call('/api/auth/otp/request', 'POST', { channel: 'sms', target: 'abc' })).status, 400);
  const first = await call('/api/auth/otp/request', 'POST', { channel: 'sms', target: '0555000001' }); assert.equal(first.status, 200); assert.deepEqual(Object.keys(first.data).sort(), ['expiresInMinutes', 'resendAfter', 'sent', 'success']);
  assert.equal((await call('/api/auth/otp/request', 'POST', { channel: 'sms', target: '0555000001' })).status, 429, 'resend inside the delay is refused');
  let code = await lastCode(phone);
  const stored = await prisma.verificationCode.findFirst({ where: { target: phone } }); assert.match(stored.codeHash, /^[0-9a-f]{64}$/); assert(!stored.codeHash.includes(code) && stored.codeHash !== code, 'the code is stored only as a keyed hash');
  const wrong = code === '000000' ? '111111' : '000000';
  assert.equal((await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code: wrong })).status, 400);
  const prof = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code }); assert.equal(prof.data.needsProfile, true, 'unknown number: ask for a name first'); assert(!prof.cookie.includes('munasabati_session'));
  assert.deepEqual(prof.data.roles.map(r => r.key).sort(), ['client', 'coordinator', 'marketer']);
  assert.equal((await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code, name: 'نورة', roleKey: 'supervisor' })).status, 403, 'a sensitive role cannot be chosen at sign-up');
  assert.equal((await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code, name: 'نورة', roleKey: 'vendor' })).status, 403, 'vendors register through the business form');
  const signUp = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code, name: 'نورة', roleKey: 'client' });
  assert.equal(signUp.status, 200, JSON.stringify(signUp.data)); assert.equal(signUp.data.created, true); assert(signUp.cookie.includes('munasabati_session'));
  assert.deepEqual(signUp.data.user.roleKeys, ['client']); assert(signUp.data.user.permissions.includes('orders.create') && !signUp.data.user.permissions.includes('users.edit'));
  const nora = await prisma.user.findFirst({ where: { phone } }); assert(nora.phoneVerifiedAt, 'the phone is recorded as verified'); assert.equal(nora.registeredVia, 'phone');
  assert.equal(await prisma.loginIdentity.count({ where: { userId: nora.id, provider: 'PHONE', providerUserId: phone } }), 1);
  assert.equal((await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code, name: 'نورة', roleKey: 'client' })).status, 400, 'a code works once');

  // ---- signing in again by code reaches the same account (no duplicate); a number typed another way is the same number ----
  code = await fresh('sms', '0555000001');
  const again = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '+966555000001', code }); assert.equal(again.status, 200); assert.equal(again.data.created, false); assert.equal(again.data.user.id, nora.id);
  assert.equal(await prisma.user.count({ where: { phone: { contains: '555000001' } } }), 1, 'still one account');

  // ---- code attempts: five wrong tries burn the code ----
  code = await fresh('sms', '0555000002'); const bad = code === '123456' ? '654321' : '123456'; let last;
  for (let i = 0; i < 5; i++) last = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000002', code: bad });
  assert.equal(last.status, 400); assert.equal((await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000002', code, name: 'ليلى', roleKey: 'client' })).status, 400, 'the right code no longer works after five wrong tries');

  // ---- e-mail code, and linking to an existing account by verified e-mail (never by name) ----
  const legacy = await call('/api/auth/register', 'POST', { userType: 'client', customerData: { name: 'سارة', phone: '0555000111', email: 'sara@example.test', password: PASSWORD, cityId: 'riyadh' } });
  assert.equal(legacy.status, 200); const legacySession = legacy.cookie; const sara = await prisma.user.findFirst({ where: { phone: '0555000111' } });
  assert.equal((await prisma.userRoleAssignment.findMany({ where: { userId: sara.id }, include: { role: true } })).map(a => a.role.key).join(), 'client', 'password sign-up grants the client role');
  assert.equal((await call('/api/auth/session', 'GET', undefined, legacySession)).data.user?.id, sara.id);
  await send('email', 'sara@example.test'); code = await mailCode('sara@example.test');
  const linked = await call('/api/auth/otp/verify', 'POST', { channel: 'email', target: 'Sara@Example.test', code }); assert.equal(linked.status, 200); assert.equal(linked.data.user.id, sara.id, 'proving the e-mail signs in to the account that has it');
  const saraNow = await prisma.user.findUnique({ where: { id: sara.id } });
  assert(saraNow.emailVerifiedAt, 'e-mail now verified'); assert.equal(saraNow.passwordHash, null, 'takeover guard: the unverified account lost its password when the real owner proved the address');
  assert.equal((await call('/api/auth/session', 'GET', undefined, legacySession)).data.user, null, 'and its earlier sessions ended');
  assert.equal(await prisma.user.count(), 4, 'no extra account was created (system admin, administrator, Noura, Sara)');
  const loneName = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000003', code: await fresh('sms', '0555000003'), name: 'سارة', roleKey: 'client' });
  assert.equal(loneName.status, 200); assert.notEqual(loneName.data.user.id, sara.id, 'the same name alone never merges accounts');

  // ---- Google sign-in against a stand-in token endpoint ----
  let nonceToServe = '', subToServe = 'g-1', emailToServe = 'noura.g@example.test', verifiedToServe = true;
  tokenServer = http.createServer((req, res) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const claims = { iss: 'https://accounts.google.com', aud: GOOGLE_ID, sub: subToServe, exp: Math.floor(Date.now() / 1000) + 300, nonce: nonceToServe, email: emailToServe, email_verified: verifiedToServe, name: 'ريم' }; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify({ id_token: ['e30', Buffer.from(JSON.stringify(claims)).toString('base64url'), 'sig'].join('.') })); }); }).listen(TOKEN_PORT);
  async function google(opts = {}) {
    const start = await call('/api/auth/oauth/google/start?role=client'); assert.equal(start.status, 303, 'start redirects'); const to = new URL(start.location);
    assert.equal(to.hostname, 'accounts.google.com'); assert.equal(to.searchParams.get('code_challenge_method'), 'S256'); assert.equal(to.searchParams.get('redirect_uri'), base + '/api/auth/oauth/google/callback');
    const state = to.searchParams.get('state'); nonceToServe = opts.badNonce ? 'wrong' : to.searchParams.get('nonce');
    return call(`/api/auth/oauth/google/callback?code=abc&state=${opts.badState ? 'x' + state : state}`, 'GET', undefined, opts.noBind ? undefined : start.cookie);
  }
  let g = await google(); assert.equal(g.status, 303); assert.match(g.location, /welcome=1/); assert(g.cookie.includes('munasabati_session'), 'Google sign-up starts a session');
  const reem = await prisma.user.findFirst({ where: { email: 'noura.g@example.test' } }); assert(reem.emailVerifiedAt); assert.equal(reem.registeredVia, 'google'); assert.equal(reem.phone, null, 'an account without a phone is allowed');
  g = await google(); assert.match(g.location, /signed_in=1/, 'second Google sign-in reaches the same account'); assert.equal(await prisma.user.count({ where: { email: 'noura.g@example.test' } }), 1);
  for (const [label, o] of [['state', { badState: true }], ['browser binding', { noBind: true }], ['nonce', { badNonce: true }]]) { g = await google(o); assert.match(g.location, /auth_error=/, 'rejects a wrong ' + label); assert(!g.cookie.includes('munasabati_session'), 'and starts no session'); }
  const before = await prisma.user.count();
  subToServe = 'g-2'; emailToServe = 'unverified@example.test'; verifiedToServe = false; g = await google(); assert.match(g.location, /welcome=1/, 'a Google account with an unverified e-mail may still sign up'); assert.equal((await prisma.user.findFirst({ where: { registeredVia: 'google', email: null } })) !== null, true, 'but the unverified e-mail is not stored or trusted');
  assert.equal(await prisma.user.count(), before + 1);
  subToServe = 'g-3'; emailToServe = 'sara@example.test'; verifiedToServe = true; g = await google(); assert.match(g.location, /signed_in=1/); assert.equal(await prisma.loginIdentity.count({ where: { userId: sara.id, provider: 'GOOGLE' } }), 1, 'Google identity linked to the existing account holding that verified e-mail');
  assert.equal(await prisma.user.count({ where: { email: { equals: 'sara@example.test', mode: 'insensitive' } } }), 1, 'no duplicate for Sara');
  subToServe = 'g-4'; emailToServe = 'victim@example.test'; verifiedToServe = false;
  const victim = await prisma.user.create({ data: { name: 'ضحية', phone: '0555999999', email: 'victim@example.test', passwordHash: hash(PASSWORD), emailVerifiedAt: new Date() } });
  g = await google(); assert.equal(await prisma.loginIdentity.count({ where: { userId: victim.id, provider: 'GOOGLE' } }), 0, 'an unverified Google e-mail never links to somebody else\'s account');
  assert.equal((await prisma.user.findUnique({ where: { id: victim.id } })).passwordHash !== null, true);

  // ---- approval: a role that needs it creates a pending account with no permissions ----
  code = await fresh('sms', '0555000010');
  const mk = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000010', code, name: 'مسوق جديد', roleKey: 'marketer' }); assert.equal(mk.status, 200);
  assert.equal(mk.data.user.approvalStatus, 'PENDING'); assert.deepEqual(mk.data.user.permissions, [], 'pending accounts hold no permissions'); const marketer = await prisma.user.findFirst({ where: { phone: '+966555000010' } });
  assert.equal((await call('/api/access', 'GET', undefined, mk.cookie)).status, 403);
  assert.equal((await call('/api/access', 'POST', { action: 'setUserStatus', userId: marketer.id, status: 'approve' }, mk.cookie)).status, 403);
  assert.equal((await call('/api/access', 'POST', { action: 'setUserStatus', userId: marketer.id, status: 'approve' }, opsCookie)).status, 403, 'the default administrator role does not hold users.approve');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserStatus', userId: marketer.id, status: 'approve' }, admin)).status, 200);
  const approved = (await call('/api/auth/session', 'GET', undefined, mk.cookie)).data.user; assert(approved.permissions.includes('leads.view') && !approved.permissions.includes('users.view'), 'approved marketer holds exactly the marketer permissions');

  // ---- roles are data: create one, grant it, the permissions apply with no code change ----
  const roleRes2 = await call('/api/access', 'POST', { action: 'roleCreate', key: 'trainer', nameAr: 'مدرب', nameEn: 'Trainer', permissions: ['reports.view', 'users.edit'], selfRegistration: true, requiresApproval: false }, admin);
  assert.equal(roleRes2.status, 409, 'self-registration without approval cannot carry a sensitive permission');
  const roleRes3 = await call('/api/access', 'POST', { action: 'roleCreate', key: 'trainer', nameAr: 'مدرب', nameEn: 'Trainer', permissions: ['reports.view', 'users.view'], selfRegistration: false }, admin); assert.equal(roleRes3.status, 200, JSON.stringify(roleRes3.data));
  assert.equal((await call('/api/access', 'POST', { action: 'roleCreate', key: 'bad key', nameAr: 'x', permissions: [] }, admin)).status, 400); assert.equal((await call('/api/access', 'POST', { action: 'roleCreate', key: 'ghost', nameAr: 'x', permissions: ['nope.nothing'] }, admin)).status, 400);
  assert.equal((await call('/api/access', 'POST', { action: 'roleCreate', key: 'x1x', nameAr: 'x', permissions: [] }, opsCookie)).status, 403, 'administrators cannot edit roles');
  const trainerId = roleRes3.data.id;
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: nora.id, roleKeys: ['client', 'trainer'] }, admin)).status, 200, 'the system administrator may assign any role');
  const noraSession = signUp.cookie; // her session ended when the roles changed
  assert.equal((await call('/api/auth/session', 'GET', undefined, noraSession)).data.user, null, 'a role change ends the person\'s sessions');
  const noraAgain = await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code: await fresh('sms', '0555000001') }); assert(noraAgain.data.user.permissions.includes('reports.view') && noraAgain.data.user.permissions.includes('orders.create'), 'permissions are the union of her roles');
  assert.equal((await call('/api/access', 'POST', { action: 'rolePermissions', id: 'role_system_admin', permissions: [] }, admin)).status, 403, 'the system administrator role cannot be stripped');
  assert.equal((await call('/api/access', 'POST', { action: 'roleDelete', id: trainerId }, admin)).status, 409, 'a role in use cannot be deleted');
  assert.equal((await call('/api/access', 'POST', { action: 'roleDelete', id: 'role_client' }, admin)).status, 409, 'core roles cannot be deleted');
  assert.equal((await call('/api/access', 'POST', { action: 'rolePermissions', id: trainerId, permissions: ['reports.view'] }, admin)).status, 200);
  assert.equal((await call('/api/auth/session', 'GET', undefined, noraAgain.cookie)).data.user.permissions.includes('users.view'), false, 'removing a permission from the role takes effect immediately');

  // ---- privilege escalation guards ----
  const staffTarget = loneName.data.user.id;
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: staffTarget, roleKeys: ['supervisor'] }, opsCookie)).status, 200, 'an administrator may manage staff roles');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: staffTarget, roleKeys: ['admin'] }, opsCookie)).status, 403, 'but cannot create administrators');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: staffTarget, roleKeys: ['system_admin'] }, opsCookie)).status, 403);
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: sysadmin.id, roleKeys: ['client'] }, opsCookie)).status, 403, 'nor touch the system administrator');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: ops.id, roleKeys: ['supervisor'] }, opsCookie)).status, 403, 'nor edit themselves');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: sysadmin.id, roleKeys: ['client'] }, admin)).status, 409, 'the last system administrator cannot be demoted');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserStatus', userId: sysadmin.id, status: 'disable' }, admin)).status, 403, 'nobody disables their own account here');
  const peer = await prisma.user.create({ data: { name: 'مدير آخر', phone: '0500000003', passwordHash: hash(PASSWORD), role: 'SUPER_ADMIN' } });
  const lastGuard = await call('/api/access', 'POST', { action: 'setUserStatus', userId: peer.id, status: 'disable' }, admin); assert.equal(lastGuard.status, 200, 'with two system administrators one may be disabled');
  assert.equal((await call('/api/access', 'POST', { action: 'setUserRoles', userId: sysadmin.id, roleKeys: ['client'] }, admin)).status, 409, 'and is still protected once the other one is disabled');
  // disabled accounts cannot sign in by code either
  await call('/api/access', 'POST', { action: 'setUserStatus', userId: nora.id, status: 'disable' }, admin);
  assert.equal((await call('/api/auth/otp/verify', 'POST', { channel: 'sms', target: '0555000001', code: await fresh('sms', '0555000001') })).status, 403, 'a disabled account is refused');

  // ---- sessions ----
  const a = (await call('/api/auth/login', 'POST', { identifier: '0500000001', password: PASSWORD })).cookie, b2 = (await call('/api/auth/login', 'POST', { identifier: '0500000001', password: PASSWORD })).cookie;
  const list = await call('/api/auth/sessions', 'GET', undefined, a); assert(list.data.sessions.length >= 3); assert.equal(list.data.sessions.filter(s => s.current).length, 1); assert(list.data.sessions.every(s => s.method && !('tokenHash' in s)), 'sessions show how they started and never expose the stored hash');
  assert.equal((await call('/api/auth/sessions', 'DELETE', { others: true }, a)).status, 200);
  assert.equal((await call('/api/auth/session', 'GET', undefined, b2)).data.user, null, 'the other device is signed out'); assert.equal((await call('/api/auth/session', 'GET', undefined, a)).data.user.id, sysadmin.id, 'this device stays');

  // ---- the security log: events recorded, no secrets in it ----
  const log = await call('/api/access?event=otp.failed', 'GET', undefined, a); assert(log.data.audit.length > 0); assert(log.data.audit.every(x => x.action === 'otp.failed'));
  const all = (await prisma.systemAuditLog.findMany()).map(x => x.action + JSON.stringify(x.details));
  for (const event of ['account.created', 'login.success', 'otp.sent', 'otp.failed', 'identity.linked', 'identity.takeover_guard', 'user.approved', 'role.created', 'user.roles_changed', 'session.revoked', 'user.disabled', 'settings.changed']) assert(all.some(x => x.startsWith(event)), 'logged: ' + event);
  assert(!all.join('\n').includes('+966555000001') && !all.join('\n').includes('sara@example.test'), 'phone numbers and e-mail addresses are masked in the log');
  assert.equal((await call('/api/access?event=otp.failed', 'GET', undefined, opsCookie)).data.audit, undefined, 'the log needs audit.view');

  console.log('PASS rbac: default roles match migration, roles/permissions as data, code and Google sign-in with linking, takeover guard, approval, escalation guards, sessions and security log');
})().catch(e => { console.error(e); console.error(logs.slice(-1500)); process.exitCode = 1; }).finally(async () => {
  await stop();
  try { await prisma.$disconnect(); const admin = new PrismaClient(); await admin.$executeRawUnsafe(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await admin.$disconnect(); } catch { }
  fs.rmSync(dist, { recursive: true, force: true }); fs.rmSync(testTsconfig, { force: true }); fs.rmSync(mailbox, { recursive: true, force: true }); fs.rmSync(smsbox, { recursive: true, force: true });
});
