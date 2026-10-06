import { money, moneyDelta, pct } from "../format";
import type { Facts } from "./facts";
import { clamp, isNum } from "./series";
import type { Baseline, Industry, Level, ScenarioKind, ScenarioResult, Snapshot } from "./types";

/**
 * What If? scenario models.
 *
 * Each scenario is a small, explicit economic model run on the company's
 * latest month. Results are monthly figures six months after the change.
 * Every assumption the model makes is returned in plain language, and
 * inputs PIVOT had to estimate (because they aren't in the data) are listed
 * too. These are estimates, not guaranteed outcomes, and the UI says so.
 *
 * Pure and synchronous, so the browser can rerun it on every slider move.
 */

export const SCENARIOS: Record<
  ScenarioKind,
  { label: string; min: number; max: number; step: number; defaultValue: number; leverLabel: string; format: (v: number) => string }
> = {
  price: { label: "Change price", min: -30, max: 30, step: 1, defaultValue: -10, leverLabel: "Price change", format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  marketing: { label: "Change marketing budget", min: -50, max: 100, step: 5, defaultValue: 20, leverLabel: "Budget change", format: (v) => `${v > 0 ? "+" : ""}${v}%` },
  newProduct: { label: "Launch a new product", min: 1, max: 20, step: 1, defaultValue: 6, leverLabel: "Customers who buy it", format: (v) => `${v}%` },
  newMarket: { label: "Enter a new market", min: 10, max: 100, step: 5, defaultValue: 30, leverLabel: "New market size vs. today's", format: (v) => `${v}%` },
  costs: { label: "Reduce operating costs", min: 0, max: 30, step: 1, defaultValue: 10, leverLabel: "Cost reduction", format: (v) => `${v}%` },
};

/** The six starting scenarios from the brief. */
export const PRESETS: { id: string; label: string; kind: ScenarioKind; value: number }[] = [
  { id: "price-up", label: "Increase price 10%", kind: "price", value: 10 },
  { id: "price-down", label: "Decrease price 10%", kind: "price", value: -10 },
  { id: "marketing-up", label: "Increase marketing budget", kind: "marketing", value: 20 },
  { id: "new-product", label: "Launch new product", kind: "newProduct", value: 6 },
  { id: "new-market", label: "Enter new market", kind: "newMarket", value: 30 },
  { id: "costs-down", label: "Reduce operating costs", kind: "costs", value: 10 },
];

/** Typical price elasticity of demand by industry (magnitude). */
const ELASTICITY: Record<Industry, number> = { ecommerce: 1.595, retail: 1.4, saas: 0.8, services: 0.7, marketplace: 1.3, other: 1.2 };
const VARIABLE_COST: Record<Industry, number> = { ecommerce: 0.4, retail: 0.5, saas: 0.2, services: 0.35, marketplace: 0.3, other: 0.4 };
export const INDUSTRY_LABEL: Record<Industry, string> = {
  ecommerce: "online retail",
  retail: "retail",
  saas: "software",
  services: "services",
  marketplace: "marketplaces",
  other: "businesses like yours",
};

/** Months of retained customers accumulated after 6 months at retention r. */
const accumulate = (r: number) => (1 - r ** 6) / (1 - r);

export function buildBaseline(f: Facts): Baseline | null {
  if (!f.revenue) return null;
  const R = f.revenue.now;
  const estimated: string[] = [];
  const industry = f.industry;

  let V = f.costs?.cogs ?? null;
  if (V === null) {
    V = R * VARIABLE_COST[industry];
    estimated.push(`Cost of goods estimated at ${Math.round(VARIABLE_COST[industry] * 100)}% of revenue`);
  }
  let M = f.marketing?.now ?? null;
  if (M === null) {
    M = R * 0.1;
    estimated.push("Marketing spend estimated at 10% of revenue");
  }
  let O = f.costs?.opex ?? null;
  let P = f.profit?.now ?? null;
  if (O === null && P !== null) O = R - V - M - P;
  if (O === null) {
    O = R * 0.3;
    estimated.push("Operating costs estimated at 30% of revenue");
  }
  if (P === null) {
    P = R - V - O - M;
    estimated.push("Profit estimated from revenue and estimated costs");
  }
  const retention = f.retention?.now ?? null;
  if (retention === null) estimated.push("Retention assumed at 90% a month");
  const C = f.customers?.now ?? 0;
  if (!C) estimated.push("No customer counts, so customer effects aren't shown");

  const completeness = [f.customers, f.profit ?? f.costs, f.marketing, f.retention].filter(Boolean).length / 4;
  return {
    period: f.period,
    revenue: R,
    profit: P,
    customers: C,
    newCustomers: f.newCustomers?.now ?? (C ? C * (1 - (retention ?? 0.9) + 0.01) : 0),
    variableCosts: V,
    opex: O,
    marketing: M,
    retention: retention ?? 0.9,
    marketSharePct: f.marketSharePct,
    industry,
    dataQuality: Math.round(clamp(55 + Math.min(24, f.months) + completeness * 9, 50, 90)),
    acquisitionCostRising: (f.cac?.change ?? 0) > 0.1,
    estimated,
  };
}

function snapshot(b: Baseline, revenue: number, profit: number, customers: number, share: number | null): Snapshot {
  return { revenue, profit, customers, marketSharePct: share, margin: revenue > 0 ? profit / revenue : 0 };
}

function riskFromLoss(baseProfit: number, pessimisticProfit: number): Level {
  if (pessimisticProfit >= baseProfit) return "Low";
  const loss = (baseProfit - pessimisticProfit) / Math.max(1, Math.abs(baseProfit));
  return loss < 0.15 ? "Medium" : "High";
}

const raise = (l: Level): Level => (l === "Low" ? "Medium" : "High");

export function scenarioQuestion(kind: ScenarioKind, v: number): string {
  switch (kind) {
    case "price":
      return v < 0 ? `What if we lower our price by ${-v}%?` : v > 0 ? `What if we raise our price by ${v}%?` : "What if we keep our price the same?";
    case "marketing":
      return v >= 0 ? `What if we increase our marketing budget by ${v}%?` : `What if we cut our marketing budget by ${-v}%?`;
    case "newProduct":
      return `What if we launch a new product that ${v}% of customers buy?`;
    case "newMarket":
      return `What if we enter a new market ${v}% the size of our current one?`;
    case "costs":
      return `What if we cut operating costs by ${v}%?`;
  }
}

export function simulate(b: Baseline, kind: ScenarioKind, rawValue: number, currency = "USD"): ScenarioResult {
  const cfg = SCENARIOS[kind];
  const v = clamp(Number.isFinite(rawValue) ? rawValue : cfg.defaultValue, cfg.min, cfg.max);
  const { revenue: R, profit: P, customers: C, variableCosts: V, opex: O, marketing: M, retention: r } = b;
  const vr = R > 0 ? V / R : 0.4;
  const arpc = C > 0 ? R / C : 0;
  const share = b.marketSharePct;
  const dq = b.dataQuality;
  const eps = ELASTICITY[b.industry];
  const base = snapshot(b, R, P, C, share);
  const assumptions: string[] = [];

  let rev = R;
  let prof = P;
  let cust = C;
  let sharePts: number | null = null;
  let risk: Level = "Low";
  let confidence = dq;
  let summary = "";

  if (kind === "price") {
    const p = v / 100;
    const run = (e: number) => {
      const vol = (1 + p) ** -e;
      const R2 = R * (1 + p) * vol;
      return { vol, R2, P2: R2 - V * vol - O - M, C2: C * (1 + p) ** (-0.47 * e) };
    };
    const mid = run(eps);
    rev = mid.R2;
    prof = mid.P2;
    cust = mid.C2;
    sharePts = isNum(share) ? share * (mid.vol - 1) : null;
    const pess = run(p < 0 ? eps * 0.6 : eps * 1.4);
    risk = p === 0 ? "Low" : riskFromLoss(P, pess.P2);
    if (Math.abs(v) >= 20 && risk === "Low") risk = "Medium";
    confidence = dq - 1.2 * Math.abs(v);
    assumptions.push(
      `Demand elasticity of ${eps.toFixed(1)}, typical for ${INDUSTRY_LABEL[b.industry]}: a 1% price cut lifts sales volume about ${eps.toFixed(1)}%. PIVOT will measure your own once your prices have changed.`,
      "Cost of goods moves with volume; operating and marketing costs stay the same.",
      "Competitors don't respond with their own price changes.",
    );
    const dR = rev - R;
    const dP = prof - P;
    summary =
      v === 0
        ? "Nothing changes: this is your current strategy."
        : p < 0
          ? `Lowering prices ${-v}% would likely bring in ${pct(cust / C - 1)} more customers and ${dR >= 0 ? "add" : "lose"} ${money(Math.abs(dR), currency)} in monthly revenue. ${dP >= 0 ? `Profit rises ${money(dP, currency)} because the extra volume outweighs the lower price.` : `Profit falls ${money(-dP, currency)}: the extra volume doesn't make up for the lower price.`}`
          : `Raising prices ${v}% would likely ${dR >= 0 ? "add" : "lose"} ${money(Math.abs(dR), currency)} in monthly revenue${C ? ` and ${pct(Math.abs(cust / C - 1))} of customers` : ""}. ${dP >= 0 ? `Profit rises ${money(dP, currency)}.` : `Profit falls ${money(-dP, currency)}, because demand here is price-sensitive.`}`;
  }

  if (kind === "marketing") {
    const m = v / 100;
    const N = b.newCustomers;
    const run = (k: number) => {
      const dN = N * ((1 + m) ** k - 1);
      const dC = dN * accumulate(r);
      const dR = dC * arpc * 0.95;
      return { dC, dR, P2: P + dR - dR * vr - M * m };
    };
    const mid = run(0.55);
    rev = R + mid.dR;
    prof = mid.P2;
    cust = C + mid.dC;
    sharePts = isNum(share) && R > 0 ? share * (mid.dR / R) : null;
    risk = riskFromLoss(P, run(0.35).P2);
    if (m > 0.5) risk = "High";
    // Acquisition is already getting more expensive: more budget is riskier.
    if (m > 0 && b.acquisitionCostRising) risk = raise(risk);
    confidence = dq - 0.22 * Math.abs(v) - 4;
    assumptions.push(
      "Each extra dollar brings in fewer customers than the last (diminishing returns).",
      `New customers stay at your current retention (${(r * 100).toFixed(1)}% a month) and spend a little less than existing ones at first.`,
      "Cost of goods moves with revenue; operating costs stay the same.",
    );
    summary = `${v >= 0 ? "Spending" : "Cutting"} ${Math.abs(v)}% ${v >= 0 ? "more" : "less"} on marketing would ${mid.dC >= 0 ? "add" : "lose"} about ${Math.round(Math.abs(mid.dC)).toLocaleString("en-US")} customers within 6 months and change monthly profit by ${moneyDelta(prof - P, currency)}.`;
  }

  if (kind === "newProduct") {
    const a = v / 100;
    const adopters = C * a;
    const productRev = adopters * arpc * 0.35;
    const newCust = adopters * 0.15;
    const dR = productRev * 0.75 + newCust * arpc * 0.5;
    const dV = dR * vr * 1.1;
    const dO = O * (0.5 / 12 + 0.01);
    rev = R + dR;
    prof = P + dR - dV - dO;
    cust = C + newCust;
    sharePts = isNum(share) && R > 0 ? share * (dR / R) * 0.5 : null;
    risk = a > 0.1 ? "High" : "Medium";
    confidence = dq - 18 - 0.6 * v;
    assumptions.push(
      "Buyers spend about a third of their usual monthly amount on the new product, and a quarter of that replaces things they'd have bought anyway.",
      "Launch costs equal half a month of operating costs, spread over a year, plus 1% a month to run it.",
      "Margins start 10% thinner than your current products.",
    );
    summary = `If ${v}% of customers buy it, a new product adds about ${money(dR, currency)} a month by month 6. ${prof >= P ? "It pays for itself within the first 6 months." : "Launch costs mean profit dips at first, then recovers as they're paid off."}`;
  }

  if (kind === "newMarket") {
    const z = v / 100;
    const dR = R * 0.2 * z;
    const dC = C * 0.2 * z;
    const dV = dR * vr * 1.15;
    const dM = M * z * 0.5;
    const dO = O * (0.04 + 0.06 * z);
    rev = R + dR;
    prof = P + dR - dV - dM - dO;
    cust = C + dC;
    sharePts = null;
    risk = "High";
    confidence = dq - 22 - 0.12 * v;
    assumptions.push(
      "You reach 40% of your current market share in the new market within a year (20% by month 6).",
      "Shipping and local costs make each sale 15% more expensive to fulfil.",
      "Marketing in the new market costs half your current budget, scaled to its size; operating costs rise 4% plus more for a bigger market.",
    );
    summary = `A new market ${v}% the size of yours could add ${money(dR, currency)} a month by month 6, but entry costs come first: profit changes by ${moneyDelta(prof - P, currency)} a month at that point.`;
  }

  if (kind === "costs") {
    const c = v / 100;
    const serviceHit = Math.max(0, c - 0.1) * 0.06 * accumulate(r);
    const lostC = C * serviceHit;
    const dR = -lostC * arpc;
    rev = R + dR;
    prof = P + O * c + dR * (1 - vr);
    cust = C - lostC;
    sharePts = isNum(share) && R > 0 ? share * (dR / R) : null;
    risk = c <= 0.1 ? "Low" : c <= 0.2 ? "Medium" : "High";
    confidence = dq - 0.6 * v;
    assumptions.push(
      "Cuts up to 10% come from efficiency and don't affect customers.",
      "Deeper cuts start to hurt service, so a few more customers leave each month.",
    );
    summary =
      v === 0
        ? "Nothing changes: this is your current strategy."
        : `Cutting operating costs ${v}% saves ${money(O * c, currency)} a month${lostC > 0 ? `, but deeper cuts would cost about ${Math.round(lostC).toLocaleString("en-US")} customers` : " with no expected effect on customers"}. Net profit change: ${moneyDelta(prof - P, currency)} a month.`;
  }

  for (const e of b.estimated) assumptions.push(`${e}.`);
  assumptions.push("Figures are monthly, 6 months after the change. These are AI estimates, not guaranteed outcomes.");

  const projected = snapshot(b, rev, prof, cust, isNum(share) && sharePts !== null ? share + sharePts : share);
  return {
    kind,
    value: v,
    question: scenarioQuestion(kind, v),
    baseline: base,
    projected,
    deltas: {
      revenue: rev - R,
      profit: prof - P,
      customers: cust - C,
      customersPct: C > 0 ? cust / C - 1 : 0,
      marketSharePts: sharePts,
    },
    risk,
    confidence: Math.round(clamp(confidence, 30, 95)),
    assumptions,
    summary,
  };
}
