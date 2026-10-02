/**
 * Critical alerts (real Postgres): only real emergencies, never noise.
 */
import "dotenv/config";
import { afterAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/server/db";
import { criticalAlerts } from "@/server/dal/alerts";

const RUN = Math.random().toString(36).slice(2, 8);
const NOW = new Date("2026-06-15T12:00:00Z");
const userIds: string[] = [];
const HOUR = 3_600_000;

async function shop(tag: string, orders: { status: "SUCCEEDED" | "FAILED" | "DISPUTED"; hoursAgo: number; n: number }[], extra: object = {}) {
  const user = await db.user.create({ data: { email: `al-${tag}-${RUN}@lumen.test` } });
  userIds.push(user.id);
  const m = await db.merchant.create({ data: { userId: user.id, name: tag, ...extra } });
  await db.order.createMany({
    data: orders.flatMap((o) =>
      Array.from({ length: o.n }, () => {
        const at = new Date(NOW.getTime() - o.hoursAgo * HOUR);
        return { merchantId: m.id, amountCents: 5200, currency: "usd", status: o.status, createdAt: at, updatedAt: at };
      }),
    ),
  });
  return m;
}

afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("criticalAlerts", () => {
  it("stays quiet on a normal day", async () => {
    const m = await shop("calm", [
      { status: "SUCCEEDED", hoursAgo: 5, n: 40 },
      { status: "FAILED", hoursAgo: 5, n: 3 },
      { status: "SUCCEEDED", hoursAgo: 100, n: 200 },
      { status: "FAILED", hoursAgo: 100, n: 12 },
    ]);
    expect(await criticalAlerts(m, NOW)).toEqual([]);
  });

  it("flags a failed-payment spike against the shop's own normal", async () => {
    const m = await shop("spike", [
      { status: "SUCCEEDED", hoursAgo: 5, n: 20 },
      { status: "FAILED", hoursAgo: 5, n: 10 },
      { status: "SUCCEEDED", hoursAgo: 100, n: 200 },
      { status: "FAILED", hoursAgo: 100, n: 12 },
    ]);
    const [a] = await criticalAlerts(m, NOW);
    expect(a).toMatchObject({ kind: "failures", title: "Payments are failing more than usual" });
    expect(a.body).toMatch(/^33% of payment attempts failed in the last 24 hours \(10 of 30\), against 6% normally/);
  });

  it("doesn't call a handful of failures a spike", async () => {
    const m = await shop("tiny", [
      { status: "SUCCEEDED", hoursAgo: 5, n: 5 },
      { status: "FAILED", hoursAgo: 5, n: 5 },
    ]);
    expect(await criticalAlerts(m, NOW)).toEqual([]);
  });

  it("flags new disputes and paused payouts", async () => {
    const m = await shop("disputed", [{ status: "DISPUTED", hoursAgo: 30, n: 2 }], {
      stripeAccountId: `acct_${RUN}`,
      stripeChargesEnabled: true,
      stripePayoutsEnabled: false,
    });
    const alerts = await criticalAlerts(m, NOW);
    expect(alerts.map((a) => a.kind)).toEqual(["dispute", "payouts"]);
    expect(alerts[0]).toMatchObject({ title: "2 payments were disputed" });
    expect(alerts[0].body).toMatch(/^\$104 is on hold/);
  });
});
