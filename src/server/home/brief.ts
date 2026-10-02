import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { FIELD_LABELS, STAGES, type StageKey } from "@/lib/tracking/events";
import { addDays, localDate, localDayRange, localMidnight, safeTimeZone } from "@/lib/zoned";
import { AI_MODEL } from "../brand-import/ai";
import { funnelDrilldown, funnelOverview } from "../dal/funnel";
import { db } from "../db";
import { assistantEnabled, getAnthropic } from "../research/agent";
import type { ProposalChange } from "../research/proposals";

/**
 * The morning brief: one sentence about yesterday and the single biggest
 * opportunity, plus two actions.
 *
 * Numbers and actions are computed here, deterministically. Claude only turns
 * the facts into a sentence, and a sentence that mentions any dollar amount
 * not in the facts is thrown away for the template. Written once per local
 * day and stored with the facts it came from.
 */

export type BriefSuggestion = { title: string; hypothesis: string; checkoutId: string; changes: ProposalChange[] };

export type BriefFacts = {
  /** The merchant's local date this brief is for. */
  day: string;
  timeZone: string;
  currency: string;
  yesterday: {
    date: string;
    weekday: string;
    revenueCents: number;
    orders: number;
    /** Same weekday a week earlier. */
    compareRevenueCents: number;
  };
  leak: null | {
    to: Exclude<StageKey, "visit">;
    fromLabel: string;
    toLabel: string;
    dropRate: number;
    /** "mobile shoppers", "shoppers from Instagram", … */
    who: string | null;
    segmentRate: number | null;
    othersRate: number | null;
    lastField: string | null;
    perWeekCents: number;
    basis: "previous" | "half" | null;
    checkout: { id: string; name: string } | null;
  };
  /** A test the existing change vocabulary can honestly express for this leak. */
  suggestion: BriefSuggestion | null;
};

export type BriefAction =
  | { kind: "start_test"; label: string }
  | { kind: "link"; label: string; href: string }
  | { kind: "ask"; label: string; question: string };

export type Brief = { day: string; sentence: string; source: "ai" | "template"; facts: BriefFacts; actions: [BriefAction, BriefAction] };

// ---------------------------------------------------------------------------
// Facts

const fmt = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(Math.round(cents / 100));

/** Estimates are rounded (see roughMoney on the client): $978 → $980. */
function roundEstimate(cents: number) {
  const d = cents / 100;
  const step = d < 1_000 ? 10 : d < 10_000 ? 100 : 1_000;
  return Math.round(d / step) * step * 100;
}

async function revenueBetween(merchantId: string, currency: string, from: Date, to: Date) {
  const r = await db.order.aggregate({
    where: {
      merchantId,
      currency,
      status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] },
      OR: [{ paidAt: { gte: from, lt: to } }, { paidAt: null, createdAt: { gte: from, lt: to } }],
    },
    _sum: { amountCents: true, refundedCents: true },
    _count: { _all: true },
  });
  return { revenueCents: (r._sum.amountCents ?? 0) - (r._sum.refundedCents ?? 0), orders: r._count._all };
}

function who(dimension: string, label: string): string {
  if (dimension === "device" || dimension === "visitor") return `${label.toLowerCase()} shoppers`;
  if (dimension === "source") return `shoppers from ${label}`;
  return label.startsWith("Under") ? `orders ${label.toLowerCase()}` : `orders of ${label}`;
}

/**
 * Only tests the change vocabulary can express honestly. A shipping-form leak
 * has no credible one-click fix here, so it gets "Ask lumen what to try".
 */
function suggestFor(to: StageKey, checkoutId: string | null, lastField: string | null): BriefSuggestion | null {
  if (!checkoutId) return null;
  if (to === "start") {
    return {
      checkoutId,
      title: "Lead with a customer review",
      hypothesis: "Shoppers leave before interacting. Showing a real customer review first may give them a reason to start.",
      changes: [{ op: "move_block", block_type: "testimonial", position: "top" }],
    };
  }
  if (to === "payment" && lastField !== "shipping") {
    return {
      checkoutId,
      title: "Offer Pay in 4",
      hypothesis: "Shoppers finish their details but stop before paying. Splitting the total into four payments may ease the decision.",
      changes: [{ op: "show_block", block_type: "payIn4" }],
    };
  }
  return null;
}

