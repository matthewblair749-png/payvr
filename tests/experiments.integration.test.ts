/**
 * Experiment Lab (real Postgres).
 */
import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { db } from "@/server/db";
import { parseConfig } from "@/server/dal/checkout-pages";
import { experimentDetail, finishExperiment, listExperiments, stopExperiment } from "@/server/dal/experiments";
import { runTool } from "@/server/research/tools";

const RUN = Math.random().toString(36).slice(2, 8);
let userId = "";
let merchantId = "";
let pageId = "";
let productId = "";

const bConfig = { ...DEMO_CONFIG, blocks: DEMO_CONFIG.blocks.map((b) => (b.type === "coupon" ? { ...b, hidden: true } : b)) };

async function newExperiment(opts: { metric?: string; priceB?: number; startedDaysAgo?: number } = {}) {
  return db.experiment.create({
    include: { variants: { orderBy: { key: "asc" } } },
    data: {
      merchantId,
      checkoutPageId: pageId,
      name: `Test ${Math.random().toString(36).slice(2, 6)}`,
      status: "RUNNING",
      primaryMetric: opts.metric ?? "conversion",
      startedAt: new Date(Date.now() - (opts.startedDaysAgo ?? 14) * 86_400_000),
      variants: {
        create: [
          { key: "A", name: "Original", isControl: true, weight: 50 },
          { key: "B", name: "No coupon", isControl: false, weight: 50, config: bConfig, publishedConfig: bConfig, priceCents: opts.priceB ?? null },
        ],
      },
    },
  });
}

/** n sessions for a variant, `paid` of them paying `cents`. */
async function traffic(variantId: string, n: number, paid: number, cents: number) {
  const events = [];
  const orders = [];
  const t0 = Date.now() - 5 * 86_400_000;
  for (let i = 0; i < n; i++) {
    const sessionId = crypto.randomUUID();
    const at = new Date(t0 + i * 60_000);
    events.push({ merchantId, checkoutPageId: pageId, variantId, sessionId, type: "VIEW" as const, createdAt: at });
    if (i < paid) {
      events.push({ merchantId, checkoutPageId: pageId, variantId, sessionId, type: "PAYMENT_SUCCEEDED" as const, createdAt: new Date(at.getTime() + 1000) });
      orders.push({ merchantId, checkoutPageId: pageId, variantId, sessionId, amountCents: cents, currency: "usd", status: "SUCCEEDED" as const, createdAt: at });
    }
  }
  await db.checkoutEvent.createMany({ data: events });
  await db.order.createMany({ data: orders });
}

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `ex-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "Ex" } })).id;
  productId = (await db.product.create({ data: { merchantId, name: "Print", priceCents: 2900 } })).id;
  const page = await db.checkoutPage.create({ data: { merchantId, productId, name: "Prints", slug: `ex-${RUN}`, draftConfig: DEMO_CONFIG } });
  const v = await db.checkoutPageVersion.create({ data: { checkoutPageId: page.id, number: 1, config: DEMO_CONFIG } });
  await db.checkoutPage.update({ where: { id: page.id }, data: { status: "PUBLISHED", publishedVersionId: v.id } });
  pageId = page.id;
});

afterAll(async () => {
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

describe("experiment results", () => {
  it("computes per-variant stats, verdict and what B changes", async () => {
    const exp = await newExperiment();
    await traffic(exp.variants[0].id, 600, 240, 2900); // 40%
    await traffic(exp.variants[1].id, 600, 300, 2900); // 50%
    const d = await experimentDetail(merchantId, exp.id);
    expect([d.variants.A.visits, d.variants.A.conversions, d.variants.B.visits, d.variants.B.conversions]).toEqual([600, 240, 600, 300]);
    expect(d.variants.B.sumCents).toBe(300 * 2900);
    expect(d.conversion.chanceBBetter).toBeGreaterThan(0.99);
    expect(d.verdict.status).toBe("b_better");
    expect(d.verdict.shipB).toBe(true);
    expect(d.changes).toContain("Hides the coupon field");
    expect(d.splitBroken).toBe(false);

    // The Research Assistant sees the same verdict.
    const tool = JSON.parse((await runTool({ merchantId, currency: "usd" }, "get_experiment_results", { checkout_id: pageId })).content);
    expect(tool[0].verdict.headline).toBe(d.verdict.headline);

    // Stop it so the next test can run (one per checkout).
    await stopExperiment(merchantId, exp.id);
    await expect(stopExperiment(merchantId, exp.id)).rejects.toThrow(/isn't running/);
    expect((await listExperiments(merchantId)).find((e) => e.id === exp.id)?.status).toBe("STOPPED");
  });

  it("ships a price-test winner: publishes B's design and price", async () => {
    const exp = await newExperiment({ metric: "revenue_per_visit", priceB: 3900 });
    await traffic(exp.variants[0].id, 800, 320, 2900); // $11.60 / visit
    await traffic(exp.variants[1].id, 800, 300, 3900); // $14.63 / visit
    const d = await experimentDetail(merchantId, exp.id);
    expect(d.revenue.chanceBBetter).toBeGreaterThan(0.95);
    expect(d.verdict.headline).toMatch(/earns more/);
    expect(d.changes).toContain("Charges $39 instead of $29");

    await finishExperiment(merchantId, exp.id, "B");
    const page = await db.checkoutPage.findUniqueOrThrow({ where: { id: pageId }, include: { publishedVersion: true } });
    expect(parseConfig(page.publishedVersion!.config).blocks.find((b) => b.type === "coupon")?.hidden).toBe(true);
    expect((await db.product.findUniqueOrThrow({ where: { id: productId } })).priceCents).toBe(3900);
    const done = await db.experiment.findUniqueOrThrow({ where: { id: exp.id } });
    expect(done.status).toBe("COMPLETED");
    expect(done.winnerVariantId).toBe(exp.variants[1].id);
    await expect(finishExperiment(merchantId, exp.id, "A")).rejects.toThrow(/already ended/);
  });

  it("keeping the original changes nothing", async () => {
    const before = await db.checkoutPage.findUniqueOrThrow({ where: { id: pageId } });
    const exp = await newExperiment();
    await finishExperiment(merchantId, exp.id, "A");
    const after = await db.checkoutPage.findUniqueOrThrow({ where: { id: pageId } });
    expect(after.publishedVersionId).toBe(before.publishedVersionId);
  });

  it("says too early with little data, and is merchant-scoped", async () => {
    const exp = await newExperiment({ startedDaysAgo: 2 });
    await traffic(exp.variants[0].id, 30, 12, 2900);
    await traffic(exp.variants[1].id, 30, 15, 2900);
    expect((await experimentDetail(merchantId, exp.id)).verdict.status).toBe("too_early");
    await expect(experimentDetail("someone-else", exp.id)).rejects.toThrow(/not found/);
    await expect(finishExperiment("someone-else", exp.id, "B")).rejects.toThrow(/not found/);
  });
});
