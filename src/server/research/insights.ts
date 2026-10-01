import "server-only";
import { Prisma } from "@/generated/prisma/client";
import { answerLabel } from "@/lib/survey/questions";
import { FIELD_LABELS } from "@/lib/tracking/events";
import { db } from "../db";
import { proposalSchema, type Proposal } from "./proposals";
import { runTool, type ToolContext } from "./tools";

/**
 * "lumen noticed": deterministic insights computed from the merchant's data.
 *
 * No AI needed (works without an API key, and is fully testable). Each
 * insight is a plain-English finding with the evidence behind it, and some
 * carry an experiment proposal the merchant can start with one click.
 * The Research Assistant goes deeper on demand; these surface things nobody
 * asked about yet.
 */

type Draft = { kind: string; title: string; body: string; evidence: Record<string, unknown>; proposal?: Omit<Proposal, "source"> };

const iso = (d: Date) => d.toISOString().slice(0, 10);
const daysAgo = (n: number, from = new Date()) => {
  const d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate()));
  return new Date(d.getTime() - n * 86_400_000);
};
const pct = (x: number) => `${Math.round(x * 100)}%`;
const niceDay = (s: string) =>
  new Date(`${s}T00:00:00Z`).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });

async function tool<T>(ctx: ToolContext, name: string, input: unknown): Promise<T> {
  const r = await runTool(ctx, name, input);
  if (!r.ok) throw new Error(`${name} failed: ${r.content}`);
  return JSON.parse(r.content) as T;
}

const METHOD_NAMES: Record<string, string> = { card: "Card", apple_pay: "Apple Pay", google_pay: "Google Pay", link: "Link", klarna: "Klarna", ideal: "iDEAL" };
const method = (m: string) => METHOD_NAMES[m] ?? m.replace(/_/g, " ");
const country = (c: string) => {
  try {
    return new Intl.DisplayNames(["en"], { type: "region" }).of(c) ?? c;
  } catch {
    return c;
  }
};

// ---------------------------------------------------------------------------
// Individual detectors

type Day = { day: string; weekday: string; visits: number; paid_visits: number; conversion: number | null; failed_payments: number };

