import { computeFacts, type Facts } from "./facts";
import { computeHealth } from "./health";
import { detectChanges, detectInsights } from "./insights";
import { computeKpis } from "./kpis";
import { detectOpportunities } from "./opportunities";
import { buildRecommendations } from "./recommendations";
import { isNum } from "./series";
import { buildBaseline } from "./simulate";
import { templateSummary } from "./summary";
import { METRIC_KEYS, type Analysis, type BusinessData, type MetricKey } from "./types";

/**
 * Run the whole analysis on one company's data. Pure and deterministic:
 * the same data always gives the same analysis.
 */
export function analyze(data: BusinessData): Analysis {
  return analyzeFacts(computeFacts(data), data);
}

export function analyzeFacts(f: Facts, data: BusinessData): Analysis {
  const health = computeHealth(f);
  const baseline = buildBaseline(f);
  const insights = detectInsights(f);
  const opportunities = detectOpportunities(f, baseline);
  const recommendations = buildRecommendations(f, insights, opportunities);
  const kpis = computeKpis(f, health);
  const summary = templateSummary(f, { insights, recommendations, health });

  const n = f.periods.length;
  const from = Math.max(0, n - 12);
  const periods = f.periods.slice(from);
  const actual = f.d.revenue ? f.d.revenue.slice(from, n) : [];
  const fc = f.revenue?.forecast ?? [];
  const future = futurePeriods(f.period, fc.length);

  const present = METRIC_KEYS.filter((k) => data.metrics[k]?.some(isNum)) as MetricKey[];
  return {
    company: data.company,
    period: f.period,
    previousPeriod: f.prevPeriod,
    coverage: {
      months: f.months,
      from: f.periods[0] ?? "",
      to: f.period,
      metrics: present,
      hasProducts: Object.keys(data.products).length > 0,
      hasChannels: Object.keys(data.channels).length > 0,
      hasSegments: Object.keys(data.segments).length > 0,
    },
    kpis,
    health,
    changes: detectChanges(f),
    insights,
    opportunities,
    recommendations,
    baseline,
    summary,
    revenueChart: {
      periods: [...periods, ...future],
      series: [
        { label: "Revenue", values: [...actual, ...future.map(() => null)], kind: "actual", format: "money" },
        {
          label: "Forecast",
          // The forecast line starts at the last actual so the two connect.
          values: [...actual.map((v, k) => (k === actual.length - 1 ? v : null)), ...fc],
          kind: "forecast",
          format: "money",
        },
      ],
    },
  };
}

function futurePeriods(last: string, count: number): string[] {
  if (!last) return [];
  const [y, m] = last.split("-").map(Number);
  return Array.from({ length: count }, (_, k) => {
    const d = new Date(Date.UTC(y, m + k, 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}
