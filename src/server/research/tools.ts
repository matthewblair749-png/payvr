import "server-only";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { parseConfig } from "../dal/checkout-pages";
import { experimentDetail } from "../dal/experiments";
import { n, PAID_STATUSES, sessionsCte, type AnalyticsFilter } from "../dal/analytics";
import { db } from "../db";
import { proposalChangeSchema, describeChange, createProposal } from "./proposals";
import { funnelDrilldown, funnelOverview } from "../dal/funnel";
import { SOURCE_LABELS, type Source } from "@/lib/tracking/source";
import { SURVEY_QUESTION_KEYS } from "@/lib/survey/questions";

/**
 * Research tools: read-only, merchant-scoped queries the Research Assistant
 * (and the insight engine) use to answer questions with real numbers.
 *
 * Every tool has a zod schema. The Claude tool definitions are generated from
 * those schemas, and every model-supplied input is re-validated here before
 * running (inputs are untrusted). Dimensions are whitelisted, never
 * interpolated from model text.
 */

export type ToolContext = { merchantId: string; currency: string };

// ---------------------------------------------------------------------------
// Dates

const day = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD");
const rangeShape = {
  from: day.describe("First day, inclusive (YYYY-MM-DD, UTC)"),
  to: day.describe("Last day, inclusive (YYYY-MM-DD, UTC)"),
};