/** A recent day whose conversion fell well below the week before, explained by segment. */
async function conversionDip(ctx: ToolContext, now: Date): Promise<Draft | null> {
  const { days } = await tool<{ days: Day[] }>(ctx, "get_daily_metrics", { from: iso(daysAgo(15, now)), to: iso(daysAgo(1, now)) });
  // Score every recent day, then explain the biggest dip (not just the most recent).
  let worst: { i: number; drop: number } | null = null;
  for (let i = days.length - 1; i >= Math.max(7, days.length - 7); i--) {
    const d = days[i];
    if (d.visits < 40 || d.conversion == null) continue;
    const prior = days.slice(i - 7, i).filter((x) => x.visits >= 20);
    const base = prior.reduce((s, x) => s + x.paid_visits, 0) / Math.max(1, prior.reduce((s, x) => s + x.visits, 0));
    const drop = base - d.conversion;
    if (drop >= 0.05 && drop / base >= 0.12 && (!worst || drop > worst.drop)) worst = { i, drop };
  }
  for (const i of worst ? [worst.i] : []) {
    const d = days[i];
    if (d.visits < 40 || d.conversion == null) continue;
    const prior = days.slice(i - 7, i).filter((x) => x.visits >= 20);
    const visits = prior.reduce((s, x) => s + x.visits, 0);
    const base = prior.reduce((s, x) => s + x.paid_visits, 0) / Math.max(1, visits);
    const drop = base - d.conversion;
    if (drop < 0.05 || drop / base < 0.12) continue;

    const baselineFrom = prior[0].day;
    const baselineTo = prior[prior.length - 1].day;
    const seg = await tool<{ segments: { segment: string; visits: number; conversion_change_points: number | null }[] }>(ctx, "compare_segments", {
      from: d.day,
      to: d.day,
      dimension: "device",
      baseline_from: baselineFrom,
      baseline_to: baselineTo,
    });
    const worstDevice = seg.segments
      .filter((s) => s.conversion_change_points != null && s.visits >= 10)
      .sort((a, b) => a.visits * (a.conversion_change_points ?? 0) - b.visits * (b.conversion_change_points ?? 0))[0];

    type Group = { device: string; payment_method: string; attempts: number; failure_rate: number | null };
    const dayFail = await tool<{ groups: Group[] }>(ctx, "get_payment_failures", { from: d.day, to: d.day, group_by: ["device", "payment_method"] });
    const baseFail = await tool<{ groups: Group[] }>(ctx, "get_payment_failures", { from: baselineFrom, to: baselineTo, group_by: ["device", "payment_method"] });
    const spike = dayFail.groups
      .filter((g) => g.attempts >= 5 && (g.failure_rate ?? 0) >= 0.25)
      .map((g) => {
        const b = baseFail.groups.find((x) => x.device === g.device && x.payment_method === g.payment_method);
        return { ...g, base: b?.failure_rate ?? 0 };
      })
      .filter((g) => (g.failure_rate ?? 0) >= g.base * 2.5)
      .sort((a, b) => (b.failure_rate ?? 0) - (a.failure_rate ?? 0))[0];

    let explanation = worstDevice
      ? ` Most of the drop came from ${worstDevice.segment} buyers (down ${Math.abs(worstDevice.conversion_change_points ?? 0).toFixed(0)} points).`
      : "";
    if (spike) {
      explanation += ` ${method(spike.payment_method)} payments on ${spike.device} failed ${pct(spike.failure_rate ?? 0)} of the time that day, compared with ${pct(spike.base)} the week before. That looks like a payment problem, not a checkout design problem, so check your Stripe dashboard for declines and contact the card issuer if it continues.`;
    }
    return {
      kind: "auto_conversion_dip",
      title: `Conversion dipped on ${niceDay(d.day)}`,
      body: `${pct(d.conversion)} of visits paid, against ${pct(base)} the week before.${explanation}`,
      evidence: { day: d.day, conversion: d.conversion, baseline: base, worstDevice, spike },
    };
  }
  return null;
}

/** The block/field with an unusually high exit rate. */
async function exitHotspot(ctx: ToolContext, now: Date, checkouts: { id: string; name: string; visible_blocks: string[] }[]): Promise<Draft | null> {
  let best: { field: string; rate: number; touched: number; checkout: (typeof checkouts)[number] } | null = null;
  for (const c of checkouts) {
    const f = await tool<{ last_thing_touched_before_leaving: { field: string; touched: number; exit_rate: number | null }[] }>(ctx, "get_funnel", {
      from: iso(daysAgo(30, now)),
      to: iso(daysAgo(0, now)),
      checkout_id: c.id,
    });
    const fields = f.last_thing_touched_before_leaving.filter((x) => x.touched >= 80 && x.exit_rate != null);
    const rates = fields.map((x) => x.exit_rate!).sort((a, b) => a - b);
    const median = rates[Math.floor(rates.length / 2)] ?? 0;
    for (const x of fields) {
      // Card/email exits are expected: that's where people decide to pay.
      if (x.field === "card" || x.field === "email" || x.field === "payment") continue;
      // Only blame blocks that are actually on the published page.
      if (!c.visible_blocks.includes(x.field)) continue;
      if (x.exit_rate! >= Math.max(0.2, median * 1.5) && (!best || x.exit_rate! > best.rate)) {
        best = { field: x.field, rate: x.exit_rate!, touched: x.touched, checkout: c };
      }
    }
  }
  if (!best) return null;
  const label = FIELD_LABELS[best.field] ?? best.field;
  const canHide = best.checkout.visible_blocks.includes(best.field);
  const why =
    best.field === "coupon"
      ? "A visible coupon box sends people off to search for a code, and many don't come back."
      : "Something about it is making people pause.";
  return {
    kind: "auto_exit_hotspot",
    title: `The ${label.toLowerCase()} is losing people`,
    body: `On “${best.checkout.name}”, ${pct(best.rate)} of the ${best.touched.toLocaleString()} people who touched the ${label.toLowerCase()} left without paying, more than anywhere else on the page. ${why}`,
    evidence: best,
    proposal: canHide
      ? {
          checkoutId: best.checkout.id,
          title: `Hide the ${label.toLowerCase()}`,
          hypothesis: `${pct(best.rate)} of people who touch the ${label.toLowerCase()} leave. Hiding it for half of visitors shows whether it's costing sales.`,
          metric: "conversion",
          changes: [{ op: "hide_block", block_type: best.field }],
        }
      : undefined,
  };
}

