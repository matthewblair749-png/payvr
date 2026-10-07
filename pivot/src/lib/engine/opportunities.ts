import { money, pct, pctDelta } from "../format";
import type { Facts } from "./facts";
import { impactFactor, impactLevel, levelOf, pivotScore, revenueFactor, scoreLabel } from "./score";
import { clamp, isNum, roughly } from "./series";
import type { Baseline, Opportunity, ScoreFactors } from "./types";

/**
 * Opportunity detection. Each detector looks for a specific pattern in the
 * data, sizes it in dollars, scores it with the PIVOT Score, and explains in
 * plain language why it was found. Detectors only fire when their signal is
 * actually present, so a company with only revenue data gets fewer (but
 * honest) opportunities.
 */

/** Customer-months gained over 12 months from keeping 1 extra customer a month at retention r. */
export function customerMonths12(r: number) {
  const q = Math.min(0.995, Math.max(0.5, r));
  let total = 0;
  for (let k = 1; k <= 12; k++) total += (1 - q ** k) / (1 - q);
  return total;
}

export function detectOpportunities(f: Facts, b: Baseline | null): Opportunity[] {
  if (!f.revenue || !b) return [];
  const cur = f.currency;
  const R = f.revenue.now;
  const annual = R * 12;
  const market = Math.round(clamp(50 + (f.revenue.growth3 ?? 0) * 650, 30, 95));
  const dq = b.dataQuality;
  const arpc = f.arpc?.now ?? null;
  const periods12 = f.periods.slice(-12);
  const out: Opportunity[] = [];

  const make = (
    o: Omit<Opportunity, "score" | "scoreLabel" | "impact" | "effort" | "risk" | "confidence" | "factors"> & {
      factors: Omit<ScoreFactors, "impact" | "revenue" | "market"> & { market?: number };
    },
  ): Opportunity => {
    const factors: ScoreFactors = {
      impact: impactFactor(o.annualImpact, annual),
      revenue: revenueFactor(o.annualImpact),
      market: o.factors.market ?? market,
      demand: Math.round(clamp(o.factors.demand)),
      cost: Math.round(clamp(o.factors.cost)),
      difficulty: Math.round(clamp(o.factors.difficulty)),
      risk: Math.round(clamp(o.factors.risk)),
      confidence: Math.round(clamp(o.factors.confidence)),
    };
    const score = pivotScore(factors);
    return {
      ...o,
      annualImpact: roughly(o.annualImpact),
      factors,
      score,
      scoreLabel: scoreLabel(score),
      impact: impactLevel(o.annualImpact, annual),
      effort: levelOf(factors.difficulty),
      risk: levelOf(factors.risk),
      confidence: factors.confidence,
    };
  };

  // 1. A product with momentum -> take it to a new customer segment.
  const mover = f.topMover;
  if (mover && mover.demand60 !== null) {
    const rest = f.products.filter((p) => p !== mover);
    const restNow = rest.reduce((acc, p) => acc + p.revenueNow, 0);
    const rest2 = rest.every((p) => p.revenue2 !== null) ? rest.reduce((acc, p) => acc + (p.revenue2 ?? 0), 0) : null;
    const restGrowth = rest2 ? restNow / rest2 - 1 : null;
    const gain = mover.revenueNow * 12 * 0.28;
    const twice = restGrowth !== null && restGrowth > 0 && mover.demand60 >= restGrowth * 2;
    out.push(
      make({
        key: "expand-product",
        title: `Expand ${mover.name} into a new customer segment`,
        summary: `${mover.name} is your fastest-growing product. Offering it to a segment that doesn't buy it yet could add about ${money(roughly(gain), cur)} a year.`,
        whyFound: `${mover.name}'s demand grew ${pctDelta(mover.demand60, 0).replace("+", "")} in 60 days${twice && restGrowth !== null ? `, more than twice as fast as the rest of your catalog (${pctDelta(restGrowth, 0)})` : ""}. It's now ${pct(mover.shareNow, 0)} of revenue${mover.share60 !== null ? `, up from ${pct(mover.share60, 0)}` : ""}. Products with this kind of momentum usually have room to grow beyond the customers buying them today.`,
        annualImpact: gain,
        impactBasis: "revenue",
        plan: [
          `Pick the segment that buys least of ${mover.name} today and test a targeted offer.`,
          "Check stock and supply can handle 30% more demand.",
          `Give ${mover.name} more space on your site and in campaigns.`,
          "Review results after 30 days before scaling up.",
        ],
        simulate: { kind: "newMarket", value: 20 },
        factors: {
          demand: 50 + mover.demand60 * 133,
          cost: 78,
          difficulty: 42,
          risk: mover.shareNow < 0.1 ? 35 : 23,
          confidence: dq,
        },
        evidence: { chart: productChart(f, mover.name, periods12) ?? undefined },
      }),
    );
  }

  // 2. Churn concentrated in one segment -> win them back.
  const driver = f.churnDriver;
  if (driver && f.retention && arpc) {
    const s = driver.segment;
    const extraPerMonth = (s.churnRateNow! - s.churnRatePrev!) * s.customersPrev;
    const gain = extraPerMonth * customerMonths12(f.retention.avg12) * arpc * 0.8;
    out.push(
      make({
        key: "segment-winback",
        title: `Win back ${s.name.toLowerCase()} customers`,
        summary: `${s.name} customers are leaving ${driver.multiple.toFixed(1)}x faster than everyone else. Bringing their churn back to last month's level keeps about ${money(roughly(gain), cur)} of revenue a year.`,
        whyFound: `${pct(s.churnRateNow!)} of ${s.name.toLowerCase()} customers left last month, up from ${pct(s.churnRatePrev!)}. Everyone else left at ${pct(driver.othersRateNow)}. One segment is driving most of the drop in retention, which makes it a focused, fixable problem.`,
        annualImpact: gain,
        impactBasis: "revenue",
        plan: [
          `Survey ${s.name.toLowerCase()} customers who left in the last 30 days.`,
          "Offer a loyalty reward or bundle instead of a site-wide discount.",
          "Send a win-back email to customers who lapsed in the last 60 days.",
          "Track this segment's monthly churn as the success measure.",
        ],
        simulate: { kind: "price", value: -5 },
        factors: {
          demand: 55 + s.share * 110,
          cost: 82,
          difficulty: 45,
          risk: 18,
          confidence: dq - 3,
        },
        evidence: {
          table: {
            title: "Monthly churn by segment",
            columns: ["Segment", "Customers", "Churn last month", "Churn this month"],
            rows: f.segments.map((x) => [x.name, Math.round(x.customersPrev).toLocaleString("en-US"), x.churnRatePrev !== null ? pct(x.churnRatePrev) : "–", x.churnRateNow !== null ? pct(x.churnRateNow) : "–"]),
            highlightRow: f.segments.indexOf(s),
          },
        },
      }),
    );
  } else if (f.retention && f.retention.change !== null && f.retention.change <= -0.01 && arpc && f.customers) {
    // Retention fell, but we can't see which customers: a general retention push.
    const extraPerMonth = -f.retention.change * (f.customers.prev ?? f.customers.now);
    const gain = extraPerMonth * customerMonths12(f.retention.avg12) * arpc * 0.5;
    out.push(
      make({
        key: "retention-program",
        title: "Launch a retention program",
        summary: `Retention fell ${(-f.retention.change * 100).toFixed(1)} points. Recovering half of that keeps about ${money(roughly(gain), cur)} of revenue a year.`,
        whyFound: `Retention dropped from ${pct(f.retention.prev!)} to ${pct(f.retention.now)}. Your data doesn't say which customers are leaving; adding a segment column would let PIVOT pinpoint them.`,
        annualImpact: gain,
        impactBasis: "revenue",
        plan: ["Ask recent leavers why they left.", "Add a loyalty offer for repeat customers.", "Upload customer segments so PIVOT can find who's leaving."],
        simulate: { kind: "price", value: -5 },
        factors: { demand: 60, cost: 75, difficulty: 50, risk: 22, confidence: dq - 12 },
        evidence: {},
      }),
    );
  }

  // 3. One channel far more expensive than another -> move budget.
  const worst = f.worstChannel;
  const best = f.bestChannel;
  if (worst && best && worst.cacNow && best.cacNow) {
    const savings = worst.spendNow * 0.4 * 12;
    out.push(
      make({
        key: "channel-shift",
        title: `Move budget from ${worst.name} to ${best.name}`,
        summary: `${worst.name} customers cost ${money(worst.cacNow, cur)} each, ${(worst.cacNow / best.cacNow).toFixed(1)}x ${best.name}. Shifting budget saves about ${money(roughly(savings), cur)} a year for the same growth.`,
        whyFound: `Last month ${worst.name} took ${pct(worst.spendNow / (f.marketing?.now ?? worst.spendNow), 0)} of your marketing budget${worst.spendChange !== null && worst.spendChange > 0.2 ? ` (spend ${pctDelta(worst.spendChange, 0)})` : ""} but brought in its customers at ${money(worst.cacNow, cur)} each${worst.cacChange !== null && worst.cacChange > 0.1 ? `, up ${pctDelta(worst.cacChange, 0).replace("+", "")}` : ""}. ${best.name} brings them in at ${money(best.cacNow, cur)}.`,
        annualImpact: savings,
        impactBasis: "profit",
        plan: [
          `Cut ${worst.name} spend by 40%, starting with its most expensive campaigns.`,
          `Move half of the savings to ${best.name} and watch its cost per customer weekly.`,
          "Keep the rest as profit unless the cheaper channel keeps scaling.",
        ],
        simulate: { kind: "marketing", value: -20 },
        factors: { demand: 70, cost: 92, difficulty: 22, risk: 14, confidence: dq - 2, market: 75 },
        evidence: {
          table: {
            title: "Acquisition cost by channel (last month)",
            columns: ["Channel", "Spend", "New customers", "Cost per customer"],
            rows: f.channels.map((c) => [c.name, money(c.spendNow, cur), c.newNow !== null ? Math.round(c.newNow).toLocaleString("en-US") : "–", c.cacNow !== null ? money(c.cacNow, cur) : "–"]),
            highlightRow: f.channels.indexOf(worst),
          },
        },
      }),
    );
  }

  // 4. Two strong products -> bundle them.
  if (mover && f.products.length >= 2) {
    const partner = f.products.find((p) => p !== mover);
    if (partner) {
      const gain = mover.revenueNow * 0.08 * 12;
      out.push(
        make({
          key: "bundle",
          title: `Bundle ${mover.name} with ${partner.name}`,
          summary: `Pair your fastest grower with your biggest seller to lift order size. Worth about ${money(roughly(gain), cur)} a year.`,
          whyFound: `${partner.name} is your largest product (${pct(partner.shareNow, 0)} of revenue) and ${mover.name} is growing fastest. Bundling them puts new demand in front of your biggest customer base.`,
          annualImpact: gain,
          impactBasis: "revenue",
          plan: ["Create a bundle at a small discount to buying both.", "Feature it to existing customers of the larger product first.", "Measure order size and attach rate for 4 weeks."],
          simulate: { kind: "newProduct", value: 8 },
          factors: { demand: 68, cost: 85, difficulty: 30, risk: 22, confidence: dq - 14 },
          evidence: {},
        }),
      );
    }
  }

  // 5. A loyal, low-churn segment -> modest price increase there.
  const loyal = f.segments.filter((s) => s.churnRateNow !== null).sort((a, z) => a.churnRateNow! - z.churnRateNow!)[0];
  if (loyal && f.segments.length >= 2 && loyal.churnRateNow! < (1 - (f.retention?.now ?? 0.9)) * 0.7) {
    const gain = R * loyal.share * 0.05 * 0.92 * 12;
    out.push(
      make({
        key: "premium-pricing",
        title: `Raise prices 5% for ${loyal.name.toLowerCase()} customers`,
        summary: `${loyal.name} customers rarely leave, which suggests they'd accept a small increase. Worth about ${money(roughly(gain), cur)} a year.`,
        whyFound: `Only ${pct(loyal.churnRateNow!)} of ${loyal.name.toLowerCase()} customers left last month, the lowest of any segment. Price changes for everyone are risky here, so PIVOT suggests testing with your least price-sensitive customers only.`,
        annualImpact: gain,
        impactBasis: "revenue",
        plan: ["Test a 5% increase on new orders from this segment.", "Hold prices for price-sensitive customers.", "Watch this segment's churn for 6 weeks before rolling out."],
        simulate: { kind: "price", value: 5 },
        factors: { demand: 55, cost: 95, difficulty: 30, risk: 48, confidence: dq - 16 },
        evidence: {},
      }),
    );
  }

  // 6. Margin slipping -> operating efficiency.
  if (f.profit && f.profit.marginNow !== null && f.profit.margin6ago !== null && f.profit.marginNow < f.profit.margin6ago - 0.005 && b.opex > 0) {
    const savings = b.opex * 0.05 * 12;
    out.push(
      make({
        key: "cost-efficiency",
        title: "Trim operating costs by 5%",
        summary: `Margin is down ${((f.profit.margin6ago - f.profit.marginNow) * 100).toFixed(1)} points in 6 months. A 5% efficiency push adds about ${money(roughly(savings), cur)} a year to profit.`,
        whyFound: `Profit margin went from ${pct(f.profit.margin6ago)} to ${pct(f.profit.marginNow)} over 6 months. Small efficiency gains don't affect customers and pay off immediately.`,
        annualImpact: savings,
        impactBasis: "profit",
        plan: ["List your 10 largest operating costs.", "Renegotiate or consolidate the top three.", "Freeze non-essential spend for one quarter."],
        simulate: { kind: "costs", value: 5 },
        factors: { demand: 45, cost: 88, difficulty: 45, risk: 15, confidence: dq - 6, market: 70 },
        evidence: {},
      }),
    );
  }

  // 7. Cheap, stable acquisition -> scale marketing.
  if (f.cac && f.cac.change !== null && f.cac.change <= 0.02 && f.retention && arpc && f.marketing) {
    const ltv = (arpc * (1 - (f.costs?.variableRatio ?? 0.4))) / Math.max(0.01, 1 - f.retention.now);
    if (ltv / f.cac.now >= 3) {
      const extraN = (f.newCustomers?.now ?? 0) * (1.2 ** 0.55 - 1);
      const gain = extraN * customerMonths12(f.retention.now) * arpc;
      out.push(
        make({
          key: "scale-marketing",
          title: "Scale marketing while customers are cheap to win",
          summary: `Customers are worth ${(ltv / f.cac.now).toFixed(1)}x what they cost to acquire, and that cost isn't rising. A 20% bigger budget could add ${money(roughly(gain), cur)} a year.`,
          whyFound: `Acquisition cost held at ${money(f.cac.now, cur)} while each customer brings in about ${money(ltv, cur)} in gross profit over their lifetime.`,
          annualImpact: gain,
          impactBasis: "revenue",
          plan: ["Raise budget 20% on your most efficient channel.", "Watch cost per customer weekly.", "Stop increasing once it rises 15%."],
          simulate: { kind: "marketing", value: 20 },
          factors: { demand: 65, cost: 60, difficulty: 30, risk: 30, confidence: dq - 6 },
          evidence: {},
        }),
      );
    }
  }

  return out.sort((a, z) => z.score - a.score);
}

/** A product's monthly revenue vs. the rest of the catalog, last 12 months. */
function productChart(f: Facts, name: string, periods: string[]): Opportunity["evidence"]["chart"] | null {
  const series = f.productSeries[name];
  if (!series || !f.d.revenue) return null;
  const n = f.periods.length;
  const mine = series.slice(Math.max(0, n - 12), n);
  const total = f.d.revenue.slice(Math.max(0, n - 12), n);
  const others = total.map((t, k) => (isNum(t) && isNum(mine[k]) ? t - (mine[k] as number) : null));
  return {
    title: `${name} vs. the rest of the catalog`,
    periods,
    series: [
      { label: name, values: mine, kind: "actual", format: "money" },
      { label: "Other products", values: others, kind: "baseline", format: "money" },
    ],
  };
}
