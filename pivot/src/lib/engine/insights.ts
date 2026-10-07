import { int, money, monthLabel, pct, pctDelta } from "../format";
import type { Facts } from "./facts";
import { customerMonths12 } from "./opportunities";
import { isNum, latestZ, roughly } from "./series";
import type { Change, ChartSeries, Evidence, Insight, Series } from "./types";

/**
 * Insight rules. Each one looks for a specific change, and when it finds
 * one, answers four questions in plain language:
 *   WHAT changed, WHY it changed, SO WHAT (why it matters), NOW WHAT.
 * The "why" uses breakdowns (segments, channels, products) when the data has
 * them, and says what data is missing when it doesn't. Never a guess.
 */

const WORDS = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten"];
export const word = (n: number) => WORDS[n] ?? String(n);

function trend(f: Facts, values: Series | undefined, label: string, format: ChartSeries["format"]): Evidence["chart"] | undefined {
  if (!values) return undefined;
  const n = f.periods.length;
  const v = values.slice(Math.max(0, n - 12), n);
  if (v.filter(isNum).length < 3) return undefined;
  return { title: `${label}, last ${v.length} months`, periods: f.periods.slice(Math.max(0, n - 12)), series: [{ label, values: v, kind: "actual", format }] };
}

export function detectInsights(f: Facts): Insight[] {
  const out: Insight[] = [];
  const cur = f.currency;
  const month = f.period ? monthLabel(f.period).split(" ")[0] : "this month";

  // Retention falling ---------------------------------------------------------
  const r = f.retention;
  if (r && r.change !== null && (r.change <= -0.01 || (r.declines >= 3 && r.change < 0))) {
    const severe = r.change <= -0.015 || r.declines >= 3;
    const prevCust = f.customers?.prev ?? null;
    const extraLeft = prevCust !== null ? Math.max(0, (r.avg12 - r.now) * prevCust) : null;
    const atRisk = extraLeft !== null && f.arpc ? extraLeft * customerMonths12(r.avg12) * f.arpc.now : null;
    const d = f.churnDriver;
    const why = d
      ? `Customers in the ${d.segment.name.toLowerCase()} segment are leaving at a higher rate: ${pct(d.segment.churnRateNow!)} left last month, ${d.multiple.toFixed(1)}x the rate of everyone else (${pct(d.othersRateNow)}).`
      : f.cac && f.cac.change !== null && f.cac.change > 0.1
        ? "Your data doesn't include customer segments, so PIVOT can't see which customers are leaving yet. The drop started as acquisition spending rose, which often brings in less loyal customers."
        : "Your data doesn't include customer segments, so PIVOT can't see which customers are leaving yet. Add a segment column to find out.";
    out.push({
      key: "retention-decline",
      severity: severe ? "ACTION" : "WATCH",
      title: "Customer retention is declining.",
      what: `Retention decreased ${(-r.change * 100).toFixed(1)} points this month, to ${pct(r.now)}${r.declines >= 2 ? `. It has fallen ${word(r.declines)} months in a row` : ""}.`,
      why: d ? `Potential cause: ${why.charAt(0).toLowerCase()}${why.slice(1)}` : why,
      soWhat:
        extraLeft !== null && atRisk !== null && extraLeft >= 1
          ? `About ${int(roughly(extraLeft))} more customers left than in a typical month. If retention stays here, that's roughly ${money(roughly(atRisk), cur)} of revenue lost over the next 12 months.`
          : "Every point of retention lost has to be replaced with new customers, who cost more to win.",
      nowWhat: d
        ? `Focus on ${d.segment.name.toLowerCase()} customers first with a targeted loyalty offer, not a site-wide discount. Hold off on price increases until retention recovers.`
        : "Talk to customers who left recently, and add segment data so PIVOT can show who's leaving.",
      metric: "retention",
      actionLabel: "Investigate",
      related: { opportunity: d ? "segment-winback" : "retention-program", recommendation: "improve-retention" },
      evidence: {
        chart: trend(f, f.d.retention, "Retention", "percent"),
        table: d
          ? {
              title: "Monthly churn by segment",
              columns: ["Segment", "Customers", "Churn last month", "Churn this month"],
              rows: f.segments.map((s) => [s.name, int(s.customersPrev), s.churnRatePrev !== null ? pct(s.churnRatePrev) : "–", s.churnRateNow !== null ? pct(s.churnRateNow) : "–"]),
              highlightRow: f.segments.indexOf(d.segment),
            }
          : undefined,
      },
      weight: (severe ? 300 : 120) + -r.change * 2000,
    });
  }

  // Revenue falling -----------------------------------------------------------
  const rev = f.revenue;
  if (rev && rev.change !== null && rev.change <= -0.02) {
    const worst = [...f.products].sort((a, b) => a.contribution - b.contribution)[0];
    const parts: string[] = [];
    if (f.customers?.change != null) parts.push(`customers ${pctDelta(f.customers.change)}`);
    if (f.arpc?.change != null) parts.push(`revenue per customer ${pctDelta(f.arpc.change)}`);
    out.push({
      key: "revenue-decline",
      severity: rev.change <= -0.05 ? "ACTION" : "WATCH",
      title: "Revenue is declining.",
      what: `Revenue fell ${pctDelta(rev.change).replace("−", "")} in ${month}, to ${money(rev.now, cur)}.`,
      why: `${parts.length ? `The drop breaks down into ${parts.join(" and ")}.` : "PIVOT needs customer counts to break this down further."}${worst && worst.contribution < 0 ? ` ${worst.name} lost the most (${money(worst.contribution, cur)}).` : ""}`,
      soWhat: `At this month's level, the year ahead runs ${money(Math.abs((rev.prev ?? rev.now) - rev.now) * 12, cur)} below last month's pace.`,
      nowWhat: worst && worst.contribution < 0 ? `Start with ${worst.name}: check stock, pricing and recent changes.` : "Check whether fewer customers or smaller orders drove it, then act on that.",
      metric: "revenue",
      actionLabel: "Investigate",
      related: {},
      evidence: { chart: trend(f, f.d.revenue, "Revenue", "money") },
      weight: (rev.change <= -0.05 ? 290 : 110) + -rev.change * 1000,
    });
  }

  // Product momentum ----------------------------------------------------------
  const mv = f.topMover;
  if (mv && mv.demand60 !== null) {
    const rest = f.products.filter((p) => p !== mv);
    const restNow = rest.reduce((a, p) => a + p.revenueNow, 0);
    const rest2 = rest.every((p) => p.revenue2 !== null) ? rest.reduce((a, p) => a + (p.revenue2 ?? 0), 0) : null;
    const restG = rest2 ? restNow / rest2 - 1 : null;
    const monthly = (1 + mv.demand60) ** 0.5 - 1;
    const addHalfPace = mv.revenueNow * ((1 + monthly / 2) ** 3 - 1);
    out.push({
      key: "product-momentum",
      severity: "OPPORTUNITY",
      title: `${mv.name} demand is accelerating.`,
      what: `Demand for ${mv.name} increased ${pctDelta(mv.demand60, 0).replace("+", "")} over the last 60 days.`,
      why: `${restG !== null && restG >= 0 && mv.demand60 >= restG * 2 ? `It's growing more than twice as fast as the rest of your catalog (${pctDelta(restG, 0)}), and` : "It"} now makes up ${pct(mv.shareNow, 0)} of revenue${mv.share60 !== null ? `, up from ${pct(mv.share60, 0)}` : ""}.`,
      soWhat: `Even at half this pace, ${mv.name} would add about ${money(roughly(addHalfPace), cur)} a month by the end of next quarter.`,
      nowWhat: `Keep it in stock, give it more visibility, and test it with a customer segment that doesn't buy it yet.`,
      metric: "revenue",
      actionLabel: "Explore opportunity",
      related: { opportunity: "expand-product", recommendation: "invest-product" },
      evidence: {
        chart: (() => {
          const s = f.productSeries[mv.name];
          if (!s || !f.d.revenue) return undefined;
          const n = f.periods.length;
          const from = Math.max(0, n - 12);
          const mine = s.slice(from, n);
          return {
            title: `${mv.name} vs. the rest of the catalog`,
            periods: f.periods.slice(from),
            series: [
              { label: mv.name, values: mine, kind: "actual" as const, format: "money" as const },
              { label: "Other products", values: f.d.revenue.slice(from, n).map((t, k) => (isNum(t) && isNum(mine[k]) ? t - (mine[k] as number) : null)), kind: "baseline" as const, format: "money" as const },
            ],
          };
        })(),
      },
      weight: 200 + mv.demand60 * 100,
    });
  }

  // Acquisition getting expensive -----------------------------------------------
  const cac = f.cac;
  if (cac && cac.change !== null && cac.change >= 0.1) {
    const w = f.worstChannel;
    const b = f.bestChannel;
    const spendUp = f.marketing?.change ?? null;
    const newUp = f.newCustomers?.change ?? null;
    const marginSlip = f.profit && f.profit.marginNow !== null && f.profit.marginPrev !== null && f.profit.marginNow < f.profit.marginPrev - 0.003;
    out.push({
      key: "cac-rising",
      severity: "WATCH",
      title: "Marketing costs increased.",
      what: `Customer acquisition cost increased ${pctDelta(cac.change, 0).replace("+", "")}, to ${money(cac.now, cur)} per new customer.`,
      why: `${spendUp !== null && newUp !== null ? `Marketing spend rose ${pctDelta(spendUp, 0).replace("+", "")} while new customers rose ${pctDelta(newUp, 0).replace("+", "")}.` : "Spend grew faster than new customers."}${w && b && w.cacNow && b.cacNow ? ` ${w.spendChange !== null && w.spendChange > 0.25 ? "Much of the extra budget went to " : "The most expensive channel is "}${w.name}, where each customer now costs ${money(w.cacNow, cur)}, ${(w.cacNow / b.cacNow).toFixed(1)}x ${b.name} (${money(b.cacNow, cur)}).` : ""}`,
      soWhat:
        marginSlip && f.profit && f.revenue && f.profit.change !== null && f.profit.change >= 0 && f.revenue.change !== null
          ? `Profit grew ${pctDelta(f.profit.change)} while revenue grew ${pctDelta(f.revenue.change)}: margin slipped from ${pct(f.profit.marginPrev!)} to ${pct(f.profit.marginNow!)}. Rising acquisition costs are eating into growth.`
          : `Each new customer now takes longer to pay back their acquisition cost.`,
      nowWhat: w && b ? `Shift budget from ${w.name} to ${b.name} before increasing total spend.` : "Find which campaigns got more expensive and pause the worst before adding budget.",
      metric: "marketingSpend",
      actionLabel: "Analyze",
      related: { opportunity: w ? "channel-shift" : undefined, recommendation: w ? "reduce-channel" : undefined },
      evidence: {
        chart: trend(f, f.d.cac, "Cost per new customer", "money"),
        table: f.channels.length
          ? {
              title: "Acquisition cost by channel (last month)",
              columns: ["Channel", "Spend", "Change", "Cost per customer"],
              rows: f.channels.map((c) => [c.name, money(c.spendNow, cur), c.spendChange !== null ? pctDelta(c.spendChange, 0) : "–", c.cacNow !== null ? money(c.cacNow, cur) : "–"]),
              highlightRow: w ? f.channels.indexOf(w) : undefined,
            }
          : undefined,
      },
      weight: 100 + cac.change * 200,
    });
  }

  // Margin squeeze (only when acquisition cost isn't already the story) -------
  const p = f.profit;
  if (!out.some((i) => i.key === "cac-rising") && p && p.marginNow !== null && p.marginPrev !== null && p.marginNow <= p.marginPrev - 0.01) {
    out.push({
      key: "margin-squeeze",
      severity: "WATCH",
      title: "Profit margin is shrinking.",
      what: `Margin fell from ${pct(p.marginPrev)} to ${pct(p.marginNow)} in ${month}.`,
      why: f.costs?.variableRatio != null ? "Costs grew faster than revenue this month." : "Costs grew faster than revenue. Add cost of goods and operating costs separately to see which.",
      soWhat: f.revenue ? `Each point of margin is worth about ${money(roughly(f.revenue.now * 0.01 * 12), cur)} a year.` : "Lower margin leaves less room to invest.",
      nowWhat: "Review your largest cost lines and recent price changes.",
      metric: "profit",
      actionLabel: "Analyze",
      related: { opportunity: "cost-efficiency" },
      evidence: { chart: trend(f, f.d.margin, "Profit margin", "percent") },
      weight: 100 + (p.marginPrev - p.marginNow) * 1000,
    });
  }

  // Conversion dropping ---------------------------------------------------------
  const conv = f.conversion;
  if (conv && conv.change !== null && conv.change <= -0.1) {
    out.push({
      key: "conversion-drop",
      severity: conv.change <= -0.2 ? "ACTION" : "WATCH",
      title: "Fewer visitors are buying.",
      what: `Conversion fell ${pctDelta(conv.change, 0).replace("−", "")}, to ${pct(conv.now, 2)} of visitors.`,
      why: "Traffic quality or the buying experience changed. Check new traffic sources, site speed and checkout errors.",
      soWhat: f.revenue ? `Getting back to last month's rate would be worth about ${money(roughly(f.revenue.now * (1 / (1 + conv.change) - 1)), cur)} a month.` : "Lower conversion makes every marketing dollar work less.",
      nowWhat: "Look at where visitors drop off, starting with checkout.",
      metric: "conversionRate",
      actionLabel: "Investigate",
      related: {},
      evidence: { chart: trend(f, f.d.conversion, "Conversion rate", "percent") },
      weight: 150 + -conv.change * 300,
    });
  }

  // Concentration risk ------------------------------------------------------------
  const top = f.products[0];
  if (top && f.products.length >= 2 && top.shareNow >= 0.5) {
    out.push({
      key: "concentration",
      severity: "WATCH",
      title: `${top.name} carries most of your revenue.`,
      what: `${top.name} is ${pct(top.shareNow, 0)} of revenue.`,
      why: "Your other products haven't kept pace.",
      soWhat: `A problem with ${top.name} (supply, a competitor, a price change) would hit the whole business.`,
      nowWhat: "Grow a second product line so no single product is more than 40% of revenue.",
      metric: "revenue",
      actionLabel: "Analyze",
      related: {},
      evidence: {},
      weight: 90 + top.shareNow * 50,
    });
  }

  // Unusual swings (anomalies) ------------------------------------------------------
  for (const [key, label, values] of [
    ["orders", "orders", f.d.orders],
    ["visitors", "website traffic", f.d.visitors],
  ] as const) {
    const z = latestZ(values);
    // A swing that matches revenue's own move is growth (or decline), not an anomaly.
    const n = values?.length ?? 0;
    const move = values && n >= 2 && isNum(values[n - 1]) && isNum(values[n - 2]) && (values[n - 2] as number) > 0 ? (values[n - 1] as number) / (values[n - 2] as number) - 1 : null;
    const explained = move !== null && rev?.change != null && Math.sign(move) === Math.sign(rev.change) && Math.abs(move - rev.change) < 0.1;
    if (z !== null && Math.abs(z) >= 3 && !explained && !out.some((i) => i.metric === key)) {
      out.push({
        key: `anomaly-${key}`,
        severity: "WATCH",
        title: `Unusual ${label} this month.`,
        what: `${label.charAt(0).toUpperCase() + label.slice(1)} ${z > 0 ? "jumped" : "dropped"} well outside the normal range for the last year.`,
        why: "One-off events (a promotion, an outage, a tracking change) often cause swings like this.",
        soWhat: "If it's a tracking issue, other numbers built on it may be off too.",
        nowWhat: "Confirm the number is real before acting on it.",
        metric: key,
        actionLabel: "Investigate",
        related: {},
        evidence: { chart: trend(f, values, label.charAt(0).toUpperCase() + label.slice(1), "count") },
        weight: 80 + Math.abs(z) * 5,
      });
    }
  }

  return out.sort((a, b) => b.weight - a.weight);
}

