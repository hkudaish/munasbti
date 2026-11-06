// First-run data for a NEW production database, after `node scripts/migrate.cjs`: the Saudi cities, the geography (countries, regions,
// feature switches) and nothing else - no demo vendors, services or coupons. Safe to re-run (everything is upserted).
//   node scripts/seed-base.cjs        (reads DATABASE_URL, from .env.production if present)
const fs = require('node:fs');
for (const file of ['.env.production', '.env']) {
  if (!fs.existsSync(file)) continue;
  for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) { const m = line.match(/^([A-Z_]+)="?(.*?)"?$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2]; }
}
const { PrismaClient } = require('@prisma/client');
// one-off admin scripts use the direct (non-pooler) address when Neon provides one
const prisma = new PrismaClient(process.env.DATABASE_URL_UNPOOLED ? { datasourceUrl: process.env.DATABASE_URL_UNPOOLED } : undefined);
const CITIES = [
  ['riyadh', 'الرياض', 'Riyadh', 'منطقة الرياض'], ['jeddah', 'جدة', 'Jeddah', 'منطقة مكة المكرمة'], ['dammam', 'الدمام والخبر', 'Dammam & Khobar', 'المنطقة الشرقية'],
  ['makkah', 'مكة المكرمة', 'Makkah', 'منطقة مكة المكرمة'], ['madinah', 'المدينة المنورة', 'Madinah', 'منطقة المدينة المنورة'], ['taif', 'الطائف', 'Taif', 'منطقة مكة المكرمة'],
  ['qassim', 'القصيم (بريدة وعنيزة)', 'Qassim', 'منطقة القصيم'], ['abha', 'أبها وخميس مشيط', 'Abha & Khamis', 'منطقة عسير'],
];
(async () => {
  for (const [i, [id, nameAr, nameEn, regionAr]] of CITIES.entries()) {
    const data = { id, nameAr, nameEn, regionAr, isAvailable: true, sortOrder: i + 1 };
    await prisma.saudiCity.upsert({ where: { id }, update: data, create: data });
  }
  await require('./seed-geography.cjs').seedGeography(prisma);
  console.log(`Base data ready: ${await prisma.saudiCity.count()} cities, ${await prisma.serviceCategory.count()} service categories, ${await prisma.systemFeature.count()} feature switches.`);
})().catch(e => { console.error(e.message); process.exit(1); }).finally(() => prisma.$disconnect());