export async function briefFacts(merchantId: string, currency: string, timeZone: string, now = new Date()): Promise<BriefFacts> {
  const tz = safeTimeZone(timeZone);
  const today = localDate(tz, now);
  const yday = addDays(today, -1);
  const lastWeek = addDays(yday, -7);
  const [y, lw, overview] = await Promise.all([
    revenueBetween(merchantId, currency, localDayRange(tz, yday).from, localDayRange(tz, yday).to),
    revenueBetween(merchantId, currency, localDayRange(tz, lastWeek).from, localDayRange(tz, lastWeek).to),
    funnelOverview(merchantId, currency, 30, now),
  ]);

  let leak: BriefFacts["leak"] = null;
  if (overview.biggestLeak && overview.biggestLeak !== "visit") {
    const d = await funnelDrilldown(merchantId, currency, 30, overview.biggestLeak, now);
    const w = d.worst;
    const top = d.lastFields.find((f) => f.field !== "none");
    leak = {
      to: overview.biggestLeak,
      fromLabel: STAGES.find((s) => s.key === d.from)!.label,
      toLabel: STAGES.find((s) => s.key === d.to)!.label,
      dropRate: d.overall.dropRate,
      who: w ? who(w.dimension, w.label) : null,
      segmentRate: w?.dropRate ?? null,
      othersRate: w?.othersDropRate ?? null,
      lastField: top ? top.field : null,
      perWeekCents: roundEstimate((d.opportunityCents / d.days) * 7),
      basis: w?.basis ?? null,
      checkout: w?.checkout ?? null,
    };
  }

  return {
    day: today,
    timeZone: tz,
    currency,
    yesterday: {
      date: yday,
      weekday: new Date(`${yday}T12:00:00Z`).toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" }),
      revenueCents: y.revenueCents,
      orders: y.orders,
      compareRevenueCents: lw.revenueCents,
    },
    leak,
    suggestion: leak ? suggestFor(leak.to, leak.checkout?.id ?? null, leak.lastField) : null,
  };
}

// ---------------------------------------------------------------------------
// The sentence

const fieldPhrase = (field: string | null) => (field ? FIELD_LABELS[field]?.toLowerCase() ?? field : null);

