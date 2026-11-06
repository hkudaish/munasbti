// Incremental logical backups for PostgreSQL (no pg_dump needed).
//
//  full         every row of every table, taken in ONE read-only REPEATABLE READ transaction (consistent snapshot)
//  incremental  only rows that were added or changed since the previous backup, plus the keys of deleted rows
//  preview      compares a backup with the live data WITHOUT changing anything
//  restore      replays full + incrementals (optionally up to an earlier backup) into a database and then re-reads it to
//               prove every row matches
//
// The engine is independent of where files live and of how the database is reached:
//   storage  FileStorage(dir) for a folder on disk, BlobStorage(store) for Netlify Blobs (the admin page and the
//            scheduled backups), or any object with the same few methods
//   prisma   any Prisma client (the command line opens its own, the app passes its shared one)
//
// A row's identity is its primary key; "changed" means its SHA-256 differs from the parent backup's. Files are
// gzip-compressed JSON lines and, when a key is available, AES-256-GCM encrypted. Every backup records the SHA-256 of
// its files and a chain hash linking it to its parent, so tampering or a missing link is detected.
//
// Scale note: rows are read into memory, which suits this database (hundreds of thousands of rows at most).
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { createHash, createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

// Sessions and rate-limit counters are never backed up: restoring them would revive revoked logins.
const DEFAULT_EXCLUDE = ['AuthSession', 'AuthAttempt', 'SystemSetupToken', 'AccountToken', 'VerificationCode', 'OAuthState'];   // short-lived credentials are never restored from a backup
// The administration audit trail is never rolled back by a restore: otherwise a restore could erase the record of what
// happened since the backup (including the restore itself). Rows from the backup are only added where missing.
const DEFAULT_PRESERVE = ['SystemAuditLog', 'AvailabilityAuditLog'];
const FORMAT = 1;
const LOCK_TTL_MS = 6 * 3600 * 1000;

const sha256 = buf => createHash('sha256').update(buf).digest('hex');
const q = name => '"' + String(name).replace(/"/g, '""') + '"';
const stable = value => JSON.stringify(value, (k, v) => (v && typeof v === 'object' && !Array.isArray(v) ? Object.fromEntries(Object.keys(v).sort().map(key => [key, v[key]])) : v));
const gz = buf => zlib.gzipSync(buf, { level: 9 });

// ---------------------------------------------------------------------------------------------------------------
// Encryption (optional)
// ---------------------------------------------------------------------------------------------------------------
function encryptionKey() {
  const raw = process.env.BACKUP_ENCRYPTION_KEY;
  if (!raw) return null;
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) throw new Error('BACKUP_ENCRYPTION_KEY must be 32 random bytes in base64 (run: node scripts/backup.cjs keygen).');
  return key;
}
function seal(buf, key) {
  if (!key) return buf;
  const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  const body = Buffer.concat([cipher.update(buf), cipher.final()]);
  return Buffer.concat([iv, body, cipher.getAuthTag()]);
}
function unseal(buf, key) {
  if (!key) throw new Error('This backup is encrypted: set BACKUP_ENCRYPTION_KEY to the key it was created with.');
  const iv = buf.subarray(0, 12), tag = buf.subarray(buf.length - 16), body = buf.subarray(12, buf.length - 16);
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  try { return Buffer.concat([decipher.update(body), decipher.final()]); }
  catch { throw new Error('Cannot decrypt: wrong key, or the file was modified.'); }
}

// ---------------------------------------------------------------------------------------------------------------
// Storage backends. Interface: list(): names, read(name): Buffer|null, write(name, Buffer), remove(name),
// acquireLock(): release function (throws if another run holds it), sub(name): namespaced child storage, describe().
// ---------------------------------------------------------------------------------------------------------------
class FileStorage {
  constructor(dir) { this.dir = dir; this.kind = 'file'; }
  describe() { return this.dir; }
  sub(name) { return new FileStorage(path.join(this.dir, name)); }
  async list() { return fs.existsSync(this.dir) ? fs.readdirSync(this.dir).filter(f => !f.startsWith('.') && fs.statSync(path.join(this.dir, f)).isFile()) : []; }
  async read(name) { const f = path.join(this.dir, name); return fs.existsSync(f) ? fs.readFileSync(f) : null; }
  async write(name, buf) { fs.mkdirSync(this.dir, { recursive: true }); fs.writeFileSync(path.join(this.dir, name), buf); }
  async remove(name) { try { fs.unlinkSync(path.join(this.dir, name)); } catch { /* already gone */ } }
  async acquireLock() {
    fs.mkdirSync(this.dir, { recursive: true });
    const lock = path.join(this.dir, '.lock');
    if (fs.existsSync(lock) && Date.now() - fs.statSync(lock).mtimeMs < LOCK_TTL_MS) throw new Error('Another backup is running (lock file ' + lock + '). If it crashed, delete the file.');
    fs.writeFileSync(lock, String(process.pid));
    return async () => { try { fs.unlinkSync(lock); } catch { /* already gone */ } };
  }
}

/** Netlify Blobs. `store` comes from getStore(); `prefix` namespaces keys inside it. */
class BlobStorage {
  constructor(store, prefix = '') { this.store = store; this.prefix = prefix; this.kind = 'blob'; }
  describe() { return 'Netlify Blobs' + (this.prefix ? ' / ' + this.prefix : ''); }
  sub(name) { return new BlobStorage(this.store, this.prefix + name + '/'); }
  async list() {
    const { blobs } = await this.store.list({ prefix: this.prefix || undefined });
    return blobs.map(b => b.key.slice(this.prefix.length)).filter(k => k && !k.startsWith('.') && !k.includes('/'));
  }
  async read(name) { const data = await this.store.get(this.prefix + name, { type: 'arrayBuffer' }); return data ? Buffer.from(data) : null; }
  async write(name, buf) { await this.store.set(this.prefix + name, buf); }
  async remove(name) { await this.store.delete(this.prefix + name); }
  async acquireLock() {
    const key = this.prefix + '.lock';
    const take = () => this.store.set(key, JSON.stringify({ at: Date.now() }), { onlyIfNew: true });
    let result = await take();
    if (result && result.modified === false) {
      const held = await this.store.get(key, { type: 'json' }).catch(() => null);
      if (held && Date.now() - held.at < LOCK_TTL_MS) throw new Error('Another backup is running (storage lock). It is released automatically after 6 hours if a run crashed.');
      await this.store.delete(key);
      result = await take();
      if (result && result.modified === false) throw new Error('Another backup is running (storage lock).');
    }
    return async () => { try { await this.store.delete(key); } catch { /* already gone */ } };
  }
}

// ---------------------------------------------------------------------------------------------------------------
// Database access
// ---------------------------------------------------------------------------------------------------------------
function openDb(url) {
  const { PrismaClient } = require('@prisma/client');
  const u = new URL(url);
  u.searchParams.delete('schema'); // every query below is schema-qualified
  return new PrismaClient({ datasourceUrl: u.toString(), log: [] });
}

async function describeSchema(tx, schema, exclude) {
  const tables = await tx.$queryRawUnsafe(`SELECT table_name AS t FROM information_schema.tables WHERE table_schema=$1 AND table_type='BASE TABLE' ORDER BY 1`, schema);
  const cols = await tx.$queryRawUnsafe(`SELECT table_name AS t, column_name AS c, data_type AS d, udt_name AS u FROM information_schema.columns WHERE table_schema=$1 ORDER BY table_name, ordinal_position`, schema);
  const pks = await tx.$queryRawUnsafe(`SELECT cl.relname AS t, a.attname AS c, k.ord::int AS o FROM pg_index i JOIN pg_class cl ON cl.oid=i.indrelid JOIN pg_namespace n ON n.oid=cl.relnamespace JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS k(attnum, ord) ON true JOIN pg_attribute a ON a.attrelid=cl.oid AND a.attnum=k.attnum WHERE i.indisprimary AND n.nspname=$1 ORDER BY cl.relname, k.ord`, schema);
  const fks = await tx.$queryRawUnsafe(`SELECT c.relname AS child, p.relname AS parent FROM pg_constraint k JOIN pg_class c ON c.oid=k.conrelid JOIN pg_class p ON p.oid=k.confrelid JOIN pg_namespace n ON n.oid=c.relnamespace WHERE k.contype='f' AND n.nspname=$1`, schema);
  const skip = new Set(exclude);
  const info = {};
  for (const { t } of tables) if (!skip.has(t)) info[t] = { columns: [], pk: [], types: {} };
  for (const { t, c, d, u } of cols) if (info[t]) { info[t].columns.push(c); info[t].types[c] = d === 'USER-DEFINED' || d === 'ARRAY' ? u : d; }
  for (const { t, c } of pks) if (info[t]) info[t].pk.push(c);
  const missingPk = Object.keys(info).filter(t => !info[t].pk.length);
  if (missingPk.length) throw new Error('Tables without a primary key cannot be backed up incrementally: ' + missingPk.join(', '));
  const deps = Object.fromEntries(Object.keys(info).map(t => [t, new Set()]));
  for (const { child, parent } of fks) if (info[child] && info[parent] && child !== parent) deps[child].add(parent);
  // excluded tables (e.g. sessions) that point at included tables must be emptied before those tables are replaced
  const excludedDependents = [...new Set(fks.filter(f => skip.has(f.child) && info[f.parent]).map(f => f.child))];
  // parents first
  const order = [], state = {};
  const visit = t => { if (state[t]) return; state[t] = 1; for (const d of deps[t]) visit(d); order.push(t); };
  Object.keys(info).sort().forEach(visit);
  // column ORDER is irrelevant to a logical restore (rows are keyed by column name), so it must not affect compatibility
  const fingerprint = sha256(stable(Object.fromEntries(Object.keys(info).sort().map(t => [t, info[t].columns.map(c => c + ':' + info[t].types[c]).sort()]))));
  return { info, order, fingerprint, excludedDependents };
}

const rowKey = (row, pk) => JSON.stringify(pk.map(c => row[c]));

/**
 * Reads many tables per round trip (UNION ALL, tagged by table name). Each query costs one network round trip, so over
 * a slow link this is the difference between 70 seconds and a few. Rows come back sorted by primary key for stable files.
 */
async function readTables(tx, schema, tables, info, perQuery = 20) {
  const rows = Object.fromEntries(tables.map(t => [t, []]));
  for (let i = 0; i < tables.length; i += perQuery) {
    const batch = tables.slice(i, i + perQuery);
    const sql = batch.map(t => `SELECT ${"'" + t.replace(/'/g, "''") + "'"}::text AS t, to_jsonb(x) AS j FROM ${q(schema)}.${q(t)} x`).join(' UNION ALL ');
    for (const r of await tx.$queryRawUnsafe(sql)) rows[r.t].push(r.j);
  }
  for (const t of tables) {
    const pk = info[t].pk;
    const keyed = rows[t].map(row => [rowKey(row, pk), row]);
    keyed.sort((a, b) => (a[0] < b[0] ? -1 : a[0] > b[0] ? 1 : 0));
    rows[t] = keyed.map(k => k[1]);
  }
  return rows;
}

/** One consistent, read-only snapshot of all included tables, hashed row by row. */
async function takeSnapshot(prisma, schema, exclude = DEFAULT_EXCLUDE) {
  return prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe('SET TRANSACTION READ ONLY');
    await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'UTC'`); // identical timestamp text on every run and server
    const { info, order, fingerprint } = await describeSchema(tx, schema, exclude);
    const rows = await readTables(tx, schema, order, info), hashes = {};
    for (const t of order) hashes[t] = new Map(rows[t].map(r => [rowKey(r, info[t].pk), sha256(stable(r))]));
    return { info, order, fingerprint, rows, hashes };
  }, { isolationLevel: 'RepeatableRead', timeout: 600000, maxWait: 60000 });
}

// ---------------------------------------------------------------------------------------------------------------
// Backup chain
// ---------------------------------------------------------------------------------------------------------------
async function readManifests(storage) {
  const names = (await storage.list()).filter(f => f.endsWith('.manifest.json'));
  const all = await Promise.all(names.map(async n => JSON.parse((await storage.read(n)).toString('utf8'))));
  return all.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
}
async function chainTo(storage, headId) {
  const all = new Map((await readManifests(storage)).map(m => [m.id, m]));
  const chain = [];
  for (let m = all.get(headId); m; m = m.parent ? all.get(m.parent) : null) {
    chain.unshift(m);
    if (m.type === 'full') return chain;
    if (m.parent && !all.has(m.parent)) throw new Error(`Backup ${m.id} needs ${m.parent}, which is missing.`);
  }
  throw new Error('Backup ' + headId + ' not found or its chain has no full backup.');
}
async function readFileOf(storage, manifest, kind, key) {
  const raw = await storage.read(manifest.files[kind].name);
  if (!raw) throw new Error(`${manifest.id}: missing ${manifest.files[kind].name}`);
  return zlib.gunzipSync(manifest.encrypted ? unseal(raw, key) : raw);
}
const readState = async (storage, manifest, key) => JSON.parse((await readFileOf(storage, manifest, 'state', key)).toString('utf8'));
const readOps = async (storage, manifest, key) => (await readFileOf(storage, manifest, 'data', key)).toString('utf8').split('\n').filter(Boolean).map(l => JSON.parse(l));
const idNow = type => new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+Z$/, '') + Date.now().toString().slice(-3) + 'Z-' + (type === 'full' ? 'full' : 'incr');

/** Creates a full or incremental backup. Returns { manifest, changed } */
async function createBackup({ prisma, schema = 'public', storage, type, exclude = DEFAULT_EXCLUDE, force = false, label = '', onStep = () => {}, key = encryptionKey() }) {
  onStep('key-ready');
  const release = await storage.acquireLock();
  try {
    onStep('lock-held');
    const manifests = await readManifests(storage);
    const parent = type === 'incremental' ? manifests[manifests.length - 1] : null;
    if (type === 'incremental' && !parent) throw new Error('There is no backup to build on. Run a full backup first.');
    onStep('snapshot-begin');
    const snap = await takeSnapshot(prisma, schema, exclude);
    onStep('snapshot-done');
    if (parent && parent.schemaFingerprint !== snap.fingerprint && !force) throw new Error('The database structure changed since the last backup. Take a new full backup (or pass --force).');
    if (parent && !!parent.encrypted !== !!key && !force) throw new Error('Encryption setting differs from the previous backup in this chain. Use the same BACKUP_ENCRYPTION_KEY or start a new full backup.');
    const parentState = parent ? await readState(storage, parent, key) : null;

    const lines = []; let upserts = 0, deletes = 0;
    const tablesMeta = {}, state = {};
    for (const t of snap.order) {
      const pk = snap.info[t].pk, prev = parentState ? parentState[t] || {} : {}, now = {};
      let u = 0, d = 0;
      for (const row of snap.rows[t]) {
        const k = rowKey(row, pk), h = snap.hashes[t].get(k);
        now[k] = h;
        if (!parent || prev[k] !== h) { lines.push(JSON.stringify({ t, op: 'upsert', row })); u++; }
      }
      for (const k of Object.keys(prev)) if (!(k in now)) { lines.push(JSON.stringify({ t, op: 'delete', key: JSON.parse(k) })); d++; }
      state[t] = now; upserts += u; deletes += d;
      tablesMeta[t] = { rows: snap.rows[t].length, upserts: u, deletes: d, pk };
    }
    const id = idNow(type);
    const data = seal(gz(Buffer.from(lines.join('\n') + (lines.length ? '\n' : ''))), key);
    const stateFile = seal(gz(Buffer.from(JSON.stringify(state))), key);
    const dataName = id + '.data.jsonl.gz' + (key ? '.enc' : ''), stateName = id + '.state.json.gz' + (key ? '.enc' : '');
    const core = { format: FORMAT, id, type, createdAt: new Date().toISOString(), parent: parent ? parent.id : null, schema, schemaFingerprint: snap.fingerprint, encrypted: !!key, label };
    const files = { data: { name: dataName, sha256: sha256(data), bytes: data.length }, state: { name: stateName, sha256: sha256(stateFile), bytes: stateFile.length } };
    const chainHash = sha256((parent ? parent.chainHash : '') + stable(core) + files.data.sha256 + files.state.sha256);
    const manifest = { ...core, files, chainHash, stats: { tables: snap.order.length, rows: Object.values(tablesMeta).reduce((n, m) => n + m.rows, 0), upserts, deletes }, tables: tablesMeta, excluded: exclude };
    await storage.write(dataName, data);
    await storage.write(stateName, stateFile);
    await storage.write(id + '.manifest.json', Buffer.from(JSON.stringify(manifest, null, 2))); // manifest last: a crash leaves no half backup
    onStep('files-written');
    return { manifest, changed: upserts + deletes };
  } finally { await release(); }
}

/** Checks hashes, chain links and readability of everything needed to restore `headId`. */
async function verifyChain(storage, headId, { key = encryptionKey() } = {}) {
  const problems = []; let chain;
  try { chain = await chainTo(storage, headId); } catch (e) { return { ok: false, problems: [e.message], chain: [] }; }
  let prevHash = '';
  for (const m of chain) {
    const before = problems.length;
    for (const kind of ['data', 'state']) {
      const buf = await storage.read(m.files[kind].name);
      if (!buf) { problems.push(`${m.id}: missing ${m.files[kind].name}`); continue; }
      if (sha256(buf) !== m.files[kind].sha256) problems.push(`${m.id}: ${kind} file was modified (checksum mismatch)`);
    }
    const expected = sha256(prevHash + stable({ format: m.format, id: m.id, type: m.type, createdAt: m.createdAt, parent: m.parent, schema: m.schema, schemaFingerprint: m.schemaFingerprint, encrypted: m.encrypted, label: m.label }) + m.files.data.sha256 + m.files.state.sha256);
    if (expected !== m.chainHash) problems.push(`${m.id}: chain hash does not match (backup edited or reordered)`);
    prevHash = m.chainHash;
    if (problems.length === before) {
      try { const ops = await readOps(storage, m, key); if (ops.length !== m.stats.upserts + m.stats.deletes) problems.push(`${m.id}: expected ${m.stats.upserts + m.stats.deletes} changes, found ${ops.length}`); }
      catch (e) { problems.push(`${m.id}: ${e.message}`); }
    }
  }
  return { ok: problems.length === 0, problems, chain };
}

/** Merges full + incrementals into the final row set. */
async function mergeChain(storage, chain, key = encryptionKey()) {
  const rows = {};
  for (const m of chain) {
    for (const op of await readOps(storage, m, key)) {
      const pk = m.tables[op.t].pk; rows[op.t] = rows[op.t] || new Map();
      if (op.op === 'upsert') rows[op.t].set(rowKey(op.row, pk), op.row);
      else rows[op.t].delete(JSON.stringify(op.key));
    }
  }
  return rows;
}

async function pickHead(storage, headId) {
  const manifests = await readManifests(storage);
  if (!manifests.length) throw new Error('No backups found.');
  const head = headId ? manifests.find(m => m.id === headId) : manifests[manifests.length - 1];
  if (!head) throw new Error('Backup ' + headId + ' not found.');
  return head;
}

/**
 * Compares a backup with the live data and changes NOTHING. Tells exactly what a restore would do:
 * rows that would come back, rows that would disappear, rows that would revert to older values.
 */
async function previewRestore({ prisma, storage, schema = 'public', headId, exclude = DEFAULT_EXCLUDE, preserve = DEFAULT_PRESERVE, key = encryptionKey() }) {
  const head = await pickHead(storage, headId);
  const check = await verifyChain(storage, head.id, { key });
  if (!check.ok) throw new Error('The backup chain is damaged:\n  ' + check.problems.join('\n  '));
  const final = await mergeChain(storage, check.chain, key);
  const live = await takeSnapshot(prisma, schema, exclude);
  const compatible = live.fingerprint === head.schemaFingerprint;
  const tables = []; const totals = { toAdd: 0, toRemove: 0, toChange: 0, unchanged: 0 };
  for (const t of live.order) {
    const backup = new Map([...(final[t] ? final[t].entries() : [])].map(([k, row]) => [k, sha256(stable(row))]));
    const now = live.hashes[t];
    let toAdd = 0, toRemove = 0, toChange = 0, unchanged = 0; const sample = { add: [], remove: [], change: [] };
    const keep = preserve.includes(t); // preserved tables only ever gain missing rows
    for (const [k, h] of backup) {
      if (!now.has(k)) { toAdd++; if (sample.add.length < 3) sample.add.push(k); }
      else if (!keep && now.get(k) !== h) { toChange++; if (sample.change.length < 3) sample.change.push(k); }
      else unchanged++;
    }
    if (!keep) for (const k of now.keys()) if (!backup.has(k)) { toRemove++; if (sample.remove.length < 3) sample.remove.push(k); }
    totals.toAdd += toAdd; totals.toRemove += toRemove; totals.toChange += toChange; totals.unchanged += unchanged;
    if (toAdd || toRemove || toChange) tables.push({ table: t, backupRows: backup.size, liveRows: now.size, toAdd, toRemove, toChange, sample });
  }
  return { head: { id: head.id, type: head.type, createdAt: head.createdAt, rows: head.stats.rows }, chainLength: check.chain.length, compatible, totals, tables, preserved: preserve, sessionsRevoked: true };
}

/** Restores `headId` (default: newest) into a database. The target must already have the same structure. */
async function restoreBackup({ prisma, storage, schema = 'public', headId, replace = false, exclude = DEFAULT_EXCLUDE, preserve = DEFAULT_PRESERVE, safetyStorage = null, log = () => {}, key = encryptionKey() }) {
  const head = await pickHead(storage, headId);
  const check = await verifyChain(storage, head.id, { key });
  if (!check.ok) throw new Error('Refusing to restore, the backup chain is damaged:\n  ' + check.problems.join('\n  '));
  const final = await mergeChain(storage, check.chain, key);
  log(`Chain: ${check.chain.length} file set(s), ${check.chain.map(c => c.type).join(' + ')}; restoring state of ${head.createdAt}`);

  const probe = await prisma.$transaction(tx => describeSchema(tx, schema, exclude));
  if (probe.fingerprint !== head.schemaFingerprint) throw new Error('The target database structure differs from the backup. Create the target from the same migrations first (prisma db push).');
  let existing = 0;
  for (const t of probe.order) existing += (await prisma.$queryRawUnsafe(`SELECT count(*)::int AS n FROM ${q(schema)}.${q(t)}`))[0].n;
  if (existing > 0 && !replace) throw new Error(`The target already holds ${existing} rows. Restoring replaces them: pass --replace to confirm.`);
  if (existing > 0 && safetyStorage) {
    log('Target is not empty: taking a safety backup of it first (' + safetyStorage.describe() + ')');
    await createBackup({ prisma, schema, storage: safetyStorage, type: 'full', exclude, label: 'safety copy before restore of ' + head.id, key });
  }
  await prisma.$transaction(async tx => {
    await tx.$executeRawUnsafe(`SET LOCAL TIME ZONE 'UTC'`);
    let replica = true;
    try { await tx.$executeRawUnsafe(`SET LOCAL session_replication_role = 'replica'`); } catch { replica = false; }
    // Sessions (and other excluded tables that reference replaced data) are emptied: everyone signs in again after a restore.
    for (const t of probe.excludedDependents) await tx.$executeRawUnsafe(`DELETE FROM ${q(schema)}.${q(t)}`);
    for (const t of [...probe.order].reverse()) if (!preserve.includes(t)) await tx.$executeRawUnsafe(`DELETE FROM ${q(schema)}.${q(t)}`);
    for (const t of probe.order) {
      const rows = [...(final[t] ? final[t].values() : [])]; if (!rows.length) continue;
      const cols = probe.info[t].columns.map(q).join(', ');
      for (let i = 0; i < rows.length; i += 400) {
        await tx.$executeRawUnsafe(`INSERT INTO ${q(schema)}.${q(t)} (${cols}) SELECT ${cols} FROM jsonb_populate_recordset(NULL::${q(schema)}.${q(t)}, $1::jsonb)${preserve.includes(t) ? ' ON CONFLICT DO NOTHING' : ''}`, JSON.stringify(rows.slice(i, i + 400)));
      }
    }
    log(replica ? 'Restored with constraint checks deferred, FK order respected too.' : 'Restored in foreign-key order.');
  }, { timeout: 600000, maxWait: 60000, isolationLevel: 'Serializable' });

  // prove it: re-read the target and compare every row with the backup's final state
  const after = await takeSnapshot(prisma, schema, exclude);
  const mismatches = [];
  for (const t of probe.order) {
    const expectedHashes = new Map([...(final[t] ? final[t].entries() : [])].map(([k, row]) => [k, sha256(stable(row))]));
    const got = after.hashes[t];
    if (preserve.includes(t)) { for (const k of expectedHashes.keys()) if (!got.has(k)) { mismatches.push(`${t}: row ${k} is missing`); break; } continue; }
    if (got.size !== expectedHashes.size) mismatches.push(`${t}: ${got.size} rows, expected ${expectedHashes.size}`);
    else for (const [k, h] of expectedHashes) if (got.get(k) !== h) { mismatches.push(`${t}: row ${k} differs`); break; }
  }
  return { head, tables: probe.order.length, rows: probe.order.reduce((n, t) => n + after.rows[t].length, 0), verified: mismatches.length === 0, mismatches };
}

// ---------------------------------------------------------------------------------------------------------------
// Automatic policy and housekeeping
// ---------------------------------------------------------------------------------------------------------------
const DEFAULT_POLICY = { fullEveryDays: 7, maxIncrementals: 96, keepChains: 4 };

/** Decides what the scheduler should do next: a full backup (first run / old chain / long chain) or an incremental. */
function nextAutoType(manifests, policy = DEFAULT_POLICY, now = Date.now()) {
  if (!manifests.length) return { type: 'full', why: 'no backups yet' };
  const lastFullIdx = manifests.map(m => m.type).lastIndexOf('full');
  const lastFull = manifests[lastFullIdx], incrs = manifests.length - 1 - lastFullIdx;
  if (now - Date.parse(lastFull.createdAt) >= policy.fullEveryDays * 86400000) return { type: 'full', why: `last full backup is older than ${policy.fullEveryDays} days` };
  if (incrs >= policy.maxIncrementals) return { type: 'full', why: `chain already has ${incrs} incrementals` };
  return { type: 'incremental', why: `${incrs} incremental(s) since the last full backup` };
}

/** Removes whole old chains (never part of one), keeping the newest `keepChains`. Returns removed ids. */
async function prune(storage, keepChains = DEFAULT_POLICY.keepChains) {
  const all = await readManifests(storage), chains = [];
  for (const m of all) { if (m.type === 'full') chains.push([m]); else if (chains.length) chains[chains.length - 1].push(m); }
  const doomed = chains.slice(0, Math.max(0, chains.length - keepChains)).flat(), removed = [];
  for (const m of doomed) {
    for (const f of [m.files.data.name, m.files.state.name, m.id + '.manifest.json']) await storage.remove(f);
    removed.push(m.id);
  }
  return removed;
}

function defaultRoot() { return process.env.BACKUP_DIR || path.join(os.homedir(), 'Backups', 'munasabati', 'incremental'); }

module.exports = { DEFAULT_EXCLUDE, DEFAULT_PRESERVE, DEFAULT_POLICY, FileStorage, BlobStorage, createBackup, previewRestore, restoreBackup, verifyChain, readManifests, chainTo, nextAutoType, prune, defaultRoot, openDb, describeSchema, takeSnapshot, encryptionKey, sha256 };
