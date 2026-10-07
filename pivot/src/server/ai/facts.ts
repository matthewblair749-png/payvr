import "server-only";
import type { Analysis, BusinessData } from "@/lib/engine/types";
import { money, monthLabel, pct } from "@/lib/format";

/**
 * Everything an AI provider is allowed to know about a company: the
 * computed analysis, pre-formatted, plus a list of what data exists and
 * what doesn't. No raw rows, no personal data.
 */
export function buildAIFacts(a: Analysis, data: BusinessData) {
  const cur = a.company.currency;
  const n = a.revenueChart.series[0]?.values.filter((v) => v !== null).length ?? 0;
  const revenueHistory = a.revenueChart.periods.slice(0, n).map((p, i) => ({ month: monthLabel(p), revenue: money(a.revenueChart.series[0].values[i] ?? 0, cur) }));
  const forecast = a.revenueChart.series.find((s) => s.kind === "forecast");
  const i = data.periods.indexOf(a.period);
  return {
    company: a.company.name,
    latest_month: a.period ? monthLabel(a.period) : null,
    compared_with: a.previousPeriod ? monthLabel(a.previousPeriod) : null,
    data_available: {
      months: a.coverage.months,
      metrics: a.coverage.metrics,
      product_breakdown: a.coverage.hasProducts,
      channel_breakdown: a.coverage.hasChannels,
      segment_breakdown: a.coverage.hasSegments,
      not_available: ["competitors", "regions or locations", "employees", "inventory", "customer feedback", "anything not listed above"],
    },
    kpis: a.kpis.map((k) => ({ name: k.label, value: k.display, change_vs_last_month: k.changeDisplay, what: k.explain.what, why: k.explain.why, so_what: k.explain.soWhat, now_what: k.explain.nowWhat })),
    business_health: { score: `${a.health.score}/100`, label: a.health.label, areas: a.health.dimensions.map((d) => ({ area: d.label, score: d.score, reason: d.reason })) },
    whats_changing: a.changes.map((c) => `${c.title}: ${c.detail}`),
    insights: a.insights.map((x) => ({ severity: x.severity, title: x.title, what: x.what, why: x.why, so_what: x.soWhat, now_what: x.nowWhat })),
    opportunities: a.opportunities.map((o) => ({ title: o.title, pivot_score: o.score, impact: o.impact, effort: o.effort, risk: o.risk, confidence: `${o.confidence}%`, estimated_annual_value: money(o.annualImpact, cur), why_found: o.whyFound })),
    recommendations: a.recommendations.map((r) => ({ rank: r.rank, title: r.title, impact: r.impact, difficulty: r.difficulty, risk: r.risk, estimated_annual_value: money(r.annualImpact, cur), reasoning: r.reasoning })),
    revenue_by_month: revenueHistory,
    revenue_forecast_next_3_months: forecast ? forecast.values.slice(n).filter((v): v is number => v !== null).map((v) => money(v, cur)) : [],
    products_latest_month: i >= 0 ? Object.entries(data.products).map(([name, p]) => ({ product: name, revenue: p.revenue[i] !== null ? money(p.revenue[i] as number, cur) : null })) : [],
    channels_latest_month:
      i >= 0
        ? Object.entries(data.channels).map(([name, c]) => ({
            channel: name,
            spend: c.spend[i] !== null ? money(c.spend[i] as number, cur) : null,
            new_customers: c.newCustomers?.[i] ?? null,
          }))
        : [],
    segments_latest_month:
      i > 0
        ? Object.entries(data.segments).map(([name, s]) => ({
            segment: name,
            customers: s.customers[i],
            monthly_churn: s.churned && s.churned[i] !== null && s.customers[i - 1] ? pct((s.churned[i] as number) / (s.customers[i - 1] as number)) : null,
          }))
        : [],
  };
}

export type AIFacts = ReturnType<typeof buildAIFacts>;

/**
 * Grounding check: every figure in generated text must appear in the facts
 * (within rounding). Small counts like "three months" are allowed.
 * Returns the figures that couldn't be found.
 */
export function ungroundedNumbers(text: string, facts: unknown): string[] {
  const source = JSON.stringify(facts);
  const parse = (s: string) => {
    const m = s.replace(/[,$€£¥₹+−\-]/g, "").match(/^(\d+(?:\.\d+)?)\s*(k|m|b|%|pts?)?$/i);
    if (!m) return null;
    const unit = (m[2] ?? "").toLowerCase();
    const mult = unit === "k" ? 1e3 : unit === "m" ? 1e6 : unit === "b" ? 1e9 : 1;
    return { v: Number(m[1]) * mult, pct: unit === "%" || unit.startsWith("pt") };
  };
  const re = /[$€£¥₹]?\d[\d,]*(?:\.\d+)?\s?(?:[KMBkmb]\b|%|pts?\b)?/g;
  const known = (source.match(re) ?? []).map(parse).filter((x): x is NonNullable<typeof x> => x !== null);
  const bad: string[] = [];
  for (const raw of text.match(re) ?? []) {
    const n = parse(raw.trim());
    if (!n) continue;
    if (!n.pct && n.v <= 24 && Number.isInteger(n.v)) continue; // "3 months", "top 3", "#1"
    if (!n.pct && n.v >= 1990 && n.v <= 2100) continue; // years
    const ok = known.some((k) => k.pct === n.pct && Math.abs(k.v - n.v) <= Math.max(0.011 * Math.abs(k.v), 0.051));
    if (!ok) bad.push(raw.trim());
  }
  return bad;
}
