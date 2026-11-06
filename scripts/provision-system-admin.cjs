// Local operator command; cannot be invoked by an HTTP request.
// ACCOUNT_IDENTIFIER=... node --env-file=.env scripts/provision-system-admin.cjs
const { PrismaClient } = require('@prisma/client');
// one-off admin scripts use the direct (non-pooler) address when Neon provides one
const prisma = new PrismaClient(process.env.DATABASE_URL_UNPOOLED ? { datasourceUrl: process.env.DATABASE_URL_UNPOOLED } : undefined);
(async () => {
  if (!process.env.ACCOUNT_IDENTIFIER) throw Error('Set ACCOUNT_IDENTIFIER to an existing account phone or email.');
  await prisma.$transaction(async tx => {
    const user = await tx.user.findFirst({ where: { OR: [{ phone: process.env.ACCOUNT_IDENTIFIER }, { email: process.env.ACCOUNT_IDENTIFIER }] } });
    if (!user || !user.passwordHash || !user.isActive) throw Error('An existing active account with a password is required.');
    await tx.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } });
    await tx.authSession.deleteMany({ where: { userId: user.id } });
    await tx.systemAuditLog.create({ data: { actorId: 'LOCAL_OPERATOR', targetId: user.id, action: 'SYSTEM_ADMIN_PROVISIONED' } });
  });
  console.log('System administrator provisioned. Sign in again with the existing password.');
})().catch(e => { console.error(e.message); process.exitCode=1; }).finally(() => prisma.$disconnect());
