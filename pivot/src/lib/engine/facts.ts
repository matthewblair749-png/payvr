import { derive, type Derived } from "./derive";
import { at, cagr, consecutiveDeclines, forecast, isNum, mean, ratioChange, sum } from "./series";
import type { BusinessData, Industry, Series } from "./types";

/**
 * Facts: every number the rest of the engine (and the AI layer) is allowed
 * to talk about, computed once. KPIs, insights, opportunities,
 * recommendations, summaries and Ask PIVOT answers all read from here, so
 * they can never disagree with each other.
 */

export interface ProductFact {
  name: string;
  revenueNow: number;
  revenuePrev: number | null;
  /** Revenue two months back (for ~60-day comparisons). */
  revenue2: number | null;
  /** Revenue added vs last month. */
  contribution: number;
  /** Demand change over ~60 days (units if known, else revenue): now vs 2 months back. */
  demand60: number | null;
  demandBasis: "units" | "revenue";
  shareNow: number;
  share60: number | null;
}

export interface ChannelFact {
  name: string;
  spendNow: number;
  spendPrev: number | null;
  newNow: number | null;
  cacNow: number | null;
  cacPrev: number | null;
  cacChange: number | null;
  spendChange: number | null;
}

export interface SegmentFact {
  name: string;
  customersPrev: number;
  churnRateNow: number | null;
  churnRatePrev: number | null;
  share: number;
}

export interface Facts {
  name: string;
  currency: string;
  industry: Industry;
  marketSharePct: number | null;
  periods: string[];
  months: number;
  period: string;
  prevPeriod: string | null;
  d: Derived;

  revenue: null | {
    now: number;
    prev: number | null;
    change: number | null;
    /** Average monthly growth over the 6 months before the latest one. */
    priorAvgGrowth: number | null;
    growth3: number | null;
    /** True when this month's growth is the highest in the data. */
    fastestGrowth: boolean;
    forecast: number[];
  };
  customers: null | { now: number; prev: number | null; change: number | null; growth3: number | null };
  newCustomers: null | { now: number; prev: number | null; change: number | null };
  churned: null | { now: number; rate: number | null };
  arpc: null | { now: number; prev: number | null; change: number | null };
  profit: null | { now: number; prev: number | null; change: number | null; marginNow: number | null; marginPrev: number | null; margin6ago: number | null; margin12ago: number | null };
  retention: null | { now: number; prev: number | null; change: number | null; declines: number; avg12: number };
  marketing: null | { now: number; prev: number | null; change: number | null; shareOfRevenue: number | null };
  cac: null | { now: number; prev: number | null; change: number | null; avg6: number | null };
  conversion: null | { now: number; prev: number | null; change: number | null };
  aov: null | { now: number; prev: number | null; change: number | null };
  costs: null | { variableRatio: number | null; opex: number | null; cogs: number | null };

  products: ProductFact[];
  /** Monthly revenue by product, aligned with `periods`. */
  productSeries: Record<string, Series>;
  channels: ChannelFact[];
  segments: SegmentFact[];

  topMover: ProductFact | null;
  /** Channel with the highest CAC, if it's well above the best one. */
  worstChannel: ChannelFact | null;
  bestChannel: ChannelFact | null;
  /** Segment whose churn rose the most. */
  churnDriver: null | { segment: SegmentFact; othersRateNow: number; multiple: number };
}

function lastIdx(s: Series | undefined): number {
  if (!s) return -1;
  for (let i = s.length - 1; i >= 0; i--) if (isNum(s[i])) return i;
  return -1;
}

function pair(s: Series | undefined, i: number) {
  const now = at(s, i);
  if (now === null) return null;
  const prev = at(s, i - 1);
  return { now, prev, change: ratioChange(now, prev) };
}