/** "What's changing?": the 3 biggest moves, good or bad. */
export function detectChanges(f: Facts): Change[] {
  const out: (Change & { size: number })[] = [];
  const rev = f.revenue;
  if (rev && rev.change !== null && Math.abs(rev.change) >= 0.02) {
    const accel = rev.change > 0 && rev.priorAvgGrowth !== null && rev.change > rev.priorAvgGrowth + 0.02;
    out.push({
      key: "revenue",
      title: rev.change > 0 ? (accel ? "Revenue is accelerating" : "Revenue is growing") : "Revenue is falling",
      detail: `Revenue ${rev.change > 0 ? "increased" : "decreased"} ${pctDelta(rev.change).replace(/^[+−]/, "")} over the previous period.`,
      direction: rev.change > 0 ? "up" : "down",
      good: rev.change > 0,
      size: Math.abs(rev.change) * (accel ? 3 : 1.5),
    });
  }
  const r = f.retention;
  if (r && r.change !== null && Math.abs(r.change) >= 0.005) {
    out.push({
      key: "retention",
      title: r.change < 0 ? "Customer retention is declining" : "Customer retention is improving",
      detail: `Retention ${r.change < 0 ? "dropped" : "rose"} ${(Math.abs(r.change) * 100).toFixed(1)} points.`,
      direction: r.change > 0 ? "up" : "down",
      good: r.change > 0,
      size: Math.abs(r.change) * 15,
    });
  }
  if (f.topMover?.demand60 != null) {
    out.push({
      key: "product",
      title: `${f.topMover.name} is gaining momentum`,
      detail: `Demand increased ${pctDelta(f.topMover.demand60, 0).replace("+", "")}.`,
      direction: "up",
      good: true,
      size: f.topMover.demand60,
    });
  }
  if (f.cac?.change != null && Math.abs(f.cac.change) >= 0.1) {
    out.push({
      key: "cac",
      title: f.cac.change > 0 ? "Acquisition is getting more expensive" : "Acquisition is getting cheaper",
      detail: `Cost per new customer ${f.cac.change > 0 ? "rose" : "fell"} ${pctDelta(f.cac.change, 0).replace(/^[+−]/, "")}.`,
      direction: f.cac.change > 0 ? "up" : "down",
      good: f.cac.change < 0,
      size: Math.abs(f.cac.change) * 0.9,
    });
  }
  if (f.customers?.change != null && Math.abs(f.customers.change) >= 0.03) {
    out.push({
      key: "customers",
      title: f.customers.change > 0 ? "Customer base is growing" : "Customer base is shrinking",
      detail: `Active customers ${f.customers.change > 0 ? "up" : "down"} ${pctDelta(f.customers.change).replace(/^[+−]/, "")}.`,
      direction: f.customers.change > 0 ? "up" : "down",
      good: f.customers.change > 0,
      size: Math.abs(f.customers.change),
    });
  }
  if (f.profit?.change != null && Math.abs(f.profit.change) >= 0.05) {
    out.push({
      key: "profit",
      title: f.profit.change > 0 ? "Profit is up" : "Profit is down",
      detail: `Profit ${f.profit.change > 0 ? "rose" : "fell"} ${pctDelta(f.profit.change).replace(/^[+−]/, "")}.`,
      direction: f.profit.change > 0 ? "up" : "down",
      good: f.profit.change > 0,
      size: Math.abs(f.profit.change) * 0.8,
    });
  }
  return out
    .sort((a, b) => b.size - a.size)
    .slice(0, 3)
    .map((c): Change => ({ key: c.key, title: c.title, detail: c.detail, direction: c.direction, good: c.good }));
}
