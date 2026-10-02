import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { describeVariantChanges } from "@/lib/experiments/diff";
import {
  compareConversion,
  compareRevenue,
  conversionVerdict,
  revenueVerdict,
  splitLooksBroken,
  type ConversionResult,
  type RevenueResult,
  type Verdict,
} from "@/lib/experiments/stats";
import { db } from "../db";
import { UserError } from "../errors";
import { syncProductToStripe } from "../payments/catalog";
import { n, PAID_STATUSES } from "./analytics";
import { NotFoundError, parseConfig, publishPage } from "./checkout-pages";

/**
 * Experiment Lab data. Results are computed from checkout events (visits and
 * conversions per variant) and orders (revenue per visit), always scoped to
 * the merchant and the experiment's own time window.
 */

type VariantStats = { variantId: string; visits: number; conversions: number; sumCents: number; sumSqCents: number };

async function variantStats(merchantId: string, pageId: string, from: Date, to: Date, variantIds: string[]): Promise<VariantStats[]> {
  if (!variantIds.length) return [];
  // Lean per-session pass: only events tagged with this test's variants.
  const rows = await db.$queryRaw<{ variant_id: string; visits: bigint; conv: bigint; sum: Prisma.Decimal | null; sumsq: Prisma.Decimal | null }[]>`
    WITH s AS (
      SELECT "sessionId",
        (array_agg("variantId" ORDER BY "createdAt", id) FILTER (WHERE type = 'VIEW'))[1] AS variant_id,
        bool_or(type = 'PAYMENT_SUCCEEDED') AS paid
      FROM "CheckoutEvent"
      WHERE "checkoutPageId" = ${pageId} AND "merchantId" = ${merchantId}
        AND "createdAt" >= ${from} AND "createdAt" < ${to}
        AND "variantId" IN (${Prisma.join(variantIds)})
      GROUP BY 1
      HAVING bool_or(type = 'VIEW')
    ),
    rev AS (
      SELECT "sessionId", SUM("amountCents" - "refundedCents") AS cents
      FROM "Order"
      WHERE "merchantId" = ${merchantId} AND "checkoutPageId" = ${pageId} AND status IN ${PAID_STATUSES}
        AND "createdAt" >= ${from} AND "createdAt" < ${to} AND "variantId" IN (${Prisma.join(variantIds)})
      GROUP BY 1
    )
    SELECT s.variant_id, count(*) AS visits, count(*) FILTER (WHERE s.paid) AS conv,
      SUM(COALESCE(rev.cents, 0))::numeric AS sum, SUM(COALESCE(rev.cents, 0)::numeric ^ 2) AS sumsq
    FROM s LEFT JOIN rev ON rev."sessionId" = s."sessionId"
    GROUP BY 1`;
  return variantIds.map((id) => {
    const r = rows.find((x) => x.variant_id === id);
    return {
      variantId: id,
      visits: n(r?.visits),
      conversions: n(r?.conv),
      sumCents: Number(r?.sum ?? 0),
      sumSqCents: Number(r?.sumsq ?? 0),
    };
  });
}

async function dailyByVariant(merchantId: string, pageId: string, from: Date, to: Date, variantIds: string[]) {
  if (!variantIds.length) return [];
  const rows = await db.$queryRaw<{ day: Date; variant_id: string; visits: bigint; conv: bigint }[]>`
    WITH s AS (
      SELECT "sessionId", MIN("createdAt") AS started,
        (array_agg("variantId" ORDER BY "createdAt", id) FILTER (WHERE type = 'VIEW'))[1] AS variant_id,
        bool_or(type = 'PAYMENT_SUCCEEDED') AS paid
      FROM "CheckoutEvent"
      WHERE "checkoutPageId" = ${pageId} AND "merchantId" = ${merchantId}
        AND "createdAt" >= ${from} AND "createdAt" < ${to}
        AND "variantId" IN (${Prisma.join(variantIds)})
      GROUP BY 1
      HAVING bool_or(type = 'VIEW')
    )
    SELECT date_trunc('day', started) AS day, variant_id, count(*) AS visits, count(*) FILTER (WHERE paid) AS conv
    FROM s GROUP BY 1, 2 ORDER BY 1`;
  return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), variantId: r.variant_id, visits: n(r.visits), conversions: n(r.conv) }));
}

