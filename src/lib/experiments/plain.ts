import type { Verdict } from "./stats";

type Card = {
  status: "RUNNING" | "COMPLETED";
  metric: "conversion" | "revenue_per_visit";
  winnerKey: "A" | "B" | null;
  verdict: Verdict;
  variants: Record<"A" | "B", { name: string; visits: number; conversions: number; perVisitCents: number }>;
};

const days = (n: number | null) => (n == null ? "a few more days" : `about ${n} more day${n === 1 ? "" : "s"}`);

/** One plain-English line for a test's status ("Variant B is ahead, but we need about 2 more days to be sure."). */
export function experimentStatusLine(c: Card): string {
  if (c.status === "COMPLETED") {
    const { A, B } = c.variants;
    const per = (v: Card["variants"]["A"]) => (c.metric === "revenue_per_visit" ? v.perVisitCents : v.visits ? v.conversions / v.visits : 0);
    const a = per(A);
    const b = per(B);
    const what = c.metric === "revenue_per_visit" ? "more per visit" : "more sales per visit";
    if (c.winnerKey === "B" && a > 0 && b > a) return `“${B.name}” won, earning about ${Math.round(((b - a) / a) * 100)}% ${what}. It's live now.`;
    if (c.winnerKey === "B") return `“${B.name}” won and is live now.`;
    return "Your original won, so nothing changed. Worth trying another idea.";
  }
  const v = c.verdict;
  switch (v.status) {
    case "b_better":
      return "Variant B is very likely better. You can ship it.";
    case "a_better":
      return "Your original is very likely better. You can stop the test and keep it.";
    case "leaning_b":
      return `Variant B is ahead, but we need ${days(v.daysLeft)} to be sure.`;
    case "leaning_a":
      return `Your original is ahead, but we need ${days(v.daysLeft)} to be sure.`;
    case "too_early":
      return `Too early to tell. Check back in ${days(v.daysLeft).replace(" more", "")}.`;
    case "no_difference":
      return "No real difference so far. You can stop the test and keep your original.";
    default:
      return v.daysLeft ? `${v.headline}. We need ${days(v.daysLeft)} to be sure.` : `${v.headline}.`;
  }
}
