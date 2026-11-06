import { PrismaClient } from '@prisma/client';
import { getConnectionString } from '@netlify/database';

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
  databaseUrl: string | undefined;
};

export function databaseConnectionUrl() {
  let connection = process.env.DATABASE_URL;
  // Resolve inside the request: Netlify supplies credentials for its current DB branch.
  try { connection = getConnectionString(); } catch { /* Local PostgreSQL uses DATABASE_URL. */ }
  return connection;
}

function databaseClient() {
  let connection = databaseConnectionUrl();
  if (connection) {
    const url = new URL(connection);
    // 2 suits Netlify's short-lived functions; one long-running Node process (Hostinger, VPS) should set DB_CONNECTION_LIMIT (about 10).
    if (!url.searchParams.has('connection_limit')) url.searchParams.set('connection_limit', process.env.DB_CONNECTION_LIMIT || '2');
    // Neon's pooled endpoint (host contains "-pooler") is PgBouncer in transaction mode: Prisma must not use named prepared statements there.
    if (url.hostname.includes('-pooler') && !url.searchParams.has('pgbouncer')) url.searchParams.set('pgbouncer', 'true');
    if (!url.searchParams.has('pool_timeout')) url.searchParams.set('pool_timeout', '20');
    connection = url.toString();
  }
  if (!globalForPrisma.prisma || globalForPrisma.databaseUrl !== connection) {
    globalForPrisma.prisma = new PrismaClient({
    ...(connection ? { datasourceUrl: connection } : {}),
    // A managed database is a network hop away: several queries in one transaction can pass Prisma's 5 s default. Raise both limits (still bounded).
    transactionOptions: { maxWait: 10000, timeout: 30000 },
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
    });
    globalForPrisma.databaseUrl = connection;
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, key) {
    const client = databaseClient();
    const value = Reflect.get(client, key, client);
    return typeof value === 'function' ? value.bind(client) : value;
  },
});

export default prisma;