/** The top answer to "What nearly stopped you?" */
async function topObjection(
  ctx: ToolContext,
  now: Date,
  checkouts: { id: string; name: string; visible_blocks: string[]; active_experiment: unknown }[],
): Promise<Draft | null> {
  const rows = await tool<{ answer: string; count: number }[]>(ctx, "get_survey_answers", {
    from: iso(daysAgo(30, now)),
    to: iso(daysAgo(0, now)),
    question: "nearly_stopped",
  });
  const total = rows.reduce((s, r) => s + r.count, 0);
  const top = rows.filter((r) => r.answer !== "nothing").sort((a, b) => b.count - a.count)[0];
  if (!top || total < 30 || top.count / total < 0.2) return null;
  // Propose on a checkout that can start a test right now (one test per checkout).
  const target = checkouts.find((c) => !c.active_experiment) ?? checkouts[0];
  const share = top.count / total;
  const label = answerLabel("nearly_stopped", top.answer);

  let proposal: Draft["proposal"];
  let tip = "";
  if (top.answer === "shipping" && target) {
    tip = " If you can absorb shipping, saying so up front is the classic fix.";
    proposal = {
      checkoutId: target.id,
      title: "Show a free-shipping badge",
      hypothesis: `${pct(share)} of buyers say shipping cost nearly stopped them. Showing free shipping up front should lift conversion. Only start this if you actually offer free shipping.`,
      metric: "conversion",
      changes: [{ op: "set_trust_badges", items: ["shipping", "secure", "refund"] }],
    };
  } else if (top.answer === "trust" && target) {
    tip = " Social proof near the top usually helps.";
    proposal = {
      checkoutId: target.id,
      title: "Lead with a testimonial",
      hypothesis: `${pct(share)} of buyers weren't sure the shop was legit. Moving a testimonial to the top should reassure them.`,
      metric: "conversion",
      changes: [{ op: "move_block", block_type: "testimonial", position: "top" }],
    };
  } else if (top.answer === "price") {
    tip = " A price test would tell you whether that hesitation actually costs you revenue.";
  }
  return {
    kind: "auto_top_objection",
    title: `“${label}” is what nearly stops people`,
    body: `${pct(share)} of the ${total.toLocaleString()} buyers who answered said ${label.toLowerCase()} nearly stopped them, and that's only counting people who still bought.${tip}`,
    evidence: { total, top, rows },
    proposal,
  };
}

/** A country where one payment method fails far more than another. */
async function paymentMethodGap(ctx: ToolContext, now: Date): Promise<Draft | null> {
  type G = { country: string; payment_method: string; attempts: number; failure_rate: number | null };
  const { groups } = await tool<{ groups: G[] }>(ctx, "get_payment_failures", {
    from: iso(daysAgo(30, now)),
    to: iso(daysAgo(0, now)),
    group_by: ["country", "payment_method"],
  });
  let best: { c: string; bad: G; good: G } | null = null;
  for (const bad of groups) {
    if (bad.attempts < 25 || (bad.failure_rate ?? 0) < 0.12 || bad.country === "unknown") continue;
    const good = groups
      .filter((g) => g.country === bad.country && g.payment_method !== bad.payment_method && g.attempts >= 15 && (g.failure_rate ?? 1) <= 0.05)
      .sort((a, b) => b.attempts - a.attempts)[0];
    if (good && (!best || (bad.failure_rate ?? 0) > (best.bad.failure_rate ?? 0))) best = { c: bad.country, bad, good };
  }
  if (!best) return null;
  return {
    kind: "auto_payment_gap",
    title: `${method(best.bad.payment_method)} payments struggle in ${country(best.c)}`,
    body: `In ${country(best.c)}, ${pct(best.bad.failure_rate ?? 0)} of ${method(best.bad.payment_method).toLowerCase()} payments fail, against ${pct(best.good.failure_rate ?? 0)} for ${method(best.good.payment_method)}. Make sure ${method(best.good.payment_method)} is turned on in your Stripe payment method settings. Buyers there clearly use it.`,
    evidence: best,
  };
}

