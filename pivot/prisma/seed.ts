/**
 * Seed a ready-to-explore account:
 *   demo@pivot.test / pivot-demo-2026  →  "Acme Inc." with the sample data.
 * Safe to re-run: it resets that one account and leaves everything else alone.
 */
import "dotenv/config";
import { randomBytes, scryptSync } from "node:crypto";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../src/generated/prisma/client";
import { toMetricRows } from "../src/lib/data/metrics";
import { northstarCsv, northstarData } from "../src/lib/demo/northstar";

const EMAIL = "demo@pivot.test";
const PASSWORD = "pivot-demo-2026";

// Same format as src/server/auth/password.ts (that module is server-only).
function hashPassword(password: string) {
  const salt = randomBytes(16);
  const key = scryptSync(password.normalize("NFKC"), salt, 64, { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
  return `scrypt$16384$8$1$${salt.toString("base64")}$${key.toString("base64")}`;
}

async function main() {
  const db = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }) });
  const old = await db.user.findUnique({ where: { email: EMAIL }, select: { id: true, memberships: { select: { companyId: true } } } });
  if (old) {
    await db.company.deleteMany({ where: { id: { in: old.memberships.map((m) => m.companyId) } } });
    await db.user.delete({ where: { id: old.id } });
  }
  const user = await db.user.create({ data: { email: EMAIL, name: "Alex Morgan", passwordHash: hashPassword(PASSWORD) } });
  const company = await db.company.create({
    data: {
      name: "Acme Inc.",
      industry: "ecommerce",
      timezone: "America/New_York",
      trialEndsAt: new Date(Date.now() + 14 * 86_400_000),
      dataVersion: 1,
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await db.user.update({ where: { id: user.id }, data: { activeCompanyId: company.id } });

  const data = northstarData();
  const csv = northstarCsv();
  const source = await db.dataSource.create({ data: { companyId: company.id, kind: "SAMPLE", name: "Sample data", lastSyncedAt: new Date() } });
  const month = (p: string) => new Date(`${p}-01T00:00:00Z`);
  const dataset = await db.uploadedDataset.create({
    data: {
      companyId: company.id,
      dataSourceId: source.id,
      createdById: user.id,
      name: "Northstar Commerce sample",
      fileName: "northstar-sample.csv",
      fileSize: Buffer.byteLength(csv),
      rowCount: data.periods.length,
      columns: [],
      mapping: { sample: true },
      preview: [],
      rawCsv: csv,
      status: "READY",
      periodStart: month(data.periods[0]),
      periodEnd: month(data.periods[data.periods.length - 1]),
    },
  });
  await db.metric.createMany({
    data: toMetricRows(data).map((r) => ({ companyId: company.id, datasetId: dataset.id, period: month(r.period), key: r.key, dimension: r.dimension, value: r.value })),
  });
  // Insights, opportunities and recommendations are written on first page load
  // (the workspace's data version is ahead of its analyzed version).
  console.log(`Seeded ${EMAIL} / ${PASSWORD} → Acme Inc. with ${data.periods.length} months of sample data.`);
  await db.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
