export const dynamic = 'force-dynamic';

/** Liveness only (no database): lets a process manager or uptime monitor tell "the Node process is up" from "the database is down" (/api/health/db). */
export function GET() {
  return Response.json({ status: 'ok', uptimeSeconds: Math.round(process.uptime()) }, { headers: { 'Cache-Control': 'no-store' } });
}
