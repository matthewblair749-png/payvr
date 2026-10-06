import { money, pct, pctDelta, ptsDelta } from "../format";
import type { Facts } from "./facts";
import { clamp, logistic } from "./series";
import type { Health, HealthDimension } from "./types";

/**
 * Business Health: six dimensions scored 0-100 from the data, and an overall
 * score (their average). Each curve is a logistic mapping of one or two
 * indicators, chosen so that "flat" sits around 60 and real trouble scores
 * below 40. Dimensions without data are listed with what would unlock them.
 */

const DEFAULT_VARIABLE_COST: Record<string, number> = { ecommerce: 0.4, retail: 0.5, saas: 0.2, services: 0.35, marketplace: 0.3, other: 0.4 };

export function healthLabel(score: number): Health["label"] {
  return score >= 85 ? "Strong" : score >= 70 ? "Healthy" : score >= 55 ? "Needs attention" : "At risk";
}

const trendOf = (x: number | null | undefined, eps = 0.002) => (x == null ? "flat" : x > eps ? "up" : x < -eps ? "down" : "flat");

export function computeHealth(f: Facts): Health {
  const dims: HealthDimension[] = [];
  const missing: Health["missing"] = [];
  const cur = f.currency;

  // Revenue: compound monthly growth over the last 3 months.
  if (f.revenue && f.revenue.growth3 !== null) {
    const g = f.revenue.growth3;
    dims.push({
      key: "revenue",
      label: "Revenue",
      score: Math.round(logistic(g, -0.012, 0.0295)),
      reason: `${g >= 0 ? "Growing" : "Shrinking"} ${pct(Math.abs(g))} a month over the last 3 months.`,
      trend: trendOf(f.revenue.change),
    });
  } else missing.push({ label: "Revenue", needs: "at least 2 months of revenue" });

  // Customers: customer growth, held back when churn is rising.
  if (f.customers && f.customers.growth3 !== null) {
    const g = f.customers.growth3;
    const churnPenalty = f.retention?.change != null && f.retention.change < 0 ? Math.min(10, -f.retention.change * 240) : 0;
    dims.push({
      key: "customers",
      label: "Customers",
      score: Math.round(clamp(logistic(g, -0.012, 0.0295) - churnPenalty)),
      reason:
        churnPenalty > 1
          ? `Up ${pct(g)} a month, but more customers are leaving.`
          : `${g >= 0 ? "Up" : "Down"} ${pct(Math.abs(g))} a month over the last 3 months.`,
      trend: trendOf(f.customers.change),
    });
  } else missing.push({ label: "Customers", needs: "a customers column" });

  // Retention: the level, minus a penalty for a falling trend.
  if (f.retention) {
    const r = f.retention;
    const fall = r.change != null && r.change < 0 ? r.declines * 0.5 + -r.change * 250 : 0;
    dims.push({
      key: "retention",
      label: "Retention",
      score: Math.round(clamp(logistic(r.now, 0.875, 0.022) - Math.min(15, fall))),
      reason:
        r.declines >= 2
          ? `${pct(r.now)} and down ${r.declines} months in a row.`
          : r.change != null && Math.abs(r.change) >= 0.002
            ? `${pct(r.now)}, ${ptsDelta(r.change)} on last month.`
            : `${pct(r.now)} of customers stay each month.`,
      trend: trendOf(r.change, 0.0005),
    });
  } else missing.push({ label: "Retention", needs: "customers plus churned or new customers" });

  // Operations: profit margin, nudged by its direction vs. the same month last year
  // (or 6 months ago with less history), so seasonal swings don't count as drift.
  if (f.profit && f.profit.marginNow !== null) {
    const m = f.profit.marginNow;
    const ref = f.profit.margin12ago ?? f.profit.margin6ago;
    const refLabel = f.profit.margin12ago !== null ? "on last year" : "in 6 months";
    const drift = ref !== null ? (m - ref) * 12 : 0;
    dims.push({
      key: "operations",
      label: "Operations",
      score: Math.round(clamp(logistic(m, 0.08, 0.07) + clamp(drift, -6, 4))),
      reason: `${pct(m)} profit margin${ref !== null ? `, ${ptsDelta(m - ref)} ${refLabel}` : ""}.`,
      trend: trendOf(f.profit.marginPrev !== null ? m - f.profit.marginPrev : null),
    });
  } else missing.push({ label: "Operations", needs: "costs (cost of goods or operating expenses)" });

  // Marketing: customer lifetime value vs acquisition cost, minus rising-CAC and channel penalties.
  if (f.cac) {
    const grossMargin = 1 - (f.costs?.variableRatio ?? DEFAULT_VARIABLE_COST[f.industry]);
    const churn = f.retention ? Math.max(0.01, 1 - f.retention.now) : null;
    const ltv = f.arpc && churn ? (f.arpc.now * grossMargin) / churn : null;
    const ratio = ltv !== null ? ltv / f.cac.now : null;
    const base = ratio !== null ? logistic(ratio, 2, 1.2) : 75;
    const rising = f.cac.change !== null && f.cac.change > 0 ? f.cac.change * 65 : 0;
    const channelGap = f.worstChannel && f.bestChannel && f.worstChannel.cacNow! >= f.bestChannel.cacNow! * 2.5 ? 4 : 0;
    dims.push({
      key: "marketing",
      label: "Marketing",
      score: Math.round(clamp(base - rising - channelGap)),
      reason:
        f.cac.change !== null && f.cac.change > 0.05
          ? `Each new customer costs ${money(f.cac.now, cur)}, ${pctDelta(f.cac.change)} on last month.`
          : ratio !== null
            ? `Customers are worth ${ratio.toFixed(1)}x what they cost to acquire.`
            : `Each new customer costs ${money(f.cac.now, cur)}.`,
      trend: trendOf(f.cac.change !== null ? -f.cac.change : null),
    });
  } else missing.push({ label: "Marketing", needs: "marketing spend and new customers" });

  // Products: how broad growth is, plus momentum, minus concentration risk.
  if (f.products.length >= 2) {
    const growing = f.products.filter((p) => (p.demand60 ?? 0) > 0).length / f.products.length;
    const momentum = Math.min(10, Math.max(0, (f.topMover?.demand60 ?? 0) * 30));
    const top = f.products[0];
    const concentration = top.shareNow > 0.5 ? (top.shareNow - 0.5) * 60 : 0;
    dims.push({
      key: "products",
      label: "Products",
      score: Math.round(clamp(55 + 25 * growing + momentum - concentration)),
      reason: f.topMover
        ? `${f.topMover.name} demand ${pctDelta(f.topMover.demand60!, 0)} in 60 days; ${Math.round(growing * f.products.length)} of ${f.products.length} products growing.`
        : `${Math.round(growing * f.products.length)} of ${f.products.length} products growing.`,
      trend: trendOf(f.topMover?.demand60 ?? null),
    });
  } else missing.push({ label: "Products", needs: "revenue by product" });

  const score = dims.length ? Math.round(dims.reduce((a, d) => a + d.score, 0) / dims.length) : 0;
  return { score, label: healthLabel(score), dimensions: dims, missing };
}