export function templateSentence(f: BriefFacts): string {
  const y = f.yesterday;
  const money = (c: number) => fmt(c, f.currency);
  let first: string;
  if (!y.orders) first = `No sales yesterday (${y.weekday}).`;
  else if (!y.compareRevenueCents) first = `You made ${money(y.revenueCents)} yesterday from ${y.orders} ${y.orders === 1 ? "order" : "orders"}.`;
  else {
    const ch = (y.revenueCents - y.compareRevenueCents) / y.compareRevenueCents;
    const pct = Math.round(Math.abs(ch) * 100);
    const trend = pct < 1 ? "about the same as" : ch > 0 ? `up ${pct}% on` : `down ${pct}% on`;
    first = `You made ${money(y.revenueCents)} yesterday, ${trend} last ${y.weekday}.`;
  }
  const l = f.leak;
  if (!l) return first;
  const where = fieldPhrase(l.lastField) ? ` at ${fieldPhrase(l.lastField)}` : ` before ${l.toLabel.toLowerCase()}`;
  const subject = l.who ? capital(l.who) : "Shoppers";
  const value = l.perWeekCents > 0 ? `, and fixing it could add about ${money(l.perWeekCents)} a week` : "";
  return `${first} ${subject} are dropping off${where}${value}.`;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Every dollar amount in `sentence` must be one we gave it. */
export function sentenceIsGrounded(sentence: string, f: BriefFacts): boolean {
  const allowed = new Set(
    [f.yesterday.revenueCents, f.yesterday.compareRevenueCents, f.leak?.perWeekCents ?? 0].map((c) => fmt(c, f.currency).replace(/[^\d]/g, "")),
  );
  const amounts = sentence.match(/\$\s?[\d,]+(?:\.\d+)?/g) ?? [];
  return amounts.every((a) => allowed.has(a.replace(/\.\d+$/, "").replace(/[^\d]/g, "")));
}

const BRIEF_SYSTEM = `You write the one-line "morning brief" at the top of a small creator's checkout dashboard (the product is lumen).

Write ONE or TWO short sentences, at most 40 words, in a calm, warm, plain voice. Cover, in order:
1. Yesterday's revenue and how it compares with the same weekday last week.
2. The single biggest opportunity: who is dropping off, where, and what fixing it could be worth per week.

Rules:
- Use ONLY the numbers in the facts, formatted exactly as given (whole dollars). Never add a number, reason or cause that isn't in the facts.
- If there were no sales yesterday, say so kindly. If there's no opportunity, write only the first sentence.
- "Could add about" for estimates. No jargon, no exclamation marks, no emoji, no "I".`;

const BriefOut = z.object({ sentence: z.string() });

async function writeWithClaude(f: BriefFacts): Promise<string | null> {
  const money = (c: number) => fmt(c, f.currency);
  const facts = {
    yesterday: {
      weekday: f.yesterday.weekday,
      revenue: money(f.yesterday.revenueCents),
      orders: f.yesterday.orders,
      same_weekday_last_week_revenue: money(f.yesterday.compareRevenueCents),
    },
    opportunity: f.leak && {
      who: f.leak.who ?? "shoppers",
      where: fieldPhrase(f.leak.lastField) ?? `before ${f.leak.toLabel.toLowerCase()}`,
      their_drop_off_rate: f.leak.segmentRate != null ? `${Math.round(f.leak.segmentRate * 100)}%` : null,
      everyone_else_rate: f.leak.othersRate != null ? `${Math.round(f.leak.othersRate * 100)}%` : null,
      could_add_per_week: f.leak.perWeekCents > 0 ? money(f.leak.perWeekCents) : null,
    },
  };
  try {
    const res = await getAnthropic().beta.messages.parse(
      {
        model: AI_MODEL,
        max_tokens: 2_000,
        system: BRIEF_SYSTEM,
        messages: [{ role: "user", content: `Facts (JSON):\n${JSON.stringify(facts)}` }],
        // A one-line rewrite of given facts: low effort is plenty.
        output_config: { effort: "low", format: betaZodOutputFormat(BriefOut) },
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal: AbortSignal.timeout(12_000) },
    );
    if (res.stop_reason === "refusal" || res.stop_reason === "max_tokens") return null;
    const sentence = res.parsed_output?.sentence?.trim();
    if (!sentence || sentence.length > 320 || !sentenceIsGrounded(sentence, f)) return null;
    return sentence;
  } catch (e) {
    if (!(e instanceof Anthropic.APIError) && !(e instanceof Error && e.name === "AbortError") && !(e instanceof Error && e.name === "TimeoutError")) {
      console.error("[brief] writer failed", e);
    }
    return null;
  }
}

// ---------------------------------------------------------------------------
// Actions (recomputed every request: a test may have started since this morning)

async function actionsFor(merchantId: string, f: BriefFacts): Promise<[BriefAction, BriefAction]> {
  const l = f.leak;
  if (!l) return [{ kind: "link", label: "See your funnel", href: "/studio/funnel/start" }, { kind: "ask", label: "Ask lumen", question: "What should I focus on this week?" }];
  const seeWhy: BriefAction = { kind: "link", label: "See why", href: `/studio/funnel/${l.to}` };
  const running = l.checkout
    ? await db.experiment.findFirst({ where: { merchantId, checkoutPageId: l.checkout.id, status: "RUNNING" }, select: { id: true } })
    : null;
  if (f.suggestion && !running) return [{ kind: "start_test", label: `Start a test: ${f.suggestion.title}` }, seeWhy];
  const subject = l.who ?? "shoppers";
  const where = fieldPhrase(l.lastField) ? `at ${fieldPhrase(l.lastField)}` : `before ${l.toLabel.toLowerCase()}`;
  return [seeWhy, { kind: "ask", label: "Ask lumen what to try", question: `How can I stop ${subject} dropping off ${where}?` }];
}

// ---------------------------------------------------------------------------

/** Today's brief: stored if already written, otherwise written now. Null when there's nothing to say yet. */
export async function getBrief(merchantId: string, currency: string, timeZone: string, now = new Date()): Promise<Brief | null> {
  const tz = safeTimeZone(timeZone);
  const day = localDate(tz, now);
  const stored = await db.morningBrief.findUnique({ where: { merchantId_day: { merchantId, day } } });
  if (stored) {
    const facts = stored.facts as unknown as BriefFacts;
    return { day, sentence: stored.sentence, source: stored.source as Brief["source"], facts, actions: await actionsFor(merchantId, facts) };
  }

  const facts = await briefFacts(merchantId, currency, tz, now);
  const paid = { merchantId, status: { in: ["SUCCEEDED" as const, "PARTIALLY_REFUNDED" as const, "REFUNDED" as const, "DISPUTED" as const] } };
  const anySales = await db.order.count({ where: paid, take: 1 });
  if (!anySales) return null; // first-run: the onboarding checklist takes this spot

  // Day one: "No sales yesterday" would be true and deflating. Greet the first
  // sales instead, and don't store it, so later sales today still count.
  const before = await db.order.count({ where: { ...paid, createdAt: { lt: localMidnight(tz, day) } }, take: 1 });
  if (!before) {
    const today = await db.order.aggregate({ where: paid, _count: { _all: true }, _sum: { amountCents: true } });
    const n = today._count._all;
    const sentence = `Your first ${n === 1 ? "sale" : `${n} sales`} came in today: ${fmt(today._sum.amountCents ?? 0, currency)}${n === 1 ? "" : " in all"}. From tomorrow, this brief compares each day with the one before.`;
    return { day, sentence, source: "template", facts, actions: await actionsFor(merchantId, facts) };
  }

  const aiSentence = assistantEnabled() ? await writeWithClaude(facts) : null;
  const sentence = aiSentence ?? templateSentence(facts);
  const source = aiSentence ? "ai" : "template";
  await db.morningBrief
    .upsert({
      where: { merchantId_day: { merchantId, day } },
      create: { merchantId, day, sentence, source, facts: facts as unknown as Prisma.InputJsonValue },
      update: {},
    })
    .catch(() => {}); // a concurrent request wrote it first; ours is equivalent
  return { day, sentence, source, facts, actions: await actionsFor(merchantId, facts) };
}
