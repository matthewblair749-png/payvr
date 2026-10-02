/**
 * Home overview (real Postgres): totals, previous-period comparison and the
 * like-for-like windows.
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { periodWindows } from "@/lib/date-range";
import { db } from "@/server/db";
import { homeOverview } from "@/server/dal/home";

const RUN = Math.random().toString(36).slice(2, 8);
const DAY = 86_400_000;
const NOW = new Date("2026-06-15T12:00:00Z");
let userId = "";
let merchantId = "";

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `home-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "Home" } })).id;
  const checkoutPageId = (await db.checkoutPage.create({ data: { merchantId, name: "Mugs", slug: `home-${RUN}`, draftConfig: {} } })).id;
  const at = (daysAgo: number, hour = 10) => new Date(Date.UTC(2026, 5, 15 - daysAgo, hour));
  const sale = (daysAgo: number, cents: number, extra: object = {}) => ({
    merchantId,
    amountCents: cents,
    currency: "usd",
    status: "SUCCEEDED" as const,
    createdAt: at(daysAgo),
    ...extra,
  });
  await db.order.createMany({
    data: [
      // Current 7 days: $100, $50 fully refunded, $30 disputed.
      sale(0, 10000),
      sale(2, 5000, { status: "REFUNDED", refundedCents: 5000 }),
      sale(6, 3000, { status: "DISPUTED" }),
      // Previous 7 days: $40 and $40.
      sale(7, 4000),
      sale(13, 4000),
      // Later in the day than "now", one period back: excluded (like-for-like).
      { ...sale(7, 9900), createdAt: new Date(NOW.getTime() - 7 * DAY + 3_600_000) },
    ],
  });
  // 4 sessions this period (2 paid), 2 last period (1 paid).
  const sessions = [
    [0, true],
    [1, false],
    [3, true],
    [5, false],
    [8, true],
    [10, false],
  ] as const;
  await db.checkoutEvent.createMany({
    data: sessions.flatMap(([d, paid], i) => {
      const base = { merchantId, checkoutPageId, sessionId: `${RUN}-${i}`, createdAt: at(d, 9) };
      return paid
        ? [
            { ...base, type: "VIEW" as const },
            { ...base, type: "PAYMENT_SUCCEEDED" as const, createdAt: at(d, 9.5) },
          ]
        : [{ ...base, type: "VIEW" as const }];
    }),
  });
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("periodWindows", () => {
  it("ends now and mirrors the same time of day one period back", () => {
    const w = periodWindows(7, NOW);
    expect(w.current.from.toISOString()).toBe("2026-06-09T00:00:00.000Z");
    expect(w.current.to).toEqual(NOW);
    expect(w.previous.from.toISOString()).toBe("2026-06-02T00:00:00.000Z");
    expect(w.previous.to.toISOString()).toBe("2026-06-08T12:00:00.000Z");
  });
});

describe("homeOverview", () => {
  it("computes the North Star, the four tiles and the previous period", async () => {
    const o = await homeOverview(merchantId, "usd", 7, NOW);
    expect(o.series).toHaveLength(7);
    expect(o.series.at(-1)!.day).toBe("2026-06-15");
    expect(o.series.at(-1)!.prevDay).toBe("2026-06-08");
    // Revenue is net of refunds: 100 + 0 + 30.
    expect(o.current).toMatchObject({ revenueCents: 13000, orders: 3, aovCents: 4333, conversion: 0.5 });
    expect(o.current.issueRate).toBeCloseTo(2 / 3);
    expect(o.previous).toMatchObject({ revenueCents: 8000, orders: 2, aovCents: 4000, issueRate: 0, conversion: 0.5 });
    expect(o.series.reduce((s, d) => s + d.prevRevenueCents, 0)).toBe(8000);
  });

  it("answers fast enough for Home's 1-second budget on the demo data", async () => {
    const demo = await db.merchant.findFirst({ where: { user: { email: "demo@lumen.test" } } });
    if (!demo) return; // seed not loaded
    for (const days of [7, 30, 90]) {
      const t = performance.now();
      const o = await homeOverview(demo.id, demo.defaultCurrency, days);
      const ms = performance.now() - t;
      console.log(`homeOverview ${days}d: ${Math.round(ms)}ms`);
      expect(o.previous.revenueCents).toBeGreaterThan(0);
      expect(ms).toBeLessThan(800);
    }
  });
});
