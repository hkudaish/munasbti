import { execSync } from 'node:child_process';
const BASE = process.env.BASE || 'http://127.0.0.1:3200', PID = process.env.SPID; // SPID: pid of the server process (for CPU and memory)
const levels = (process.env.LEVELS || '10,50,100,250,500,1000').split(',').map(Number);
const DUR = Number(process.env.DUR || 12) * 1000;
const scenario = process.env.SCN || 'browse';
const paths = {
  browse: ['/', '/marketplace', '/packages', '/api/commerce/catalog', '/api/catalog/services', '/api/public-stats', '/api/features'],
  page: ['/', '/marketplace'],
  api: ['/api/commerce/catalog', '/api/catalog/services', '/api/public-stats'],
  db: ['/api/health/db'],
};
function proc() { try { const o = execSync(`powershell -NoProfile -Command "$p=Get-Process -Id ${PID}; \\"$($p.CPU) $($p.WorkingSet64)\\""`).toString().trim().split(' '); return { cpu: +o[0], ws: +o[1] / 1048576 }; } catch { return { cpu: 0, ws: 0 }; } }
const pct = (a, p) => a.length ? a[Math.min(a.length - 1, Math.floor(a.length * p))] : 0;
async function level(n) {
  const lat = [], status = {}; let err = 0, timeout = 0, stop = false; const list = paths[scenario];
  const p0 = proc(), t0 = Date.now();
  const vu = async (i) => {
    let k = i;
    while (!stop) {
      const path = list[k++ % list.length], s = performance.now();
      try {
        const r = await fetch(BASE + path, { signal: AbortSignal.timeout(10000) });
        await r.arrayBuffer(); lat.push(performance.now() - s); status[r.status] = (status[r.status] || 0) + 1;
      } catch (e) { if (e.name === 'TimeoutError') timeout++; else err++; }
    }
  };
  const ps = Array.from({ length: n }, (_, i) => vu(i));
  await new Promise(r => setTimeout(r, DUR)); stop = true; await Promise.all(ps);
  const el = (Date.now() - t0) / 1000, p1 = proc(); lat.sort((a, b) => a - b);
  console.log(JSON.stringify({ scn: scenario, users: n, rps: +(lat.length / el).toFixed(0), p50: +pct(lat, .5).toFixed(0), p95: +pct(lat, .95).toFixed(0), p99: +pct(lat, .99).toFixed(0), status, connErr: err, timeouts: timeout, cpuCores: +((p1.cpu - p0.cpu) / el).toFixed(2), rssMB: +p1.ws.toFixed(0) }));
}
for (const n of levels) { await level(n); await new Promise(r => setTimeout(r, 2000)); }
