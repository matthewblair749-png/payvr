/**
 * Live feed, "Why they buy" and the experiment card (real Postgres).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { experimentStatusLine } from "@/lib/experiments/plain";
import type { Verdict } from "@/lib/experiments/stats";
import { db } from "@/server/db";
import { experimentCard, recentSales, whyTheyBuy } from "@/server/dal/activity";

const RUN = Math.random().toString(36).slice(2, 8);
const NOW = new Date("2026-06-15T12:00:00Z");
let userId = "";
let merchantId = "";

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `act-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "Act" } })).id;
  const at = (daysAgo: number) => new Date(NOW.getTime() - daysAgo * 86_400_000);
  const answer = (question: string, a: string, daysAgo: number, n: number) => Array.from({ length: n }, () => ({ merchantId, question, answer: a, createdAt: at(daysAgo) }));
  await db.surveyResponse.createMany({
    data: [
      ...answer("why_bought", "design", 2, 12),
      ...answer("why_bought", "other", 2, 20),
      ...answer("why_bought", "gift", 3, 8),
      ...answer("nearly_stopped", "price", 2, 50),
      // Previous 7 days: gifts were bigger.
      ...answer("why_bought", "gift", 9, 15),
      ...answer("why_bought", "design", 9, 5),
    ],
  });
  await db.order.createMany({
    data: [
      { merchantId, amountCents: 4800, currency: "usd", status: "SUCCEEDED", country: "CA", createdAt: at(0.01) },
      { merchantId, amountCents: 8500, currency: "usd", status: "FAILED", createdAt: at(0.005) },
      { merchantId, amountCents: 5200, currency: "usd", status: "REFUNDED", refundedCents: 5200, createdAt: at(0.02), customerEmail: "secret@example.com" },
    ],
  });
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("recentSales", () => {
  it("lists paid orders newest first, never failed ones, never emails", async () => {
    const sales = await recentSales(merchantId);
    expect(sales.map((s) => s.amountCents)).toEqual([4800, 5200]);
    expect(JSON.stringify(sales)).not.toContain("secret@example.com");
  });
});

describe("whyTheyBuy", () => {
  it("ranks 'what made you buy' answers with catch-alls last and the previous share", async () => {
    const w = await whyTheyBuy(merchantId, 7, NOW);
    expect(w!.question).toBe("why_bought"); // preferred even though another question has more answers
    expect(w!.answers.map((a) => a.key)).toEqual(["design", "gift", "other"]);
    expect(w!.total).toBe(40);
    expect(w!.answers[1]).toMatchObject({ label: "It's a gift", share: 0.2, prevShare: 0.75 });
  });

  it("returns nothing with no answers", async () => {
    expect(await whyTheyBuy(merchantId, 7, new Date("2020-01-01T00:00:00Z"))).toBeNull();
  });
});

describe("experimentStatusLine", () => {
  const v = (status: Verdict["status"], daysLeft: number | null = null): Verdict => ({ status, headline: "x", detail: "", daysLeft, shipB: false });
  const variants = { A: { name: "$48 (original)", visits: 1000, conversions: 370, perVisitCents: 1776 }, B: { name: "$52", visits: 1000, conversions: 370, perVisitCents: 1924 } };
  const card = (over: object) => ({ status: "RUNNING" as const, metric: "conversion" as const, winnerKey: null, verdict: v("too_early", 3), variants, ...over });

  it("says where a running test stands, in plain words", () => {
    expect(experimentStatusLine(card({ verdict: v("leaning_b", 2) }))).toBe("Variant B is ahead, but we need about 2 more days to be sure.");
    expect(experimentStatusLine(card({ verdict: v("leaning_b", 1) }))).toBe("Variant B is ahead, but we need about 1 more day to be sure.");
    expect(experimentStatusLine(card({ verdict: v("too_early", 3) }))).toBe("Too early to tell. Check back in about 3 days.");
    expect(experimentStatusLine(card({ verdict: v("b_better") }))).toBe("Variant B is very likely better. You can ship it.");
  });

  it("says who won a finished test and by how much", () => {
    expect(experimentStatusLine(card({ status: "COMPLETED", metric: "revenue_per_visit", winnerKey: "B" }))).toBe("“$52” won, earning about 8% more per visit. It's live now.");
    expect(experimentStatusLine(card({ status: "COMPLETED", winnerKey: "A" }))).toMatch(/original won/);
  });
});

describe("demo story", () => {
  it("has a running test on Home and a shipped, winning price test behind it", async () => {
    const demo = await db.merchant.findFirst({ where: { user: { email: "demo@lumen.test" } } });
    if (!demo) return;
    const card = await experimentCard(demo.id);
    console.log("running test:", card?.name, card?.verdict.status, card?.verdict.daysLeft, Math.round((card?.chanceBBetter ?? 0) * 100) + "%", JSON.stringify(card?.variants), "→", card && experimentStatusLine(card));
    expect(card).toMatchObject({ status: "RUNNING", name: "Social proof first" });

    const past = await db.experiment.findFirstOrThrow({ where: { merchantId: demo.id, status: "COMPLETED" }, include: { variants: true } });
    const { experimentDetail } = await import("@/server/dal/experiments");
    const d = await experimentDetail(demo.id, past.id);
    console.log("price test:", d.name, d.verdict.status, Math.round(d.revenue.chanceBBetter * 100) + "%", d.verdict.headline);
    expect(d.winnerKey).toBe("B");
    expect(d.revenue.chanceBBetter).toBeGreaterThan(0.9);
    expect((await db.product.findFirstOrThrow({ where: { merchantId: demo.id, name: "Speckled mug set" } })).priceCents).toBe(5200);
  });
});
