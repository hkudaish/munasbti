// Applies netlify/database/migrations/*.sql, in order, to any PostgreSQL database (Hostinger VPS, Neon, Supabase, local).
// Each file runs once, inside a transaction, and is recorded in "_app_migrations" with its checksum; a file edited after it was applied is reported.
//   node scripts/migrate.cjs            apply what is pending
//   node scripts/migrate.cjs --status   list applied / pending
// Uses DATABASE_URL (and its ?schema= parameter, if any). Safe to run on every deploy; concurrent runs wait on an advisory lock.
const fs = require('node:fs'); const path = require('node:path'); const { createHash } = require('node:crypto');
const { Client } = require('pg');

for (const file of ['.env', '.env.production']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}
const dir = path.resolve(__dirname, '..', 'netlify', 'database', 'migrations');
const statusOnly = process.argv.includes('--status');

(async () => {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL is not set');
  const url = new URL(process.env.DATABASE_URL);
  const schema = url.searchParams.get('schema') || 'public';
  for (const key of ['schema', 'connection_limit', 'pool_timeout', 'pgbouncer']) url.searchParams.delete(key);   // Prisma-only parameters
  const client = new Client({ connectionString: url.toString(), ...(url.searchParams.get('sslmode') === 'disable' ? {} : {}) });
  await client.connect();
  try {
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await client.query(`SET search_path TO "${schema}"`);
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query('CREATE TABLE IF NOT EXISTS "_app_migrations" ("name" TEXT PRIMARY KEY, "checksum" TEXT NOT NULL, "appliedAt" TIMESTAMPTZ NOT NULL DEFAULT now())');
    const done = new Map((await client.query('SELECT "name","checksum" FROM "_app_migrations"')).rows.map(r => [r.name, r.checksum]));
    const files = fs.readdirSync(dir).filter(f => f.endsWith('.sql')).sort();
    let applied = 0;
    for (const file of files) {
      const name = file.replace(/\.sql$/, ''), sql = fs.readFileSync(path.join(dir, file), 'utf8'), checksum = createHash('sha256').update(sql).digest('hex');
      if (done.has(name)) { if (done.get(name) !== checksum) console.warn(`! ${name} was changed after it was applied (ignored; add a new migration instead)`); else if (statusOnly) console.log(`  applied  ${name}`); continue; }
      if (statusOnly) { console.log(`  PENDING  ${name}`); continue; }
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO "_app_migrations" ("name","checksum") VALUES ($1,$2)', [name, checksum]);
        await client.query('COMMIT');
      } catch (error) { await client.query('ROLLBACK'); throw new Error(`${name} failed and was rolled back: ${error.message}`); }
      applied++; console.log(`+ applied ${name}`);
    }
    if (!statusOnly) console.log(applied ? `${applied} migration(s) applied.` : 'Database is up to date.');
  } finally { await client.query('SELECT pg_advisory_unlock(727274)').catch(() => { }); await client.end(); }
})().catch(error => { console.error(error.message); process.exit(1); });
