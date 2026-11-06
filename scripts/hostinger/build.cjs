// Production build for a self-hosted server: a standalone Next.js bundle plus its static files, ready to copy to the server.
//   npm run build:hostinger     ->  .next/standalone (run it with: node .next/standalone/server.js, or PM2 via ecosystem.config.cjs)
// NEXT_PUBLIC_* values (NEXT_PUBLIC_APP_URL, NEXT_PUBLIC_TURNSTILE_SITE_KEY) are baked in at build time, so set them first.
const { spawnSync } = require('node:child_process'); const fs = require('node:fs'); const path = require('node:path');
const root = path.resolve(__dirname, '..', '..');
for (const file of ['.env.production', '.env']) {
  const full = path.join(root, file); if (!fs.existsSync(full)) continue;
  for (const line of fs.readFileSync(full, 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}
if (!/^https:\/\//.test(process.env.NEXT_PUBLIC_APP_URL || '')) { console.error('NEXT_PUBLIC_APP_URL must be the public https address (e.g. https://your-domain.com) before building.'); process.exit(1); }
const result = spawnSync(process.execPath, [path.join(root, 'node_modules', 'next', 'dist', 'bin', 'next'), 'build'], { cwd: root, stdio: 'inherit', env: { ...process.env, BUILD_STANDALONE: '1', NODE_ENV: 'production' } });
if (result.status !== 0) process.exit(result.status || 1);
// The standalone server does not include static assets or /public; copy them next to it.
const dist = process.env.NEXT_TEST_DIST_DIR || '.next';   // NEXT_TEST_DIST_DIR only for side-by-side test builds
const standalone = path.join(root, dist, 'standalone');
fs.cpSync(path.join(root, dist, 'static'), path.join(standalone, dist, 'static'), { recursive: true });
if (fs.existsSync(path.join(root, 'public'))) fs.cpSync(path.join(root, 'public'), path.join(standalone, 'public'), { recursive: true });
console.log('\nStandalone build ready in .next/standalone');
