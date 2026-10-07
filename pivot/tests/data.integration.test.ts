/**
 * Data layer against a real Postgres (DATABASE_URL): tenant isolation,
 * analysis persistence, and auth primitives.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { toMetricRows } from "@/lib/data/metrics";
import { northstarData } from "@/lib/demo/northstar";
import { safeNext } from "@/lib/safe-next";
import { refreshAnalysis } from "@/server/analysis/refresh";
import { hashPassword, verifyPassword } from "@/server/auth/password";
import { hashToken, newToken } from "@/server/auth/tokens";
import { loadBusinessData } from "@/server/data/business-data";
import { db } from "@/server/db";
import type { WorkspaceCompany } from "@/server/workspace";

const RUN = Math.random().toString(36).slice(2, 8);
const ids = { users: [] as string[], companies: [] as string[] };
let a: WorkspaceCompany;
let b: WorkspaceCompany;

const asWs = (c: { id: string; name: string }): WorkspaceCompany => ({
  id: c.id,
  name: c.name,
  currency: "USD",
  timezone: "UTC",
  industry: "ecommerce",
  marketSharePct: null,
  aiNarratives: false,
  dataVersion: 1,
});

beforeAll(async () => {
  for (const name of ["A", "B"]) {
    const user = await db.user.create({ data: { email: `${name.toLowerCase()}-${RUN}@test.local`, name, passwordHash: "x" } });
    const company = await db.company.create({ data: { name: `Co ${name} ${RUN}`, members: { create: { userId: user.id, role: "OWNER" } } } });
    ids.users.push(user.id);
    ids.companies.push(company.id);
  }
  a = asWs({ id: ids.companies[0], name: "Co A" });
  b = asWs({ id: ids.companies[1], name: "Co B" });

  // Company A gets the sample data; B gets nothing.
  const data = northstarData(new Date("2026-10-06T12:00:00Z"));
  const source = await db.dataSource.create({ data: { companyId: a.id, kind: "SAMPLE", name: "Sample" } });
  const ds = await db.uploadedDataset.create({
    data: { companyId: a.id, dataSourceId: source.id, name: "s", fileName: "s.csv", fileSize: 1, rowCount: 24, columns: [], preview: [], rawCsv: "", status: "READY" },
  });
  await db.metric.createMany({
    data: toMetricRows(data).map((r) => ({ companyId: a.id, datasetId: ds.id, period: new Date(`${r.period}-01T00:00:00Z`), key: r.key, dimension: r.dimension, value: r.value })),
  });
  await db.company.update({ where: { id: a.id }, data: { dataVersion: 1 } });
});

afterAll(async () => {
  await db.company.deleteMany({ where: { id: { in: ids.companies } } });
  await db.user.deleteMany({ where: { id: { in: ids.users } } });
  await db.$disconnect();
});

describe("tenant isolation", () => {
  it("loads only the company's own metrics", async () => {
    const dataA = await loadBusinessData(a);
    const dataB = await loadBusinessData(b);
    expect(dataA.periods).toHaveLength(24);
    expect(dataA.metrics.revenue?.at(-1)).toBe(2_840_000);
    expect(dataB.periods).toEqual([]);
    expect(Object.keys(dataB.products)).toEqual([]);
  });

  it("writes analysis rows only for the company analyzed", async () => {
    const analysis = await refreshAnalysis(a.id);
    expect(analysis.insights.map((i) => i.key)).toContain("retention-decline");
    expect(await db.insight.count({ where: { companyId: a.id } })).toBe(analysis.insights.length);
    expect(await db.insight.count({ where: { companyId: b.id } })).toBe(0);
    await refreshAnalysis(b.id);
    expect(await db.insight.count({ where: { companyId: b.id } })).toBe(0);
    expect(await db.insight.count({ where: { companyId: a.id } })).toBe(analysis.insights.length);
  });

  it("keeps a status the team set when the analysis re-runs", async () => {
    await db.insight.update({ where: { companyId_key: { companyId: a.id, key: "cac-rising" } }, data: { status: "DISMISSED" } });
    await db.company.update({ where: { id: a.id }, data: { dataVersion: { increment: 1 } } });
    await refreshAnalysis(a.id);
    const row = await db.insight.findUnique({ where: { companyId_key: { companyId: a.id, key: "cac-rising" } } });
    expect(row?.status).toBe("DISMISSED");
    expect(row?.active).toBe(true);
  });

  it("deletes a company's data with the company", async () => {
    const count = await db.metric.count({ where: { companyId: a.id } });
    expect(count).toBeGreaterThan(500);
  });
});

describe("auth primitives", () => {
  it("hashes and verifies passwords with scrypt", async () => {
    const h = await hashPassword("correct horse battery");
    expect(h).toMatch(/^scrypt\$16384\$8\$1\$/);
    expect(await verifyPassword("correct horse battery", h)).toBe(true);
    expect(await verifyPassword("Correct horse battery", h)).toBe(false);
    expect(await verifyPassword("anything", "not-a-hash")).toBe(false);
  });

  it("stores tokens hashed", () => {
    const t = newToken();
    expect(t).toHaveLength(43);
    expect(hashToken(t)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashToken(t)).not.toContain(t);
  });

  it("blocks open redirects", () => {
    expect(safeNext("/app/insights")).toBe("/app/insights");
    expect(safeNext("//evil.com")).toBe("/app");
    expect(safeNext("/\\evil.com")).toBe("/app");
    expect(safeNext("https://evil.com")).toBe("/app");
    expect(safeNext(undefined)).toBe("/app");
  });
});