export function computeFacts(data: BusinessData): Facts {
  const d = derive(data);
  const n = d.n;
  // The latest month is the latest month with revenue (or any data).
  let i = lastIdx(d.revenue);
  if (i < 0) i = n - 1;
  const period = data.periods[i] ?? "";
  const prevPeriod = i > 0 ? data.periods[i - 1] : null;

  const rev = pair(d.revenue, i);
  let revenue: Facts["revenue"] = null;
  if (rev) {
    const growths: number[] = [];
    for (let k = 1; k <= i; k++) {
      const g = ratioChange(at(d.revenue, k), at(d.revenue, k - 1));
      if (g !== null) growths.push(g);
    }
    const prior = growths.slice(-7, -1);
    revenue = {
      ...rev,
      priorAvgGrowth: prior.length ? mean(prior) : null,
      growth3: cagr(d.revenue!.slice(0, i + 1), Math.min(3, i)),
      fastestGrowth: growths.length >= 6 && rev.change !== null && rev.change >= Math.max(...growths) - 1e-9,
      forecast: forecast(d.revenue!.slice(0, i + 1), 3),
    };
  }

  const cust = pair(d.customers, i);
  const customers = cust ? { ...cust, growth3: cagr(d.customers!.slice(0, i + 1), Math.min(3, i)) } : null;
  const newCustomers = pair(d.newCustomers, i);
  const churnedNow = at(d.churned, i);
  const prevCust = at(d.customers, i - 1);
  const churned = churnedNow !== null ? { now: churnedNow, rate: prevCust ? churnedNow / prevCust : null } : null;

  const arpc = pair(d.arpc, i);
  const prof = pair(d.profit, i);
  const profit = prof
    ? { ...prof, marginNow: at(d.margin, i), marginPrev: at(d.margin, i - 1), margin6ago: at(d.margin, i - 6), margin12ago: at(d.margin, i - 12) }
    : null;

  const ret = pair(d.retention, i);
  const retention = ret
    ? {
        now: ret.now,
        prev: ret.prev,
        change: ret.prev !== null ? ret.now - ret.prev : null,
        declines: consecutiveDeclines(d.retention!.slice(0, i + 1)),
        avg12: mean(d.retention!.slice(Math.max(0, i - 12), i).filter(isNum)),
      }
    : null;

  const mk = pair(d.marketing, i);
  const marketing = mk ? { ...mk, shareOfRevenue: rev ? mk.now / rev.now : null } : null;
  const cacP = pair(d.cac, i);
  const cac = cacP ? { ...cacP, avg6: mean(d.cac!.slice(Math.max(0, i - 6), i).filter(isNum)) || null } : null;
  const conversion = pair(d.conversion, i);
  const aov = pair(d.aov, i);

  const cogsNow = at(d.cogs, i);
  const costs =
    cogsNow !== null || at(d.opex, i) !== null
      ? { variableRatio: cogsNow !== null && rev ? cogsNow / rev.now : null, opex: at(d.opex, i), cogs: cogsNow }
      : null;

  // Products
  const revTotal = rev?.now ?? 0;
  const products: ProductFact[] = Object.entries(data.products)
    .map(([name, p]) => {
      const now = at(p.revenue, i);
      if (now === null) return null;
      const prevR = at(p.revenue, i - 1);
      const unitsNow = at(p.units, i);
      const units2 = at(p.units, i - 2);
      const rev2 = at(p.revenue, i - 2);
      const useUnits = unitsNow !== null && units2 !== null;
      const totalNow = revTotal || sum(Object.values(data.products).map((q) => at(q.revenue, i) ?? 0));
      const total2 = at(d.revenue, i - 2) ?? sum(Object.values(data.products).map((q) => at(q.revenue, i - 2) ?? 0));
      return {
        name,
        revenueNow: now,
        revenuePrev: prevR,
        revenue2: rev2,
        contribution: prevR !== null ? now - prevR : 0,
        demand60: useUnits ? ratioChange(unitsNow, units2) : ratioChange(now, rev2),
        demandBasis: useUnits ? ("units" as const) : ("revenue" as const),
        shareNow: totalNow ? now / totalNow : 0,
        share60: rev2 !== null && total2 ? rev2 / total2 : null,
      };
    })
    .filter((p): p is ProductFact => p !== null)
    .sort((a, b) => b.revenueNow - a.revenueNow);

  // A product "moves" when demand grew 15%+ in ~60 days and it matters (5%+ of revenue).
  const movers = products.filter((p) => p.demand60 !== null && p.demand60 >= 0.15 && p.shareNow >= 0.05);
  const topMover = movers.sort((a, b) => (b.demand60 ?? 0) - (a.demand60 ?? 0))[0] ?? null;

  // Channels
  const channels: ChannelFact[] = Object.entries(data.channels)
    .map(([name, c]) => {
      const spendNow = at(c.spend, i);
      if (spendNow === null) return null;
      const spendPrev = at(c.spend, i - 1);
      const newNow = at(c.newCustomers, i);
      const newPrev = at(c.newCustomers, i - 1);
      const cacNow = newNow ? spendNow / newNow : null;
      const cacPrev = newPrev && spendPrev !== null ? spendPrev / newPrev : null;
      return { name, spendNow, spendPrev, newNow, cacNow, cacPrev, cacChange: ratioChange(cacNow, cacPrev), spendChange: ratioChange(spendNow, spendPrev) };
    })
    .filter((c): c is ChannelFact => c !== null)
    .sort((a, b) => b.spendNow - a.spendNow);
  const withCac = channels.filter((c) => c.cacNow !== null && c.spendNow > 0);
  const bestChannel = withCac.length >= 2 ? [...withCac].sort((a, b) => a.cacNow! - b.cacNow!)[0] : null;
  const worstCandidate = withCac.length >= 2 ? [...withCac].sort((a, b) => b.cacNow! - a.cacNow!)[0] : null;
  const worstChannel = worstCandidate && bestChannel && worstCandidate.cacNow! >= bestChannel.cacNow! * 1.5 ? worstCandidate : null;

  // Segments
  const segTotal = sum(Object.values(data.segments).map((s) => at(s.customers, i - 1) ?? 0));
  const segments: SegmentFact[] = Object.entries(data.segments)
    .map(([name, s]) => {
      const prevC = at(s.customers, i - 1);
      const prev2 = at(s.customers, i - 2);
      const chNow = at(s.churned, i);
      const chPrev = at(s.churned, i - 1);
      if (prevC === null) return null;
      return {
        name,
        customersPrev: prevC,
        churnRateNow: chNow !== null && prevC > 0 ? chNow / prevC : null,
        churnRatePrev: chPrev !== null && prev2 ? chPrev / prev2 : null,
        share: segTotal ? prevC / segTotal : 0,
      };
    })
    .filter((s): s is SegmentFact => s !== null);

  let churnDriver: Facts["churnDriver"] = null;
  const scored = segments.filter((s) => s.churnRateNow !== null && s.churnRatePrev !== null);
  if (scored.length >= 2) {
    const top = [...scored].sort((a, b) => b.churnRateNow! - b.churnRatePrev! - (a.churnRateNow! - a.churnRatePrev!))[0];
    const others = scored.filter((s) => s !== top);
    const othersCust = sum(others.map((s) => s.customersPrev));
    const othersRate = othersCust ? sum(others.map((s) => s.customersPrev * s.churnRateNow!)) / othersCust : 0;
    if (top.churnRateNow! - top.churnRatePrev! > 0.005 && othersRate > 0) {
      churnDriver = { segment: top, othersRateNow: othersRate, multiple: top.churnRateNow! / othersRate };
    }
  }

  const industry: Industry = data.company.industry ?? "other";
  return {
    name: data.company.name,
    currency: data.company.currency,
    industry,
    marketSharePct: data.company.marketSharePct ?? null,
    periods: data.periods.slice(0, i + 1),
    months: data.periods.slice(0, i + 1).filter((_, k) => isNum(d.revenue?.[k]) || isNum(d.customers?.[k])).length,
    period,
    prevPeriod,
    d,
    revenue,
    customers,
    newCustomers,
    churned,
    arpc,
    profit,
    retention,
    marketing,
    cac,
    conversion,
    aov,
    costs,
    products,
    productSeries: Object.fromEntries(Object.entries(data.products).map(([k, p]) => [k, p.revenue.slice(0, i + 1)])),
    channels,
    segments,
    topMover,
    worstChannel,
    bestChannel,
    churnDriver,
  };
}