export type ExperimentSummary = {
  id: string;
  name: string;
  status: string;
  checkoutName: string;
  checkoutId: string;
  startedAt: string | null;
  endedAt: string | null;
  metric: "conversion" | "revenue_per_visit";
  visits: number;
  verdict: Verdict;
  chanceBBetter: number | null;
  winnerKey: string | null;
};

type Analysis = {
  stats: { A: VariantStats; B: VariantStats };
  conversion: ConversionResult;
  revenue: RevenueResult;
  verdict: Verdict;
  daysRunning: number;
  splitBroken: boolean;
};

function analyze(
  exp: { primaryMetric: string; startedAt: Date | null; createdAt: Date; endedAt: Date | null },
  A: VariantStats,
  B: VariantStats,
  weights: { A: number; B: number },
  currency: string,
): Analysis {
  const start = exp.startedAt ?? exp.createdAt;
  const end = exp.endedAt ?? new Date();
  const daysRunning = Math.max(0, (end.getTime() - start.getTime()) / 86_400_000);
  const dailyPerVariant = daysRunning > 0 ? (A.visits + B.visits) / 2 / Math.max(1, daysRunning) : 0;
  const conversion = compareConversion({ visits: A.visits, conversions: A.conversions }, { visits: B.visits, conversions: B.conversions });
  const revenue = compareRevenue(
    { visits: A.visits, sumCents: A.sumCents, sumSqCents: A.sumSqCents },
    { visits: B.visits, sumCents: B.sumCents, sumSqCents: B.sumSqCents },
  );
  const common = { visitsA: A.visits, visitsB: B.visits, daysRunning: Math.floor(daysRunning), dailyPerVariant };
  const verdict =
    exp.primaryMetric === "revenue_per_visit"
      ? revenueVerdict({ ...common, result: revenue, currency })
      : conversionVerdict({ ...common, result: conversion });
  return { stats: { A, B }, conversion, revenue, verdict, daysRunning, splitBroken: splitLooksBroken(A.visits, B.visits, weights.A, weights.B) };
}

const include = {
  variants: { orderBy: { key: "asc" as const } },
  checkoutPage: { select: { id: true, name: true, slug: true, product: { select: { currency: true, priceCents: true } } } },
};

async function analyzeExperiment(merchantId: string, exp: Prisma.ExperimentGetPayload<{ include: typeof include }>) {
  const a = exp.variants.find((v) => v.key === "A");
  const b = exp.variants.find((v) => v.key === "B");
  if (!a || !b) return null;
  const from = exp.startedAt ?? exp.createdAt;
  const to = exp.endedAt ?? new Date(Date.now() + 60_000);
  const [A, B] = await variantStats(merchantId, exp.checkoutPageId, from, to, [a.id, b.id]);
  const currency = (exp.checkoutPage.product?.currency ?? "usd").toUpperCase();
  return { a, b, from, to, currency, ...analyze(exp, A, B, { A: a.weight, B: b.weight }, currency) };
}

export async function listExperiments(merchantId: string): Promise<ExperimentSummary[]> {
  const exps = await db.experiment.findMany({
    where: { merchantId, status: { in: ["RUNNING", "COMPLETED", "STOPPED"] } },
    orderBy: [{ status: "asc" }, { startedAt: "desc" }],
    include,
  });
  const out: ExperimentSummary[] = [];
  for (const e of exps) {
    const r = await analyzeExperiment(merchantId, e);
    if (!r) continue;
    out.push({
      id: e.id,
      name: e.name,
      status: e.status,
      checkoutName: e.checkoutPage.name,
      checkoutId: e.checkoutPage.id,
      startedAt: e.startedAt?.toISOString() ?? null,
      endedAt: e.endedAt?.toISOString() ?? null,
      metric: e.primaryMetric === "revenue_per_visit" ? "revenue_per_visit" : "conversion",
      visits: r.stats.A.visits + r.stats.B.visits,
      verdict: r.verdict,
      chanceBBetter: e.primaryMetric === "revenue_per_visit" ? r.revenue.chanceBBetter : r.conversion.chanceBBetter,
      winnerKey: e.variants.find((v) => v.id === e.winnerVariantId)?.key ?? null,
    });
  }
  return out;
}

