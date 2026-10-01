import "server-only";
import { periodWindows } from "@/lib/date-range";
import { answerLabel, SURVEY_QUESTIONS, type SurveyQuestionKey } from "@/lib/survey/questions";
import type { Verdict } from "@/lib/experiments/stats";
import { db } from "../db";
import { experimentDetail } from "./experiments";

/** Home's live feed, "Why they buy" and the experiment card. All merchant-scoped. */

const PAID = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] as const;

export type Sale = {
  id: string;
  amountCents: number;
  currency: string;
  status: (typeof PAID)[number];
  product: string;
  country: string | null;
  device: string | null;
  at: string;
};

/** The latest paid orders (no buyer emails: the feed is glanceable, not a ledger). */
export async function recentSales(merchantId: string, take = 8): Promise<Sale[]> {
  const rows = await db.order.findMany({
    where: { merchantId, status: { in: [...PAID] } },
    orderBy: { createdAt: "desc" },
    take,
    select: {
      id: true,
      amountCents: true,
      currency: true,
      status: true,
      country: true,
      device: true,
      paidAt: true,
      createdAt: true,
      product: { select: { name: true } },
      checkoutPage: { select: { name: true } },
    },
  });
  return rows.map((o) => ({
    id: o.id,
    amountCents: o.amountCents,
    currency: o.currency,
    status: o.status as Sale["status"],
    product: o.product?.name ?? o.checkoutPage?.name ?? "Order",
    country: o.country,
    device: o.device,
    at: (o.paidAt ?? o.createdAt).toISOString(),
  }));
}

// ---------------------------------------------------------------------------

export type WhyTheyBuy = {
  question: SurveyQuestionKey;
  prompt: string;
  total: number;
  prevTotal: number;
  answers: { key: string; label: string; count: number; share: number; prevShare: number | null }[];
};

/**
 * Ranked one-tap answers for the period. Prefers "What made you buy today?";
 * falls back to whichever question this shop's buyers actually answered.
 */
export async function whyTheyBuy(merchantId: string, days: number, now = new Date()): Promise<WhyTheyBuy | null> {
  const w = periodWindows(days, now);
  const counts = (from: Date, to: Date) =>
    db.surveyResponse.groupBy({ by: ["question", "answer"], where: { merchantId, createdAt: { gte: from, lt: to } }, _count: { _all: true } });
  const [cur, prev] = await Promise.all([counts(w.current.from, w.current.to), counts(w.previous.from, w.previous.to)]);

  const totals = new Map<string, number>();
  for (const r of cur) totals.set(r.question, (totals.get(r.question) ?? 0) + r._count._all);
  const order: SurveyQuestionKey[] = ["why_bought", "nearly_stopped", "heard_about"];
  const question = order.find((q) => (totals.get(q) ?? 0) >= 10) ?? order.find((q) => totals.get(q));
  if (!question) return null;

  const total = totals.get(question)!;
  const prevRows = prev.filter((r) => r.question === question);
  const prevTotal = prevRows.reduce((s, r) => s + r._count._all, 0);
  const answers = Object.keys(SURVEY_QUESTIONS[question].answers)
    .map((key) => {
      const count = cur.find((r) => r.question === question && r.answer === key)?._count._all ?? 0;
      const p = prevRows.find((r) => r.answer === key)?._count._all ?? 0;
      return { key, label: answerLabel(question, key), count, share: total ? count / total : 0, prevShare: prevTotal >= 20 ? p / prevTotal : null };
    })
    .filter((a) => a.count > 0)
    // Ranked, with the catch-alls last however big they are.
    .sort((a, b) => Number(["other", "nothing"].includes(a.key)) - Number(["other", "nothing"].includes(b.key)) || b.count - a.count);
  return { question, prompt: SURVEY_QUESTIONS[question].prompt, total, prevTotal, answers };
}

// ---------------------------------------------------------------------------

export type ExperimentCard = {
  id: string;
  name: string;
  status: "RUNNING" | "COMPLETED";
  checkoutName: string;
  metric: "conversion" | "revenue_per_visit";
  currency: string;
  daysRunning: number;
  endedAt: string | null;
  winnerKey: "A" | "B" | null;
  variants: Record<"A" | "B", { name: string; visits: number; conversions: number; perVisitCents: number }>;
  /** Chance B beats A on the test's metric. */
  chanceBBetter: number;
  verdict: Verdict;
  changes: string[];
};

/** The running test (newest first), or the most recent one that finished in the last 60 days. */
export async function experimentCard(merchantId: string): Promise<ExperimentCard | null> {
  const exp =
    (await db.experiment.findFirst({ where: { merchantId, status: "RUNNING" }, orderBy: { startedAt: "desc" }, select: { id: true } })) ??
    (await db.experiment.findFirst({
      where: { merchantId, status: "COMPLETED", endedAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
      orderBy: { endedAt: "desc" },
      select: { id: true },
    }));
  if (!exp) return null;
  const d = await experimentDetail(merchantId, exp.id);
  const v = (k: "A" | "B") => ({
    name: d.variants[k].name,
    visits: d.variants[k].visits,
    conversions: d.variants[k].conversions,
    perVisitCents: d.variants[k].visits ? Math.round(d.variants[k].sumCents / d.variants[k].visits) : 0,
  });
  return {
    id: d.id,
    name: d.name,
    status: d.status === "RUNNING" ? "RUNNING" : "COMPLETED",
    checkoutName: d.checkout.name,
    metric: d.metric,
    currency: d.currency,
    daysRunning: Math.floor(d.daysRunning),
    endedAt: d.endedAt,
    winnerKey: (d.winnerKey as "A" | "B" | null) ?? null,
    variants: { A: v("A"), B: v("B") },
    chanceBBetter: d.metric === "revenue_per_visit" ? d.revenue.chanceBBetter : d.conversion.chanceBBetter,
    verdict: d.verdict,
    changes: d.changes,
  };
}
