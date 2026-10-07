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
  // The chart runs actual months, then forecast months. Split by date, not by how many
  // values are present: a month with no revenue is unknown, not $0.
  const chart = a.revenueChart;
  const actualMonths = chart.periods.filter((p) => p <= a.period).length;
  const actual = chart.series.find((s) => s.kind === "actual");
  const revenueHistory = chart.periods.slice(0, actualMonths).map((p, i) => {
    const v = actual?.values[i];
    return { month: monthLabel(p), revenue: v === null || v === undefined ? null : money(v, cur) };
  });
  const forecast = chart.series.find((s) => s.kind === "forecast");
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
    revenue_forecast_next_3_months: forecast ? forecast.values.slice(actualMonths).filter((v): v is number => v !== null).map((v) => money(v, cur)) : [],
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
 * (within rounding), with the same unit and the same direction. Small counts
 * like "three months" and bare years are allowed. Returns the figures that
 * couldn't be found.
 *
 * Direction comes from a sign (+12.4%, −2.1 pts) or a word just before the
 * figure ("fell 12.4%"), so "revenue fell 12.4%" fails when the facts say it
 * rose. "Fell to 91.4%" is a level, not a change, so it has no direction.
 */
export function ungroundedNumbers(text: string, facts: unknown): string[] {
  const known = scanNumbers(JSON.stringify(facts));
  const bad: string[] = [];
  for (const n of scanNumbers(text)) {
    if (!n.unit && !n.money && !n.dir && Number.isInteger(n.v) && n.v <= 24) continue; // "3 months", "top 3", "#1"
    if (n.bare && n.v >= 1990 && n.v <= 2100) continue; // years, only as bare 4-digit numbers
    const same = known.filter((k) => k.unit === n.unit && Math.abs(k.v - n.v) <= Math.max(0.011 * k.v, 0.051));
    // A direction the facts contradict (and never state) is wrong, even if the magnitude appears.
    const contradicted = n.dir !== 0 && !same.some((k) => k.dir === n.dir) && same.some((k) => k.dir === -n.dir);
    if (!same.length || contradicted) bad.push(n.raw);
  }
  return bad;
}

type Figure = { raw: string; v: number; unit: "" | "%" | "pts"; dir: -1 | 0 | 1; money: boolean; bare: boolean };

const FIGURE = /[+\-\u2212]?\s?[$€£¥₹]?\d[\d,]*(?:\.\d+)?\s?(?:[KMBkmb]\b|%|pts?\b)?/g;
const FALLING = /^(fell|fall|falls|falling|down|declin\w*|drop\w*|decreas\w*|lower\w*|lost|lose|shrank|shrink\w*|slip\w*|dip\w*|narrow\w*|eas\w*|soften\w*|worsen\w*)$/i;
const RISING = /^(rose|rise|rises|rising|up|grew|grow\w*|increas\w*|gain\w*|higher|jump\w*|climb\w*|improv\w*|widen\w*)$/i;

/** The direction a figure is described with: the nearest direction word in its own clause ("Despite falling retention, revenue grew 12.4%" is +). */
function directionBefore(before: string): -1 | 0 | 1 {
  const clause = before.split(/[,;:.!?()]|\b(?:but|while|whereas|although|despite|and)\b/i).pop() ?? "";
  if (/\bto\s*["']?$/i.test(clause)) return 0; // "fell to 91.4%" is a level, not a change
  const words = clause.match(/[a-z]+/gi) ?? [];
  for (let j = words.length - 1; j >= 0; j--) {
    if (FALLING.test(words[j])) return -1;
    if (RISING.test(words[j])) return 1;
  }
  return 0;
}

/** Every figure in `s`, as a magnitude with its unit and direction. */
function scanNumbers(s: string): Figure[] {
  const out: Figure[] = [];
  for (const match of s.matchAll(FIGURE)) {
    const raw = match[0].trim();
    const m = raw.replace(/\u2212/g, "-").match(/^([+-])?\s?([$€£¥₹])?([\d,]+(?:\.\d+)?)\s?(k|m|b|%|pts?)?$/i);
    if (!m) continue;
    const u = (m[4] ?? "").toLowerCase();
    const mult = u === "k" ? 1e3 : u === "m" ? 1e6 : u === "b" ? 1e9 : 1;
    const worded = directionBefore(s.slice(Math.max(0, match.index - 40), match.index));
    out.push({
      raw,
      v: Number(m[3].replace(/,/g, "")) * mult,
      unit: u === "%" ? "%" : u.startsWith("pt") ? "pts" : "",
      dir: m[1] === "-" ? -1 : m[1] === "+" ? 1 : worded,
      money: !!m[2] || mult > 1,
      bare: !m[1] && !m[2] && !u && /^\d{4}$/.test(m[3]),
    });
  }
  return out;
}