export async function experimentDetail(merchantId: string, id: string) {
  const exp = await db.experiment.findFirst({ where: { id, merchantId }, include });
  if (!exp) throw new NotFoundError("Experiment not found");
  const r = await analyzeExperiment(merchantId, exp);
  if (!r) throw new NotFoundError("Experiment has no variants");

  const page = await db.checkoutPage.findFirst({ where: { id: exp.checkoutPageId, merchantId }, include: { publishedVersion: true } });
  const baseConfig = parseConfig(page?.publishedVersion?.config ?? page?.draftConfig);
  const bConfig = r.b.publishedConfig ?? r.b.config ? parseConfig(r.b.publishedConfig ?? r.b.config) : baseConfig;

  const [daily, survey] = await Promise.all([
    dailyByVariant(merchantId, exp.checkoutPageId, r.from, r.to, [r.a.id, r.b.id]),
    db.surveyResponse.groupBy({
      by: ["question", "answer", "variantId"],
      where: { merchantId, checkoutPageId: exp.checkoutPageId, variantId: { in: [r.a.id, r.b.id] }, createdAt: { gte: r.from, lt: r.to } },
      _count: { _all: true },
    }),
  ]);

  return {
    id: exp.id,
    name: exp.name,
    hypothesis: exp.hypothesis,
    status: exp.status,
    metric: (exp.primaryMetric === "revenue_per_visit" ? "revenue_per_visit" : "conversion") as "conversion" | "revenue_per_visit",
    checkout: { id: exp.checkoutPage.id, name: exp.checkoutPage.name, slug: exp.checkoutPage.slug },
    currency: r.currency,
    startedAt: r.from.toISOString(),
    endedAt: exp.endedAt?.toISOString() ?? null,
    daysRunning: r.daysRunning,
    winnerKey: exp.variants.find((v) => v.id === exp.winnerVariantId)?.key ?? null,
    variants: {
      A: { id: r.a.id, name: r.a.name, weight: r.a.weight, ...r.stats.A, priceCents: r.a.priceCents ?? exp.checkoutPage.product?.priceCents ?? null },
      B: { id: r.b.id, name: r.b.name, weight: r.b.weight, ...r.stats.B, priceCents: r.b.priceCents ?? exp.checkoutPage.product?.priceCents ?? null },
    },
    changes: describeVariantChanges(baseConfig, bConfig, {
      basePriceCents: exp.checkoutPage.product?.priceCents ?? null,
      variantPriceCents: r.b.priceCents,
      currency: r.currency,
    }),
    conversion: r.conversion,
    revenue: r.revenue,
    verdict: r.verdict,
    splitBroken: r.splitBroken,
    daily: daily.map((d) => ({ ...d, key: d.variantId === r.a.id ? "A" : "B" })),
    survey: survey.map((s) => ({ question: s.question, answer: s.answer, key: s.variantId === r.a.id ? "A" : "B", count: s._count._all })),
  };
}
export type ExperimentDetail = Awaited<ReturnType<typeof experimentDetail>>;

/** Stop without a winner: everyone sees the original again. */
export async function stopExperiment(merchantId: string, id: string) {
  const { count } = await db.experiment.updateMany({
    where: { id, merchantId, status: { in: ["RUNNING", "DRAFT"] } },
    data: { status: "STOPPED", endedAt: new Date() },
  });
  if (!count) throw new UserError("That test isn't running.");
}

/**
 * Finish the test with a winner. Shipping B publishes B's design (and price,
 * for price tests) as the checkout everyone sees. Keeping A just ends the test.
 */
export async function finishExperiment(merchantId: string, id: string, winner: "A" | "B") {
  const exp = await db.experiment.findFirst({ where: { id, merchantId }, include: { variants: true, checkoutPage: true } });
  if (!exp) throw new NotFoundError("Experiment not found");
  if (exp.status !== "RUNNING") throw new UserError("That test has already ended.");
  const variant = exp.variants.find((v) => v.key === winner);
  if (!variant) throw new UserError("Unknown variant");

  // End the test first so publishing doesn't treat it as a draft experiment.
  await db.experiment.update({ where: { id }, data: { status: "COMPLETED", endedAt: new Date(), winnerVariantId: variant.id } });

  if (winner === "B") {
    const config = variant.publishedConfig ?? variant.config;
    if (config) {
      await db.checkoutPage.update({ where: { id: exp.checkoutPageId }, data: { draftConfig: config as Prisma.InputJsonValue } });
      await publishPage(merchantId, exp.checkoutPageId, { note: `Shipped from test: ${exp.name}`.slice(0, 120) });
    }
    if (variant.priceCents != null && exp.checkoutPage.productId) {
      await db.product.update({ where: { id: exp.checkoutPage.productId }, data: { priceCents: variant.priceCents } });
      void syncProductToStripe(exp.checkoutPage.productId);
    }
  }
  return { shipped: winner === "B" };
}