/** A running A/B test with a visible leader. */
async function experimentLeader(ctx: ToolContext, checkouts: { id: string; name: string }[]): Promise<Draft | null> {
  for (const c of checkouts) {
    type V = { key: string; name: string; visits: number; conversion: number | null };
    const exps = await tool<{ name: string; status: string; variants: V[] }[]>(ctx, "get_experiment_results", { checkout_id: c.id });
    const running = exps.find((e) => e.status === "RUNNING");
    if (!running) continue;
    const [a, b] = ["A", "B"].map((k) => running.variants.find((v) => v.key === k));
    if (!a || !b || a.visits < 150 || b.visits < 150 || a.conversion == null || b.conversion == null) continue;
    const lift = (b.conversion - a.conversion) / Math.max(0.001, a.conversion);
    if (Math.abs(lift) < 0.05) continue;
    const leader = lift > 0 ? b : a;
    return {
      kind: "auto_experiment_leader",
      title: `“${leader.name}” is ahead on ${c.name}`,
      body: `${leader.key === "B" ? "Variant B" : "The original"} converts ${pct(leader.conversion!)} vs ${pct((leader === b ? a : b).conversion!)} so far (${a.visits + b.visits} visits). Early leads can still flip, so open the Experiments page to see how sure we are.`,
      evidence: { running },
    };
  }
  return null;
}

// ---------------------------------------------------------------------------

export async function generateInsights(merchantId: string, now = new Date()) {
  const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  const ctx: ToolContext = { merchantId, currency: merchant.defaultCurrency };
  const checkouts = (
    await tool<{ id: string; name: string; status: string; visible_blocks: string[]; active_experiment: unknown }[]>(ctx, "list_checkouts", {})
  ).filter(
    (c) => c.status === "PUBLISHED",
  );

  const results = await Promise.allSettled([
    conversionDip(ctx, now),
    exitHotspot(ctx, now, checkouts),
    topObjection(ctx, now, checkouts),
    paymentMethodGap(ctx, now),
    experimentLeader(ctx, checkouts),
  ]);
  const drafts = results.flatMap((r) => (r.status === "fulfilled" && r.value ? [r.value] : []));
  for (const r of results) if (r.status === "rejected") console.warn("[insights] detector failed", r.reason);

  // Replace previous auto insights, but keep any whose proposal was started.
  const old = await db.insight.findMany({ where: { merchantId, kind: { startsWith: "auto_" } } });
  const keep = (i: (typeof old)[number]) =>
    Boolean(proposalSchema.safeParse((i.data as { proposal?: unknown } | null)?.proposal).data?.startedExperimentId);
  await db.$transaction([
    db.insight.deleteMany({ where: { id: { in: old.filter((i) => !keep(i)).map((i) => i.id) } } }),
    ...drafts.map((d) =>
      db.insight.create({
        data: {
          merchantId,
          kind: d.kind,
          title: d.title,
          body: d.body,
          data: { evidence: d.evidence, ...(d.proposal ? { proposal: { ...d.proposal, source: "insight" } } : {}) } as unknown as Prisma.InputJsonValue,
        },
      }),
    ),
  ]);
  return drafts.length;
}

/** Regenerate if the newest auto insight is older than `maxAgeMs`. */
export async function ensureFreshInsights(merchantId: string, maxAgeMs = 6 * 3_600_000) {
  const latest = await db.insight.findFirst({ where: { merchantId, kind: { startsWith: "auto_" } }, orderBy: { createdAt: "desc" } });
  if (!latest || Date.now() - latest.createdAt.getTime() > maxAgeMs) await generateInsights(merchantId);
}

export async function listInsights(merchantId: string) {
  return db.insight.findMany({
    where: { merchantId, dismissedAt: null, kind: { startsWith: "auto_" } },
    orderBy: { createdAt: "desc" },
    take: 12,
  });
}
