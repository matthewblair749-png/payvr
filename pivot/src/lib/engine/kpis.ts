import { count, int, money, moneyDelta, monthLabel, pct, pctDelta, ptsDelta } from "../format";
import type { Facts } from "./facts";
import { word } from "./insights";
import { isNum, roughly } from "./series";
import type { Health, Kpi } from "./types";

/**
 * Overview KPI cards. Each card carries its own WHAT / WHY / SO WHAT /
 * NOW WHAT, so no number on the dashboard stands alone.
 */

const spark = (s: (number | null)[] | undefined, n: number) => (s ? s.slice(Math.max(0, n - 12), n).filter(isNum) : []);

export function computeKpis(f: Facts, health: Health): Kpi[] {
  const cur = f.currency;
  const n = f.periods.length;
  const month = f.period ? monthLabel(f.period).split(" ")[0] : "This month";
  const prevMonth = f.prevPeriod ? monthLabel(f.prevPeriod).split(" ")[0] : "last month";
  const kpis: Kpi[] = [];
  const retentionFalling = f.retention?.change != null && f.retention.change < -0.005;

  if (f.revenue) {
    const r = f.revenue;
    const drivers: string[] = [];
    const more = (x: number) => `${pctDelta(Math.abs(x)).replace("+", "")} ${x >= 0 ? "more" : "fewer"}`;
    if (f.customers?.change != null && f.arpc?.change != null)
      drivers.push(`${more(f.customers.change)} customers, each spending ${pctDelta(Math.abs(f.arpc.change)).replace("+", "")} ${f.arpc.change >= 0 ? "more" : "less"}`);
    const topContributor = [...f.products].sort((a, b) => b.contribution - a.contribution)[0];
    const fastest = f.topMover && f.topMover !== topContributor ? f.topMover : null;
    const fc = r.forecast.at(-1);
    kpis.push({
      key: "revenue",
      label: "Revenue",
      value: r.now,
      display: money(r.now, cur),
      change: r.change,
      changeDisplay: r.change !== null ? pctDelta(r.change) : null,
      good: r.change !== null ? r.change >= 0 : null,
      spark: spark(f.d.revenue, n),
      explain: {
        what: `Revenue was ${money(r.now, cur)} in ${month}${r.change !== null ? `, ${r.change >= 0 ? "up" : "down"} ${pctDelta(r.change).replace(/^[+−]/, "")} from ${prevMonth}` : ""}.`,
        why: drivers.length
          ? `It came from ${drivers[0]}.${topContributor && topContributor.contribution > 0 ? ` ${topContributor.name} added the most (${moneyDelta(topContributor.contribution, cur)})${fastest ? `; ${fastest.name} grew fastest` : ""}.` : ""}`
          : "Add customer counts to see whether growth came from more customers or bigger orders.",
        soWhat: r.fastestGrowth
          ? `It's the fastest month of growth in ${f.months} months${fc ? `. If the trend holds, revenue reaches about ${money(fc, cur)} a month in 3 months` : ""}.`
          : fc
            ? `If the trend holds, revenue reaches about ${money(fc, cur)} a month in 3 months.`
            : "PIVOT needs a few more months to project a trend.",
        nowWhat: retentionFalling
          ? "Protect the growth: retention is falling, so new revenue will leak unless that's fixed."
          : r.change !== null && r.change < 0
            ? "Find which products or customers drove the drop (see Insights)."
            : "Double down on what's driving it, and watch acquisition costs as you scale.",
      },
    });
  }

  if (f.customers) {
    const c = f.customers;
    kpis.push({
      key: "customers",
      label: "Customers",
      value: c.now,
      display: int(c.now),
      change: c.change,
      changeDisplay: c.change !== null ? pctDelta(c.change) : null,
      good: c.change !== null ? c.change >= 0 : null,
      spark: spark(f.d.customers, n),
      explain: {
        what: `${int(c.now)} active customers${c.change !== null ? `, ${pctDelta(c.change)} on ${prevMonth}` : ""}.`,
        why:
          f.newCustomers && f.churned
            ? `${int(f.newCustomers.now)} new customers joined and ${int(f.churned.now)} left${f.churned.rate !== null ? ` (${pct(f.churned.rate)} of last month's)` : ""}.`
            : "Add new and churned customers to see what's driving the change.",
        soWhat: f.cac
          ? `Each new customer cost ${money(f.cac.now, cur)}${f.cac.change !== null ? ` (${pctDelta(f.cac.change, 0)})` : ""}, so every customer kept is cheaper than one replaced.`
          : "Growth only sticks if new customers stay.",
        nowWhat: retentionFalling ? "Fix retention before spending more on acquisition." : "Keep acquisition efficient as you grow.",
      },
    });
  }

  if (f.profit) {
    const p = f.profit;
    const marginLine = p.marginNow !== null ? ` Margin ${pct(p.marginNow)}${p.marginPrev !== null ? ` (${ptsDelta(p.marginNow - p.marginPrev)})` : ""}.` : "";
    const costLines: string[] = [];
    if (f.marketing?.change != null && f.revenue?.change != null && f.marketing.change > f.revenue.change + 0.05)
      costLines.push(`marketing spend grew ${pctDelta(f.marketing.change, 0).replace("+", "")} against revenue's ${pctDelta(f.revenue.change).replace("+", "")}`);
    // A percentage change from a loss is meaningless, so show the money change then.
    const moved = p.prev !== null ? p.now - p.prev : null;
    const changeDisplay = p.change !== null ? pctDelta(p.change) : moved !== null ? moneyDelta(moved, cur) : null;
    kpis.push({
      key: "profit",
      label: "Profit",
      value: p.now,
      display: money(p.now, cur),
      change: p.change ?? (moved !== null ? moved / Math.max(1, Math.abs(p.prev!)) : null),
      changeDisplay,
      good: moved !== null ? moved >= 0 : null,
      spark: spark(f.d.profit, n),
      explain: {
        what: `${p.now < 0 ? `${money(-p.now, cur)} loss` : `${money(p.now, cur)} profit`} in ${month}${changeDisplay ? `, ${changeDisplay}` : ""}${p.change === null && p.prev !== null && p.prev < 0 ? ` from a ${money(-p.prev, cur)} loss` : ""}.${marginLine}`,
        why: costLines.length
          ? `Profit grew more slowly than revenue because ${costLines[0]}.`
          : p.change !== null && f.revenue?.change != null && p.change >= f.revenue.change
            ? "Costs grew more slowly than revenue."
            : "Costs grew roughly in line with revenue.",
        soWhat: f.revenue ? `Each point of margin is worth about ${money(roughly(f.revenue.now * 0.01 * 12), cur)} a year.` : "Margin is your room to invest.",
        nowWhat: costLines.length ? "Rebalance marketing toward cheaper channels before adding budget." : "Keep cost growth below revenue growth.",
      },
    });
  }

  if (f.retention) {
    const r = f.retention;
    const d = f.churnDriver;
    kpis.push({
      key: "retention",
      label: "Customer Retention",
      value: r.now,
      display: pct(r.now),
      change: r.change,
      changeDisplay: r.change !== null ? ptsDelta(r.change) : null,
      good: r.change !== null ? r.change >= 0 : null,
      spark: spark(f.d.retention, n),
      explain: {
        what: `${pct(r.now)} of last month's customers stayed${r.change !== null ? `, ${ptsDelta(r.change)}` : ""}.${r.declines >= 2 ? ` Down ${word(r.declines)} months in a row.` : ""}`,
        why: d
          ? `${d.segment.name} customers are leaving ${d.multiple.toFixed(1)}x faster than everyone else (${pct(d.segment.churnRateNow!)} vs ${pct(d.othersRateNow)}).`
          : "Add a customer segment column to see who's leaving.",
        soWhat: f.arpc && f.customers ? `Each point of retention is about ${count(roughly((f.customers.prev ?? f.customers.now) * 0.01))} customers a month, or ${money(roughly((f.customers.prev ?? f.customers.now) * 0.01 * f.arpc.now * 12), cur)} a year in revenue.` : "Lost customers have to be replaced at full acquisition cost.",
        nowWhat: d ? `Start with ${d.segment.name.toLowerCase()} customers: a targeted loyalty offer.` : r.change !== null && r.change < 0 ? "Talk to customers who left recently." : "Keep doing what's working.",
      },
    });
  }

  if (health.dimensions.length) {
    const sorted = [...health.dimensions].sort((a, b) => a.score - b.score);
    const weakest = sorted[0];
    const strongest = sorted[sorted.length - 1];
    const lifted = Math.round(health.dimensions.reduce((a, d) => a + (d === weakest ? Math.max(d.score, 90) : d.score), 0) / health.dimensions.length);
    kpis.push({
      key: "score",
      label: "AI PIVOT Score",
      value: health.score,
      display: `${health.score}/100`,
      change: null,
      changeDisplay: null,
      good: null,
      spark: [],
      explain: {
        what: `Your business scores ${health.score} out of 100: ${health.label.toLowerCase()}.`,
        why: `Strongest: ${strongest.label} (${strongest.score}). Weakest: ${weakest.label} (${weakest.score}). ${weakest.reason}`,
        soWhat: `${weakest.label} is what's holding the score back most.`,
        nowWhat: lifted > health.score ? `Bringing ${weakest.label.toLowerCase()} up to 90 would lift your score to about ${lifted}.` : "Keep every area moving in the same direction.",
      },
    });
  }

  return kpis;
}
