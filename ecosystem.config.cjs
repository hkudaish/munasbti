// PM2 process file for a Hostinger VPS (or any server):   pm2 start ecosystem.config.cjs && pm2 save && pm2 startup
// Runs the standalone build in cluster mode so every CPU core serves requests (one Node process uses one core).
// Environment comes from the server's own environment / .env.production loaded below; never commit real secrets.
const fs = require('node:fs'); const path = require('node:path');
const env = {};
const file = path.join(__dirname, '.env.production');
if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m) env[m[1]] = m[2]; }

module.exports = {
  apps: [{
    name: 'munasbti',
    script: '.next/standalone/server.js',
    cwd: __dirname,
    exec_mode: 'cluster',
    instances: Number(process.env.WEB_CONCURRENCY || env.WEB_CONCURRENCY || 2),   // about one per vCPU; each needs 300-600 MB
    max_memory_restart: '700M',          // recycle a leaking worker before the server runs out of memory
    kill_timeout: 10000,                 // let in-flight requests finish on reload
    listen_timeout: 15000,
    autorestart: true, max_restarts: 20, min_uptime: '20s',
    env: { ...env, NODE_ENV: 'production', PORT: env.PORT || '3000', HOSTNAME: '127.0.0.1' },   // bind to loopback: only nginx is public
  }],
};
