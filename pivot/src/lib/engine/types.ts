/**
 * The analysis engine's input and output types.
 *
 * The engine is pure and isomorphic: the server runs it on a company's
 * stored metrics, the browser runs the simulator part for instant slider
 * feedback, and the demo runs it on generated data. Every insight, score
 * and recommendation is computed from the data. Nothing is hardcoded per
 * company.
 */

/** Monthly company-level metrics the engine understands. */
export const METRIC_KEYS = [
  "revenue",
  "orders",
  "customers",
  "newCustomers",
  "churnedCustomers",
  "retention",
  "cogs",
  "opex",
  "marketingSpend",
  "visitors",
  "conversionRate",
  "profit",
] as const;
export type MetricKey = (typeof METRIC_KEYS)[number];

/** Values aligned with `BusinessData.periods`; null where the month has no value. */
export type Series = (number | null)[];

export type Industry = "ecommerce" | "retail" | "saas" | "services" | "marketplace" | "other";

export interface BusinessData {
  company: {
    name: string;
    currency: string;
    industry?: Industry | null;
    /** Estimated share of the addressable market, 0-100. */
    marketSharePct?: number | null;
  };
  /** "YYYY-MM", ascending and contiguous. */
  periods: string[];
  metrics: Partial<Record<MetricKey, Series>>;
  /** Revenue (and optionally units) by product. */
  products: Record<string, { revenue: Series; units?: Series }>;
  /** Marketing spend (and optionally new customers) by channel. */
  channels: Record<string, { spend: Series; newCustomers?: Series }>;
  /** Customers (and optionally churned customers) by segment. */
  segments: Record<string, { customers: Series; churned?: Series }>;
}

// ---------------------------------------------------------------------------
// Output

export type Severity = "ACTION" | "OPPORTUNITY" | "WATCH";
export type Level = "Low" | "Medium" | "High";
export type ImpactLevel = "Low" | "Medium" | "High" | "Very high";

/** Every major number answers these four questions. */
export interface Explanation {
  what: string;
  why: string;
  soWhat: string;
  nowWhat: string;
}

export interface Kpi {
  key: "revenue" | "customers" | "profit" | "retention" | "score";
  label: string;
  /** Raw value (ratio for retention, 0-100 for score). */
  value: number;
  display: string;
  /** Change vs previous period: ratio for money/counts, points (as ratio) for retention. */
  change: number | null;
  changeDisplay: string | null;
  /** Whether the change is good for the business. */
  good: boolean | null;
  spark: number[];
  explain: Explanation;
}

export interface HealthDimension {
  key: "revenue" | "customers" | "retention" | "operations" | "marketing" | "products";
  label: string;
  score: number;
  /** One line on why the score is what it is. */
  reason: string;
  trend: "up" | "down" | "flat";
}

export interface Health {
  score: number;
  label: "Strong" | "Healthy" | "Needs attention" | "At risk";
  dimensions: HealthDimension[];
  /** Dimensions we couldn't score, with what data would unlock them. */
  missing: { label: string; needs: string }[];
}

export interface Change {
  key: string;
  title: string;
  detail: string;
  direction: "up" | "down";
  good: boolean;
}

export interface ChartSeries {
  label: string;
  values: Series;
  kind: "actual" | "forecast" | "baseline";
  format: "money" | "count" | "percent";
}

export interface Evidence {
  chart?: { title: string; periods: string[]; series: ChartSeries[] };
  table?: { title: string; columns: string[]; rows: (string | number)[][]; highlightRow?: number };
}

export interface Insight extends Explanation {
  key: string;
  severity: Severity;
  title: string;
  /** Which metric this is about, for the mini chart. */
  metric: MetricKey | null;
  actionLabel: "Investigate" | "Explore opportunity" | "Analyze";
  /** Opportunity or recommendation key this insight leads to. */
  related: { opportunity?: string; recommendation?: string };
  evidence: Evidence;
  /** Higher = more important. */
  weight: number;
}

export interface ScoreFactors {
  impact: number;
  revenue: number;
  demand: number;
  cost: number;
  difficulty: number;
  risk: number;
  market: number;
  confidence: number;
}

export type ScenarioKind = "price" | "marketing" | "newProduct" | "newMarket" | "costs";

export interface Opportunity {
  key: string;
  title: string;
  summary: string;
  /** Plain-language "Why PIVOT found it". */
  whyFound: string;
  score: number;
  scoreLabel: string;
  factors: ScoreFactors;
  impact: ImpactLevel;
  effort: Level;
  risk: Level;
  confidence: number;
  /** Estimated annual revenue (or profit, for cost moves) impact. */
  annualImpact: number;
  impactBasis: "revenue" | "profit";
  plan: string[];
  simulate: { kind: ScenarioKind; value: number } | null;
  evidence: Evidence;
}

export interface Recommendation {
  key: string;
  rank: number;
  title: string;
  impact: ImpactLevel;
  difficulty: Level;
  risk: Level;
  reasoning: string;
  annualImpact: number;
  steps: string[];
  /** Where "Explore" leads. */
  links: { label: string; href: string }[];
  /** Keys of the insight / opportunity behind it. */
  sources: string[];
}

export interface Snapshot {
  revenue: number;
  profit: number;
  customers: number;
  marketSharePct: number | null;
  margin: number;
}

export interface ScenarioResult {
  kind: ScenarioKind;
  value: number;
  question: string;
  baseline: Snapshot;
  projected: Snapshot;
  deltas: { revenue: number; profit: number; customers: number; customersPct: number; marketSharePts: number | null };
  risk: Level;
  confidence: number;
  assumptions: string[];
  summary: string;
}

/** The latest-month figures the simulator starts from. */
export interface Baseline {
  period: string;
  revenue: number;
  profit: number;
  customers: number;
  newCustomers: number;
  variableCosts: number;
  opex: number;
  marketing: number;
  retention: number;
  marketSharePct: number | null;
  industry: Industry;
  /** 50-90: how much the data supports projections (history length, completeness). */
  dataQuality: number;
  /** Customer acquisition cost rose 10%+ last month. */
  acquisitionCostRising: boolean;
  /** Which inputs were estimated rather than read from data. */
  estimated: string[];
}

export interface Summary {
  headline: string;
  body: string;
}

export interface DataCoverage {
  months: number;
  from: string;
  to: string;
  metrics: MetricKey[];
  hasProducts: boolean;
  hasChannels: boolean;
  hasSegments: boolean;
}

export interface Analysis {
  company: BusinessData["company"];
  period: string;
  previousPeriod: string | null;
  coverage: DataCoverage;
  kpis: Kpi[];
  health: Health;
  changes: Change[];
  insights: Insight[];
  opportunities: Opportunity[];
  recommendations: Recommendation[];
  baseline: Baseline | null;
  summary: Summary;
  /** Monthly revenue with a 3-month forecast, for the overview chart. */
  revenueChart: { periods: string[]; series: ChartSeries[] };
}
