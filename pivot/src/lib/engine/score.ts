import { clamp } from "./series";
import type { ImpactLevel, Level, ScoreFactors } from "./types";

/**
 * The PIVOT Score: one 0-100 number for how good an opportunity is.
 *
 *   value   = 30% impact + 20% revenue opportunity + 20% customer demand
 *           + 10% market conditions + 10% confidence + 10% cost efficiency
 *   penalty = 0.45 x (risk above 35) + 0.30 x (difficulty above 50)
 *   score   = value - penalty
 *
 * Risk and difficulty only count against an opportunity once they're
 * meaningful: a low-risk, moderately hard move isn't penalized, a risky or
 * very hard one is. All factors are 0-100; for risk and difficulty, lower is better.
 */
export const SCORE_WEIGHTS = { impact: 0.3, revenue: 0.2, demand: 0.2, market: 0.1, confidence: 0.1, cost: 0.1 } as const;

export function pivotScore(f: ScoreFactors): number {
  const value =
    SCORE_WEIGHTS.impact * f.impact +
    SCORE_WEIGHTS.revenue * f.revenue +
    SCORE_WEIGHTS.demand * f.demand +
    SCORE_WEIGHTS.market * f.market +
    SCORE_WEIGHTS.confidence * f.confidence +
    SCORE_WEIGHTS.cost * f.cost;
  const penalty = 0.45 * Math.max(0, f.risk - 35) + 0.3 * Math.max(0, f.difficulty - 50);
  return Math.round(clamp(value - penalty));
}

export function scoreLabel(score: number): string {
  return score >= 85 ? "Excellent opportunity" : score >= 70 ? "Strong opportunity" : score >= 55 ? "Worth exploring" : "Weak opportunity";
}

/** Impact factor from annual impact as a share of annual revenue: 6% -> 94. */
export function impactFactor(annualImpact: number, annualRevenue: number) {
  if (annualRevenue <= 0) return 50;
  return Math.round(clamp(40 + 9 * ((annualImpact / annualRevenue) * 100), 5, 99));
}

/** Revenue-opportunity factor from the absolute amount (log scale): $2M -> 95, $100K -> 69. */
export function revenueFactor(annualImpact: number) {
  if (annualImpact <= 0) return 5;
  return Math.round(clamp(20 * Math.log10(annualImpact) - 31, 5, 99));
}

export function impactLevel(annualImpact: number, annualRevenue: number): ImpactLevel {
  const share = annualRevenue > 0 ? annualImpact / annualRevenue : 0;
  return share >= 0.08 ? "Very high" : share >= 0.04 ? "High" : share >= 0.015 ? "Medium" : "Low";
}

export function levelOf(x: number): Level {
  return x < 35 ? "Low" : x < 65 ? "Medium" : "High";
}

/** For ranking: Very high = 4 ... Low = 1. */
export const IMPACT_RANK: Record<ImpactLevel, number> = { Low: 1, Medium: 2, High: 3, "Very high": 4 };
export const LEVEL_RANK: Record<Level, number> = { Low: 1, Medium: 2, High: 3 };