export function toRange(from: string, to: string) {
  const start = new Date(`${from}T00:00:00Z`);
  const end = new Date(`${to}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) throw new ToolInputError("Invalid date");
  if (end < start) throw new ToolInputError("`to` is before `from`");
  const endExclusive = new Date(end.getTime() + 86_400_000);
  if (endExclusive.getTime() - start.getTime() > 400 * 86_400_000) throw new ToolInputError("Range is limited to 400 days");
  return { from: start, to: endExclusive };
}

export class ToolInputError extends Error {}

const checkoutId = z.string().min(1).max(40).describe("Checkout page id from list_checkouts").optional();

function filter(ctx: ToolContext, from: string, to: string, pageId?: string): AnalyticsFilter {
  return { merchantId: ctx.merchantId, currency: ctx.currency, ...toRange(from, to), pageId: pageId ?? null };
}

const round = (x: number, d = 3) => Math.round(x * 10 ** d) / 10 ** d;
const rate = (a: number, b: number) => (b > 0 ? round(a / b) : null);

// ---------------------------------------------------------------------------
// list_checkouts

const listCheckoutsInput = z.object({});

async function listCheckouts(ctx: ToolContext) {
  const pages = await db.checkoutPage.findMany({
    where: { merchantId: ctx.merchantId, status: { not: "ARCHIVED" } },
    include: {
      product: true,
      publishedVersion: { select: { config: true } },
      experiments: { where: { status: { in: ["DRAFT", "RUNNING"] } }, include: { variants: true } },
    },
  });
  return pages.map((p) => {
    const config = parseConfig(p.publishedVersion?.config ?? p.draftConfig);
    const exp = p.experiments[0];
    return {
      id: p.id,
      name: p.name,
      url: `/pay/${p.slug}`,
      status: p.status,
      product: p.product ? { name: p.product.name, price_cents: p.product.priceCents, currency: p.product.currency } : null,
      visible_blocks: config.blocks.filter((b) => !b.hidden).map((b) => b.type),
      hidden_blocks: config.blocks.filter((b) => b.hidden).map((b) => b.type),
      theme: config.theme,
      survey_question: config.survey.enabled ? config.survey.question : null,
      active_experiment: exp
        ? {
            id: exp.id,
            name: exp.name,
            status: exp.status,
            started: exp.startedAt?.toISOString().slice(0, 10) ?? null,
            variants: exp.variants.map((v) => ({ key: v.key, name: v.name, weight: v.weight, price_cents: v.priceCents })),
          }
        : null,
    };
  });
}

// ---------------------------------------------------------------------------
// get_daily_metrics

const dailyInput = z.object({
  ...rangeShape,
  checkout_id: checkoutId,
  device: z.enum(["mobile", "desktop", "tablet"]).optional(),
  country: z.string().regex(/^[A-Z]{2}$/).optional().describe("ISO country code, e.g. CA"),
});

async function dailyMetrics(ctx: ToolContext, i: z.infer<typeof dailyInput>) {
  const f = filter(ctx, i.from, i.to, i.checkout_id);
  const seg = Prisma.sql`${i.device ? Prisma.sql`AND device = ${i.device}` : Prisma.empty} ${i.country ? Prisma.sql`AND country = ${i.country}` : Prisma.empty}`;
  const rows = await db.$queryRaw<{ day: Date; sessions: bigint; paid: bigint }[]>`
    WITH ${sessionsCte(f)}
    SELECT date_trunc('day', started) AS day, count(*) AS sessions, count(*) FILTER (WHERE rank = 5) AS paid
    FROM sessions WHERE true ${seg} GROUP BY 1 ORDER BY 1`;
  const orders = await db.$queryRaw<{ day: Date; revenue: bigint | null; failed: bigint; paid_orders: bigint }[]>`
    SELECT date_trunc('day', "createdAt") AS day,
      SUM("amountCents" - "refundedCents") FILTER (WHERE status IN ${PAID_STATUSES} AND currency = ${ctx.currency}) AS revenue,
      count(*) FILTER (WHERE status IN ${PAID_STATUSES}) AS paid_orders,
      count(*) FILTER (WHERE status = 'FAILED') AS failed
    FROM "Order"
    WHERE "merchantId" = ${ctx.merchantId} AND "createdAt" >= ${f.from} AND "createdAt" < ${f.to}
      ${i.checkout_id ? Prisma.sql`AND "checkoutPageId" = ${i.checkout_id}` : Prisma.empty}
      ${i.device ? Prisma.sql`AND device = ${i.device}` : Prisma.empty}
      ${i.country ? Prisma.sql`AND country = ${i.country}` : Prisma.empty}
    GROUP BY 1`;
  const byDay = new Map(orders.map((o) => [o.day.toISOString().slice(0, 10), o]));
  const sessionsByDay = new Map(rows.map((r) => [r.day.toISOString().slice(0, 10), r]));
  // Every day in the range, quiet ones included (zero visits is still a day).
  const days: string[] = [];
  for (let t = Date.UTC(f.from.getUTCFullYear(), f.from.getUTCMonth(), f.from.getUTCDate()); t < f.to.getTime(); t += 86_400_000) {
    days.push(new Date(t).toISOString().slice(0, 10));
  }
  return {
    currency: ctx.currency,
    days: days.map((d) => {
      const r = sessionsByDay.get(d);
      const o = byDay.get(d);
      return {
        day: d,
        weekday: new Date(`${d}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" }),
        visits: n(r?.sessions),
        paid_visits: n(r?.paid),
        conversion: rate(n(r?.paid), n(r?.sessions)),
        revenue_cents: n(o?.revenue),
        failed_payments: n(o?.failed),
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// compare_segments

const DIMENSIONS = {
  device: Prisma.sql`device`,
  country: Prisma.sql`COALESCE(country, 'unknown')`,
  variant: Prisma.sql`COALESCE(variant_id, 'none')`,
  checkout: Prisma.sql`page_id`,
  weekday: Prisma.sql`to_char(started, 'Dy')`,
  hour_of_day: Prisma.sql`extract(hour from started)::int::text`,
} as const;

const compareInput = z.object({
  ...rangeShape,
  dimension: z.enum(["device", "country", "variant", "checkout", "weekday", "hour_of_day"]),
  checkout_id: checkoutId,
  baseline_from: day.optional().describe("Optional comparison period start (e.g. the week before)"),
  baseline_to: day.optional(),
});

async function segmentRows(f: AnalyticsFilter, dimension: keyof typeof DIMENSIONS) {
  const rows = await db.$queryRaw<{ segment: string; sessions: bigint; paid: bigint; reached_payment: bigint }[]>`
    WITH ${sessionsCte(f)}
    SELECT ${DIMENSIONS[dimension]} AS segment, count(*) AS sessions,
      count(*) FILTER (WHERE rank = 5) AS paid, count(*) FILTER (WHERE rank >= 3) AS reached_payment
    FROM sessions GROUP BY 1 ORDER BY 2 DESC LIMIT 40`;
  return rows.map((r) => ({
    segment: r.segment,
    visits: n(r.sessions),
    conversion: rate(n(r.paid), n(r.sessions)),
    paid_after_starting_payment: rate(n(r.paid), n(r.reached_payment)),
  }));
}

async function compareSegments(ctx: ToolContext, i: z.infer<typeof compareInput>) {
  const current = await segmentRows(filter(ctx, i.from, i.to, i.checkout_id), i.dimension);
  if (!i.baseline_from || !i.baseline_to) return { dimension: i.dimension, segments: current };
  const base = await segmentRows(filter(ctx, i.baseline_from, i.baseline_to, i.checkout_id), i.dimension);
  const byKey = new Map(base.map((b) => [b.segment, b]));
  return {
    dimension: i.dimension,
    segments: current.map((c) => {
      const b = byKey.get(c.segment);
      return {
        ...c,
        baseline_visits: b?.visits ?? 0,
        baseline_conversion: b?.conversion ?? null,
        conversion_change_points: c.conversion != null && b?.conversion != null ? round((c.conversion - b.conversion) * 100, 1) : null,
      };
    }),
  };
}

// ---------------------------------------------------------------------------
// get_funnel

const funnelInput = z.object({ ...rangeShape, checkout_id: checkoutId, device: z.enum(["mobile", "desktop", "tablet"]).optional() });

async function getFunnel(ctx: ToolContext, i: z.infer<typeof funnelInput>) {
  const f = filter(ctx, i.from, i.to, i.checkout_id);
  const dev = i.device ? Prisma.sql`AND device = ${i.device}` : Prisma.empty;
  const [steps] = await db.$queryRaw<{ v: bigint; e: bigint; p: bigint; s: bigint; paid: bigint }[]>`
    WITH ${sessionsCte(f)}
    SELECT count(*) AS v, count(*) FILTER (WHERE rank >= 2) AS e, count(*) FILTER (WHERE rank >= 3) AS p,
      count(*) FILTER (WHERE rank >= 4) AS s, count(*) FILTER (WHERE rank >= 5) AS paid
    FROM sessions WHERE true ${dev}`;
  const exits = await db.$queryRaw<{ field: string; touched: bigint; exits: bigint }[]>`
    WITH ${sessionsCte(f)},
    t AS (SELECT fld AS field, count(*) AS touched FROM sessions, unnest(fields) fld WHERE true ${dev} GROUP BY 1),
    x AS (SELECT last_field AS field, count(*) AS exits FROM sessions WHERE rank < 5 AND last_field IS NOT NULL ${dev} GROUP BY 1)
    SELECT t.field, t.touched, COALESCE(x.exits, 0) AS exits FROM t LEFT JOIN x USING (field) ORDER BY 3 DESC`;
  return {
    funnel: {
      viewed: n(steps?.v),
      interacted: n(steps?.e),
      started_payment: n(steps?.p),
      pressed_pay: n(steps?.s),
      paid: n(steps?.paid),
    },
    last_thing_touched_before_leaving: exits.map((x) => ({
      field: x.field,
      touched: n(x.touched),
      left_after: n(x.exits),
      exit_rate: rate(n(x.exits), n(x.touched)),
    })),
  };
}

// ---------------------------------------------------------------------------
// get_payment_failures

const failuresInput = z.object({
  ...rangeShape,
  checkout_id: checkoutId,
  group_by: z.array(z.enum(["country", "payment_method", "device", "hour_of_day"])).min(1).max(3),
});

const ORDER_DIMS = {
  country: Prisma.sql`COALESCE(country, 'unknown')`,
  payment_method: Prisma.sql`COALESCE("paymentMethod", 'unknown')`,
  device: Prisma.sql`COALESCE(device, 'unknown')`,
  hour_of_day: Prisma.sql`extract(hour from "createdAt")::int::text`,
} as const;

async function paymentFailures(ctx: ToolContext, i: z.infer<typeof failuresInput>) {
  const { from, to } = toRange(i.from, i.to);
  const dims = [...new Set(i.group_by)];
  const cols = Prisma.join(dims.map((d, k) => Prisma.sql`${ORDER_DIMS[d]} AS ${Prisma.raw(`g${k}`)}`));
  const groupBy = Prisma.raw(dims.map((_, k) => String(k + 1)).join(", "));
  const pageF = i.checkout_id ? Prisma.sql`AND "checkoutPageId" = ${i.checkout_id}` : Prisma.empty;
  const rows = await db.$queryRaw<Record<string, string | bigint>[]>`
    SELECT ${cols}, count(*) AS attempts, count(*) FILTER (WHERE status = 'FAILED') AS failed
    FROM "Order"
    WHERE "merchantId" = ${ctx.merchantId} AND status <> 'PENDING' AND "createdAt" >= ${from} AND "createdAt" < ${to} ${pageF}
    GROUP BY ${groupBy} HAVING count(*) >= 3 ORDER BY 3 DESC LIMIT 60`;
  const reasons = await db.$queryRaw<{ reason: string; c: bigint }[]>`
    SELECT "failureMessage" AS reason, count(*) AS c FROM "Order"
    WHERE "merchantId" = ${ctx.merchantId} AND status = 'FAILED' AND "createdAt" >= ${from} AND "createdAt" < ${to} ${pageF}
    GROUP BY 1 ORDER BY 2 DESC LIMIT 5`;
  return {
    groups: rows.map((r) => ({
      ...Object.fromEntries(dims.map((d, k) => [d, String(r[`g${k}`])])),
      attempts: n(r.attempts as bigint),
      failed: n(r.failed as bigint),
      failure_rate: rate(n(r.failed as bigint), n(r.attempts as bigint)),
    })),
    top_decline_reasons: reasons.map((r) => ({ reason: r.reason, count: n(r.c) })),
  };
}

// ---------------------------------------------------------------------------
// get_survey_answers

const surveyInput = z.object({
  ...rangeShape,
  question: z.enum(SURVEY_QUESTION_KEYS).optional(),
  checkout_id: checkoutId,
  by_variant: z.boolean().optional(),
});

async function surveyAnswers(ctx: ToolContext, i: z.infer<typeof surveyInput>) {
  const { from, to } = toRange(i.from, i.to);
  const rows = await db.surveyResponse.groupBy({
    by: i.by_variant ? ["question", "answer", "variantId"] : ["question", "answer"],
    where: {
      merchantId: ctx.merchantId,
      createdAt: { gte: from, lt: to },
      ...(i.question ? { question: i.question } : {}),
      ...(i.checkout_id ? { checkoutPageId: i.checkout_id } : {}),
    },
    _count: { _all: true },
  });
  return rows
    .map((r) => ({ question: r.question, answer: r.answer, ...("variantId" in r ? { variant_id: r.variantId } : {}), count: r._count._all }))
    .sort((a, b) => b.count - a.count);
}

// ---------------------------------------------------------------------------
// get_experiment_results

const experimentInput = z.object({ checkout_id: z.string().min(1).max(40) });

async function experimentResults(ctx: ToolContext, i: z.infer<typeof experimentInput>) {
  // Same numbers and verdicts as the Experiment Lab, so chat and UI always agree.
  const exps = await db.experiment.findMany({
    where: { merchantId: ctx.merchantId, checkoutPageId: i.checkout_id, status: { in: ["RUNNING", "COMPLETED", "STOPPED"] } },
    orderBy: { createdAt: "desc" },
    take: 5,
    select: { id: true },
  });
  const out = [];
  for (const { id } of exps) {
    const d = await experimentDetail(ctx.merchantId, id);
    out.push({
      id: d.id,
      name: d.name,
      hypothesis: d.hypothesis,
      status: d.status,
      metric: d.metric,
      started: d.startedAt.slice(0, 10),
      ended: d.endedAt?.slice(0, 10) ?? null,
      winner: d.winnerKey,
      what_b_changes: d.changes,
      variants: (["A", "B"] as const).map((k) => ({
        key: k,
        name: d.variants[k].name,
        visits: d.variants[k].visits,
        conversion: rate(d.variants[k].conversions, d.variants[k].visits),
        revenue_per_visit_cents: d.variants[k].visits ? Math.round(d.variants[k].sumCents / d.variants[k].visits) : null,
        price_cents: d.variants[k].priceCents,
      })),
      chance_b_is_better: round(d.metric === "revenue_per_visit" ? d.revenue.chanceBBetter : d.conversion.chanceBBetter),
      verdict: { headline: d.verdict.headline, detail: d.verdict.detail, days_left: d.verdict.daysLeft },
      traffic_split_looks_broken: d.splitBroken,
    });
  }
  return out;
}

// ---------------------------------------------------------------------------
// propose_experiment (write: stores a proposal; starting it needs a human click)

const proposeInput = z.object({
  checkout_id: z.string().min(1).max(40),
  title: z.string().min(3).max(80).describe("Short, plain-English name, e.g. 'Hide the coupon field'"),
  hypothesis: z.string().min(10).max(300).describe("What you expect and why, in plain language, citing the evidence"),
  metric: z.enum(["conversion", "revenue_per_visit"]).describe("Use revenue_per_visit for price tests"),
  changes: z.array(proposalChangeSchema).min(1).max(3).describe("What variant B changes compared to the current published checkout"),
});

async function proposeExperiment(ctx: ToolContext, i: z.infer<typeof proposeInput>) {
  const proposal = await createProposal(ctx.merchantId, {
    checkoutId: i.checkout_id,
    title: i.title,
    hypothesis: i.hypothesis,
    metric: i.metric,
    changes: i.changes,
    source: "assistant",
  });
  return {
    proposal_id: proposal.id,
    status: "proposed",
    note: "Shown to the merchant as a card with a 'Start test' button. Nothing has started yet.",
    summary: i.changes.map((c) => describeChange(c)),
  };
}

// ---------------------------------------------------------------------------
// Registry

type ToolDef<S extends z.ZodTypeAny> = {
  name: string;
  /** Short present-tense label shown in the chat while it runs. */
  label: string;
  description: string;
  input: S;
  run: (ctx: ToolContext, input: z.infer<S>) => Promise<unknown>;
};

function tool<S extends z.ZodTypeAny>(def: ToolDef<S>) {
  return def;
}

// ---------------------------------------------------------------------------
// get_checkout_funnel (Home's five-step funnel) and get_traffic_sources

const checkoutFunnelInput = z.object({
  days: z.union([z.literal(7), z.literal(30), z.literal(90)]).describe("Period ending now: 7, 30 or 90 days"),
  step: z
    .enum(["start", "details", "payment", "paid"])
    .optional()
    .describe("Break down the drop-off before this step by device, source, new vs returning and order value"),
});

async function checkoutFunnel(ctx: ToolContext, i: z.infer<typeof checkoutFunnelInput>) {
  const o = await funnelOverview(ctx.merchantId, ctx.currency, i.days);
  const result: Record<string, unknown> = {
    days: i.days,
    stages: o.stages.map((s) => ({ stage: s.label, sessions: s.sessions, previous_period_sessions: s.prevSessions })),
    drop_offs: o.transitions.map((t) => ({
      between: `${t.from} → ${t.to}`,
      left: t.lost,
      drop_rate: round(t.dropRate),
      previous_drop_rate: t.prevDropRate == null ? null : round(t.prevDropRate),
    })),
    biggest_leak_before: o.biggestLeak,
  };
  if (i.step) {
    const d = await funnelDrilldown(ctx.merchantId, ctx.currency, i.days, i.step);
    result.breakdown = {
      step: i.step,
      worst_segment: d.worst && {
        dimension: d.worst.dimension,
        segment: d.worst.label,
        drop_rate: round(d.worst.dropRate),
        everyone_else_drop_rate: round(d.worst.othersDropRate),
        checkout: d.worst.checkout?.name ?? null,
      },
      segments: d.dimensions.flatMap((dim) =>
        dim.rows.filter((r) => !r.small).map((r) => ({ dimension: dim.key, segment: r.label, shoppers: r.reached, drop_rate: round(r.dropRate) })),
      ),
      last_field_before_leaving: d.lastFields.map((f) => ({ field: f.label, share: round(f.share) })),
      estimated_extra_revenue_cents_per_week: Math.round((d.opportunityCents / d.days) * 7),
    };
  }
  return result;
}

const sourcesInput = z.object({ ...rangeShape, checkout_id: checkoutId });

async function trafficSources(ctx: ToolContext, i: z.infer<typeof sourcesInput>) {
  const f = filter(ctx, i.from, i.to, i.checkout_id);
  const rows = await db.$queryRaw<{ source: string; sessions: bigint; paid: bigint }[]>`
    WITH ${sessionsCte(f)}
    SELECT COALESCE(source, 'unknown') AS source, count(*) AS sessions, count(*) FILTER (WHERE stage = 5) AS paid
    FROM sessions GROUP BY 1 ORDER BY 2 DESC`;
  return rows.map((r) => ({
    source: SOURCE_LABELS[r.source as Source] ?? "Not recorded",
    visits: n(r.sessions),
    paid_visits: n(r.paid),
    conversion: rate(n(r.paid), n(r.sessions)),
  }));
}

export const RESEARCH_TOOLS = [
  tool({
    name: "list_checkouts",
    label: "Looking at your checkouts",
    description: "List the merchant's checkouts: ids, product and price, visible blocks, theme, survey question and any active A/B test. Call this first to get checkout ids.",
    input: listCheckoutsInput,
    run: (ctx) => listCheckouts(ctx),
  }),
  tool({
    name: "get_daily_metrics",
    label: "Checking daily numbers",
    description: "Daily visits, paid visits, conversion, net revenue and failed payments for a date range. Optionally filter to one checkout, device or country.",
    input: dailyInput,
    run: dailyMetrics,
  }),
  tool({
    name: "compare_segments",
    label: "Comparing segments",
    description:
      "Conversion broken down by one dimension (device, country, variant, checkout, weekday, hour_of_day). Pass a baseline period to see how each segment changed - the fastest way to explain a drop.",
    input: compareInput,
    run: compareSegments,
  }),
  tool({
    name: "get_funnel",
    label: "Walking the funnel",
    description: "Funnel counts (viewed → interacted → started payment → pressed pay → paid) and which block or field people touched last before leaving, with exit rates.",
    input: funnelInput,
    run: getFunnel,
  }),
  tool({
    name: "get_payment_failures",
    label: "Looking at failed payments",
    description: "Payment attempts and failure rates grouped by up to three of: country, payment_method, device, hour_of_day. Also returns the most common decline messages.",
    input: failuresInput,
    run: paymentFailures,
  }),
  tool({
    name: "get_survey_answers",
    label: "Reading buyers' answers",
    description: "Counts of buyers' answers to the one-tap post-purchase questions ('why_bought': what made them buy; 'nearly_stopped': what nearly stopped them; 'heard_about': where they heard about the shop). Optionally split by A/B variant.",
    input: surveyInput,
    run: surveyAnswers,
  }),
  tool({
    name: "get_experiment_results",
    label: "Checking A/B test results",
    description: "Recent A/B tests on a checkout with each variant's visits, conversion and revenue per visit.",
    input: experimentInput,
    run: experimentResults,
  }),
  tool({
    name: "get_checkout_funnel",
    label: "Walking the checkout funnel",
    description:
      "The five-step funnel (Visit, Start, Details, Payment, Paid) for the last 7/30/90 days with drop-off between steps vs the previous period, and the biggest leak. Pass `step` to break that drop-off down by device, traffic source, new vs returning and order value, with where shoppers were when they left.",
    input: checkoutFunnelInput,
    run: checkoutFunnel,
  }),
  tool({
    name: "get_traffic_sources",
    label: "Checking where shoppers come from",
    description: "Visits, paid visits and conversion by traffic source (Instagram, TikTok, Email, Search, Facebook, Direct, Other sites).",
    input: sourcesInput,
    run: trafficSources,
  }),
  tool({
    name: "propose_experiment",
    label: "Drafting an experiment",
    description:
      "Propose ONE A/B test the merchant can start with a single click. Variant A is the current published checkout; variant B applies `changes`. Use when the data suggests a concrete, testable change (including price tests with set_price). Never claim the test has started.",
    input: proposeInput,
    run: proposeExperiment,
  }),
] as const;

export type ResearchToolName = (typeof RESEARCH_TOOLS)[number]["name"];

export function findTool(name: string) {
  return RESEARCH_TOOLS.find((t) => t.name === name);
}

/** Run a tool with untrusted input: validate, execute, and return JSON for the model. */
export async function runTool(ctx: ToolContext, name: string, rawInput: unknown): Promise<{ ok: boolean; content: string }> {
  const t = findTool(name);
  if (!t) return { ok: false, content: JSON.stringify({ error: `Unknown tool ${name}` }) };
  const parsed = t.input.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return { ok: false, content: JSON.stringify({ error: "Invalid input", issues: parsed.error.issues.slice(0, 5), received: rawInput }) };
  }
  try {
    const result = await (t.run as (c: ToolContext, i: unknown) => Promise<unknown>)(ctx, parsed.data);
    return { ok: true, content: JSON.stringify(result) };
  } catch (e) {
    if (e instanceof ToolInputError || (e instanceof Error && e.name === "UserError")) {
      return { ok: false, content: JSON.stringify({ error: e.message }) };
    }
    throw e;
  }
}
