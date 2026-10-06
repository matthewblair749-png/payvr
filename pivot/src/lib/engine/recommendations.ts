import { money, pct, pctDelta } from "../format";
import type { Facts } from "./facts";
import { word } from "./insights";
import { customerMonths12 } from "./opportunities";
import { impactLevel, IMPACT_RANK, LEVEL_RANK } from "./score";
import { roughly } from "./series";
import type { Insight, Level, Opportunity, Recommendation } from "./types";

/**
 * Recommended next moves: concrete actions ranked by expected value
 * (annual impact x confidence), discounted for difficulty and risk.
 * Links are relative to the workspace ("/app" or "/demo") and the UI
 * prefixes them.
 */

const DIFFICULTY_FACTOR: Record<Level, number> = { Low: 1, Medium: 0.85, High: 0.65 };
const RISK_FACTOR: Record<Level, number> = { Low: 1, Medium: 0.85, High: 0.6 };

type Draft = Omit<Recommendation, "rank"> & { confidence: number };

export function buildRecommendations(f: Facts, insights: Insight[], opps: Opportunity[]): Recommendation[] {
  const cur = f.currency;
  const annual = (f.revenue?.now ?? 0) * 12;
  const drafts: Draft[] = [];
  const opp = (k: string) => opps.find((o) => o.key === k);
  const used = new Set<string>();

  // Retention
  const ret = insights.find((i) => i.key === "retention-decline");
  if (ret && f.retention && f.customers && f.arpc) {
    const r = f.retention;
    const gap = Math.max(0, r.avg12 - r.now) * (f.customers.prev ?? f.customers.now);
    const value = gap * customerMonths12(r.avg12) * f.arpc.now;
    const winback = opp("segment-winback") ?? opp("retention-program");
    if (winback) used.add(winback.key);
    const cacRising = (f.cac?.change ?? 0) > 0.05;
    drafts.push({
      key: "improve-retention",
      title: "Improve customer retention",
      impact: impactLevel(value, annual),
      difficulty: "Medium",
      risk: "Low",
      reasoning:
        r.declines >= 2
          ? `Retention has declined consistently for ${word(r.declines)} consecutive periods${cacRising ? " while acquisition costs are increasing" : ""}.`
          : `Retention fell ${(-(r.change ?? 0) * 100).toFixed(1)} points to ${pct(r.now)}${cacRising ? " while acquisition costs are increasing" : ""}.`,
      annualImpact: roughly(value),
      steps: [
        ...(f.churnDriver ? [`Start with ${f.churnDriver.segment.name.toLowerCase()} customers, who are leaving ${f.churnDriver.multiple.toFixed(1)}x faster than others.`] : ["Find out who's leaving: add customer segments to your data."]),
        "Survey customers who left in the last 30 days and fix the top reason.",
        "Launch a loyalty reward for repeat buyers instead of broad discounts.",
        `Track monthly retention weekly; the goal is back to ${pct(r.avg12)}.`,
      ],
      links: [
        { label: "See the insight", href: "insights#retention-decline" },
        ...(winback ? [{ label: "Open the opportunity", href: `opportunities/${winback.key}` }] : []),
        { label: "Simulate a loyalty discount", href: "what-if?kind=price&value=-5" },
      ],
      sources: [ret.key, ...(winback ? [winback.key] : [])],
      confidence: winback?.confidence ?? 80,
    });
  }

  // Product momentum
  const expand = opp("expand-product");
  if (expand && f.topMover) {
    used.add(expand.key);
    const mv = f.topMover;
    drafts.push({
      key: "invest-product",
      title: `Increase investment in ${mv.name}`,
      impact: expand.impact,
      difficulty: "Medium",
      // Buying inventory and marketing ahead of demand carries more risk than the segment test alone.
      risk: "Medium",
      reasoning: `${mv.name} demand grew ${pctDelta(mv.demand60 ?? 0, 0).replace("+", "")} in 60 days and it's now ${pct(mv.shareNow, 0)} of revenue. It's your clearest source of new growth.`,
      annualImpact: expand.annualImpact,
      steps: expand.plan,
      links: [
        { label: "Open the opportunity", href: `opportunities/${expand.key}` },
        { label: "Simulate it", href: `what-if?kind=${expand.simulate?.kind ?? "newMarket"}&value=${expand.simulate?.value ?? 20}` },
      ],
      sources: ["product-momentum", expand.key],
      confidence: expand.confidence,
    });
  }

  // Expensive channel
  const shift = opp("channel-shift");
  if (shift && f.worstChannel && f.bestChannel) {
    used.add(shift.key);
    const w = f.worstChannel;
    const b = f.bestChannel;
    drafts.push({
      key: "reduce-channel",
      title: `Reduce spending in ${w.name}`,
      impact: shift.impact,
      difficulty: "Low",
      risk: "Low",
      reasoning: `${w.name}'s cost per customer ${w.cacChange !== null && w.cacChange > 0.05 ? `rose ${pctDelta(w.cacChange, 0).replace("+", "")} to` : "is"} ${money(w.cacNow!, cur)}, ${(w.cacNow! / b.cacNow!).toFixed(1)}x ${b.name}, while it took ${pct(w.spendNow / (f.marketing?.now ?? w.spendNow), 0)} of the budget.`,
      annualImpact: shift.annualImpact,
      steps: shift.plan,
      links: [
        { label: "Open the opportunity", href: `opportunities/${shift.key}` },
        { label: "See the insight", href: "insights#cac-rising" },
      ],
      sources: ["cac-rising", shift.key],
      confidence: shift.confidence,
    });
  }

  // Any remaining opportunity becomes a recommendation of its own.
  for (const o of opps) {
    if (used.has(o.key)) continue;
    drafts.push({
      key: `do-${o.key}`,
      title: o.title,
      impact: o.impact,
      difficulty: o.effort,
      risk: o.risk,
      reasoning: o.whyFound.split(/(?<=\.)\s/)[0],
      annualImpact: o.annualImpact,
      steps: o.plan,
      links: [
        { label: "Open the opportunity", href: `opportunities/${o.key}` },
        ...(o.simulate ? [{ label: "Simulate it", href: `what-if?kind=${o.simulate.kind}&value=${o.simulate.value}` }] : []),
      ],
      sources: [o.key],
      confidence: o.confidence,
    });
  }

  const priority = (d: Draft) =>
    (d.annualImpact / Math.max(1, annual)) * (d.confidence / 100) * DIFFICULTY_FACTOR[d.difficulty] * RISK_FACTOR[d.risk] + IMPACT_RANK[d.impact] * 1e-4 - LEVEL_RANK[d.risk] * 1e-5;

  return drafts
    .sort((a, b) => priority(b) - priority(a))
    .map(({ confidence: _c, ...d }, i) => ({ ...d, rank: i + 1 }));
}
