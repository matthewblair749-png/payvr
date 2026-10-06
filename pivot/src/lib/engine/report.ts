import { analyze } from "./analyze";
import { isNum } from "./series";
import type { Analysis, BusinessData, Change, HealthDimension, ImpactLevel, Kpi, Level, Severity, Summary } from "./types";

/**
 * The Monthly Business Report: a snapshot of the analysis as of one month,
 * stored as JSON so it reads the same forever, even after new data arrives.
 */
export interface ReportContent {
  version: 1;
  company: string;
  currency: string;
  period: string;
  summary: Summary & { source: "ai" | "engine" };
  score: { value: number; label: string; dimensions: Pick<HealthDimension, "label" | "score" | "reason">[] };
  kpis: Pick<Kpi, "key" | "label" | "display" | "changeDisplay" | "good">[];
  revenue: {
    periods: string[];
    values: (number | null)[];
    narrative: string[];
    products: { name: string; revenue: number; share: number; change: number | null }[];
  };
  customers: { narrative: string[] };
  changes: Change[];
  risks: { title: string; severity: Severity; what: string; soWhat: string }[];
  opportunities: { title: string; score: number; impact: ImpactLevel; annualImpact: number; whyFound: string }[];
  actions: { rank: number; title: string; impact: ImpactLevel; difficulty: Level; risk: Level; reasoning: string; annualImpact: number }[];
}

/** The data as it stood at the end of `period` (later months removed). */
export function dataAsOf(data: BusinessData, period: string): BusinessData {
  const idx = data.periods.indexOf(period);
  if (idx < 0) return data;
  const cut = <T>(s: T[]) => s.slice(0, idx + 1);
  const mapObj = <V extends Record<string, unknown>>(o: Record<string, V>, f: (v: V) => V) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, f(v)]));
  return {
    company: data.company,
    periods: cut(data.periods),
    metrics: Object.fromEntries(Object.entries(data.metrics).map(([k, v]) => [k, v ? cut(v) : v])),
    products: mapObj(data.products, (p) => ({ revenue: cut(p.revenue), ...(p.units ? { units: cut(p.units) } : {}) })),
    channels: mapObj(data.channels, (c) => ({ spend: cut(c.spend), ...(c.newCustomers ? { newCustomers: cut(c.newCustomers) } : {}) })),
    segments: mapObj(data.segments, (s) => ({ customers: cut(s.customers), ...(s.churned ? { churned: cut(s.churned) } : {}) })),
  };
}

/** Months a report can be generated for (need at least two months of data). */
export function reportablePeriods(data: BusinessData): string[] {
  const rev = data.metrics.revenue;
  return data.periods.filter((_, i) => i >= 1 && (!rev || isNum(rev[i])));
}

export function buildReport(data: BusinessData, period: string, summary?: Summary & { source: "ai" | "engine" }): { content: ReportContent; analysis: Analysis } {
  const a = analyze(dataAsOf(data, period));
  const k = (key: string) => a.kpis.find((x) => x.key === key);
  const products = Object.entries(data.products)
    .map(([name, p]) => {
      const i = data.periods.indexOf(a.period);
      const now = p.revenue[i];
      const prev = p.revenue[i - 1];
      return isNum(now) ? { name, revenue: now, share: 0, change: isNum(prev) && prev > 0 ? now / prev - 1 : null } : null;
    })
    .filter((p): p is NonNullable<typeof p> => p !== null);
  const total = products.reduce((s, p) => s + p.revenue, 0);
  products.forEach((p) => (p.share = total ? p.revenue / total : 0));
  products.sort((x, y) => y.revenue - x.revenue);

  const actual = a.revenueChart.series.find((s) => s.kind === "actual");
  const nActual = actual ? actual.values.filter(isNum).length : 0;
  const rev = k("revenue");
  const cust = k("customers");
  const ret = k("retention");

  const content: ReportContent = {
    version: 1,
    company: data.company.name,
    currency: data.company.currency,
    period: a.period,
    summary: summary ?? { ...a.summary, source: "engine" },
    score: { value: a.health.score, label: a.health.label, dimensions: a.health.dimensions.map(({ label, score, reason }) => ({ label, score, reason })) },
    kpis: a.kpis.map(({ key, label, display, changeDisplay, good }) => ({ key, label, display, changeDisplay, good })),
    revenue: {
      periods: a.revenueChart.periods.slice(0, nActual),
      values: actual ? actual.values.slice(0, nActual) : [],
      narrative: rev ? [rev.explain.what, rev.explain.why, rev.explain.soWhat] : ["No revenue data for this month."],
      products,
    },
    customers: {
      narrative: [cust ? `${cust.explain.what} ${cust.explain.why}` : null, ret ? `${ret.explain.what} ${ret.explain.why}` : null, cust?.explain.soWhat ?? null].filter(
        (x): x is string => Boolean(x),
      ),
    },
    changes: a.changes,
    risks: a.insights.filter((i) => i.severity !== "OPPORTUNITY").map((i) => ({ title: i.title, severity: i.severity, what: i.what, soWhat: i.soWhat })),
    opportunities: a.opportunities.slice(0, 3).map((o) => ({ title: o.title, score: o.score, impact: o.impact, annualImpact: o.annualImpact, whyFound: o.whyFound })),
    actions: a.recommendations.slice(0, 3).map((r) => ({ rank: r.rank, title: r.title, impact: r.impact, difficulty: r.difficulty, risk: r.risk, reasoning: r.reasoning, annualImpact: r.annualImpact })),
  };
  return { content, analysis: a };
}
