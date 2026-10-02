/**
 * Experiment statistics, explained without jargon.
 *
 * - Conversion: Beta-Binomial (uniform prior). We draw 20,000 samples from
 *   each variant's posterior with a SEEDED generator, so the same data always
 *   gives the same numbers, and read off "chance B is better" and a likely
 *   range for the difference.
 * - Revenue per visitor (price tests): normal approximation on the mean
 *   revenue per visit (zeros included), from per-variant sum and sum of squares.
 * - Sample-ratio check: is traffic actually splitting the way it should?
 *
 * The UI never shows p-values or "significance". It says things like
 * "B is very likely better: about +4 sales per 100 visitors".
 */

// ---------------------------------------------------------------------------
// Random sampling (deterministic)

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function normal(r: () => number) {
  // Box–Muller
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

/** Gamma(shape, 1) via Marsaglia–Tsang. */
function gamma(shape: number, r: () => number): number {
  if (shape < 1) return gamma(shape + 1, r) * Math.pow(r(), 1 / shape);
  const d = shape - 1 / 3;
  const c = 1 / Math.sqrt(9 * d);
  for (;;) {
    let x: number;
    let v: number;
    do {
      x = normal(r);
      v = 1 + c * x;
    } while (v <= 0);
    v = v * v * v;
    const u = r();
    if (u < 1 - 0.0331 * x ** 4 || Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
  }
}

function beta(a: number, b: number, r: () => number) {
  const x = gamma(a, r);
  return x / (x + gamma(b, r));
}

/** Standard normal CDF (Abramowitz–Stegun 7.1.26 via erf). */
export function normCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * (Math.abs(z) / Math.SQRT2));
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

const quantile = (sorted: number[], q: number) => sorted[Math.min(sorted.length - 1, Math.max(0, Math.floor(q * sorted.length)))];

// ---------------------------------------------------------------------------
// Results

export type Interval = { mid: number; low: number; high: number };

export type ConversionInput = { visits: number; conversions: number };
export type ConversionResult = {
  rateA: number;
  rateB: number;
  /** P(rate_B > rate_A). */
  chanceBBetter: number;
  /** B − A in absolute conversion (0.03 = +3 sales per 100 visitors), 90% range. */
  diff: Interval;
};

export function compareConversion(a: ConversionInput, b: ConversionInput, draws = 20_000, seed = 7): ConversionResult {
  const r = mulberry32(seed + a.visits * 31 + b.visits * 17 + a.conversions * 7 + b.conversions);
  const diffs = new Array<number>(draws);
  let bWins = 0;
  for (let i = 0; i < draws; i++) {
    const pa = beta(1 + a.conversions, 1 + Math.max(0, a.visits - a.conversions), r);
    const pb = beta(1 + b.conversions, 1 + Math.max(0, b.visits - b.conversions), r);
    diffs[i] = pb - pa;
    if (pb > pa) bWins++;
  }
  diffs.sort((x, y) => x - y);
  return {
    rateA: a.visits ? a.conversions / a.visits : 0,
    rateB: b.visits ? b.conversions / b.visits : 0,
    chanceBBetter: bWins / draws,
    diff: { mid: quantile(diffs, 0.5), low: quantile(diffs, 0.05), high: quantile(diffs, 0.95) },
  };
}

export type RevenueInput = { visits: number; sumCents: number; sumSqCents: number };
export type RevenueResult = { perVisitA: number; perVisitB: number; chanceBBetter: number; diff: Interval };

/** Revenue per visit (cents), normal approximation of the difference in means. */
export function compareRevenue(a: RevenueInput, b: RevenueInput): RevenueResult {
  const stats = (x: RevenueInput) => {
    const n = Math.max(1, x.visits);
    const mean = x.sumCents / n;
    const variance = Math.max(0, x.sumSqCents / n - mean * mean) * (n / Math.max(1, n - 1));
    return { mean, se2: variance / n };
  };
  const A = stats(a);
  const B = stats(b);
  const d = B.mean - A.mean;
  const se = Math.sqrt(A.se2 + B.se2) || 1e-9;
  return {
    perVisitA: A.mean,
    perVisitB: B.mean,
    chanceBBetter: normCdf(d / se),
    diff: { mid: d, low: d - 1.645 * se, high: d + 1.645 * se },
  };
}

/**
 * Sample-ratio mismatch: with a 50/50 split, 1,000 vs 1,300 visits means the
 * split is broken (caching, redirects, bots) and results can't be trusted.
 * Two-variant z-test at a strict threshold so it only fires when it's real.
 */
export function splitLooksBroken(visitsA: number, visitsB: number, weightA: number, weightB: number) {
  const n = visitsA + visitsB;
  if (n < 200 || weightA + weightB <= 0) return false;
  const p = weightA / (weightA + weightB);
  const z = (visitsA - n * p) / Math.sqrt(n * p * (1 - p));
  return Math.abs(z) > 3.5;
}

// ---------------------------------------------------------------------------
// Verdict: the sentence merchants actually read

export type VerdictStatus = "too_early" | "b_better" | "a_better" | "leaning_b" | "leaning_a" | "no_difference" | "keep_going";

export type Verdict = {
  status: VerdictStatus;
  headline: string;
  detail: string;
  /** Rough days until a clear answer, if one is likely. */
  daysLeft: number | null;
  /** Can the merchant reasonably ship B now? */
  shipB: boolean;
};

const MIN_VISITS = 100;
const MIN_DAYS = 7;

/** Visits per variant needed to detect `delta` at baseline `p` (≈95% sure, 80% of the time). */
export function visitsNeeded(p: number, delta: number) {
  if (delta <= 0) return Infinity;
  const z = 1.645 + 0.842;
  return Math.ceil((z * z * 2 * p * (1 - p)) / (delta * delta));
}

/** Inverse of normCdf (bisection; plenty precise for a status line). */
export function normInv(p: number) {
  let lo = -8;
  let hi = 8;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (normCdf(mid) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/**
 * Days until a running test likely crosses the 95% line, if the current
 * difference holds. Evidence (z) grows with the square root of visitors, so
 * the remaining time is daysRunning × ((1.645 / z_now)² − 1). Null when the
 * versions look too similar to ever settle in a reasonable time.
 */
export function daysToDecide(chanceBBetter: number, daysRunning: number): number | null {
  const z = Math.abs(normInv(Math.min(0.9999, Math.max(0.0001, chanceBBetter))));
  if (z < 0.1 || daysRunning <= 0) return null;
  const days = Math.ceil(daysRunning * ((1.645 / z) ** 2 - 1));
  return days > 120 ? null : Math.max(1, days);
}

export function conversionVerdict(opts: {
  result: ConversionResult;
  visitsA: number;
  visitsB: number;
  daysRunning: number;
  /** Visits per day per variant, recent average. */
  dailyPerVariant: number;
}): Verdict {
  const { result, visitsA, visitsB, daysRunning, dailyPerVariant } = opts;
  const per100 = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(/\.0$/, "")}`;
  const range = `somewhere between ${per100(result.diff.low)} and ${per100(result.diff.high)}`;
  const minVisits = Math.min(visitsA, visitsB);

  if (minVisits < MIN_VISITS || daysRunning < MIN_DAYS) {
    const waitDays = Math.max(MIN_DAYS - daysRunning, dailyPerVariant > 0 ? Math.ceil((MIN_VISITS - minVisits) / dailyPerVariant) : 0, 0);
    return {
      status: "too_early",
      headline: "Too early to tell",
      detail: `Tests need at least a week and ${MIN_VISITS} visits per version to even out weekday swings. Check back in about ${Math.max(1, waitDays)} day${waitDays === 1 ? "" : "s"}.`,
      daysLeft: Math.max(1, waitDays),
      shipB: false,
    };
  }
  const c = result.chanceBBetter;
  if (c >= 0.95) {
    return {
      status: "b_better",
      headline: "B is very likely better",
      detail: `About ${per100(result.diff.mid)} sales per 100 visitors (${range}). There's a ${Math.round(c * 100)}% chance B beats your original.`,
      daysLeft: 0,
      shipB: true,
    };
  }
  if (c <= 0.05) {
    return {
      status: "a_better",
      headline: "Your original is very likely better",
      detail: `B is costing about ${per100(-result.diff.mid).replace("+", "")} sales per 100 visitors (${range}). Stop the test and keep your original.`,
      daysLeft: 0,
      shipB: false,
    };
  }
  // Enough data and the whole likely range is within ±1 sale per 100: practically the same.
  if (result.diff.low > -0.01 && result.diff.high < 0.01) {
    return {
      status: "no_difference",
      headline: "No real difference",
      detail: `Both versions convert about the same (${range} sales per 100 visitors). Keep whichever you like better.`,
      daysLeft: 0,
      shipB: false,
    };
  }
  const leaning = c >= 0.8 ? "leaning_b" : c <= 0.2 ? "leaning_a" : "keep_going";
  const toGo = daysToDecide(c, daysRunning);
  const eta =
    toGo == null
      ? "It may never show a clear winner; the versions look very similar."
      : `If the current difference holds, about ${toGo} more day${toGo === 1 ? "" : "s"} should settle it.`;
  return {
    status: leaning,
    headline: leaning === "leaning_b" ? "B is probably better, but not certain yet" : leaning === "leaning_a" ? "Your original is probably better" : "No clear winner yet",
    detail: `${Math.round(c * 100)}% chance B is better: ${range} sales per 100 visitors. ${eta}`,
    daysLeft: toGo,
    shipB: false,
  };
}

export function revenueVerdict(opts: { result: RevenueResult; visitsA: number; visitsB: number; daysRunning: number; dailyPerVariant: number; currency: string }): Verdict {
  const { result, visitsA, visitsB, daysRunning, dailyPerVariant, currency } = opts;
  const money = (cents: number) =>
    `${cents >= 0 ? "+" : "−"}${new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Math.abs(cents) / 100)}`;
  const minVisits = Math.min(visitsA, visitsB);
  if (minVisits < MIN_VISITS || daysRunning < MIN_DAYS) {
    const waitDays = Math.max(MIN_DAYS - daysRunning, dailyPerVariant > 0 ? Math.ceil((MIN_VISITS - minVisits) / dailyPerVariant) : 0, 1);
    return { status: "too_early", headline: "Too early to tell", detail: `Price tests need at least a week of traffic. Check back in about ${waitDays} days.`, daysLeft: waitDays, shipB: false };
  }
  const c = result.chanceBBetter;
  const monthly = result.diff.mid * dailyPerVariant * 2 * 30;
  const range = `somewhere between ${money(result.diff.low)} and ${money(result.diff.high)} per visitor`;
  if (c >= 0.95)
    return {
      status: "b_better",
      headline: "B earns more per visitor",
      detail: `About ${money(result.diff.mid)} per visitor (${range}). At your traffic that's roughly ${money(monthly)} a month.`,
      daysLeft: 0,
      shipB: true,
    };
  if (c <= 0.05)
    return { status: "a_better", headline: "Your original earns more", detail: `B is losing about ${money(-result.diff.mid).replace("+", "")} per visitor (${range}). Keep your original.`, daysLeft: 0, shipB: false };
  return {
    status: c >= 0.8 ? "leaning_b" : c <= 0.2 ? "leaning_a" : "keep_going",
    headline: c >= 0.8 ? "B is probably earning more" : c <= 0.2 ? "Your original is probably earning more" : "No clear winner yet",
    detail: `${Math.round(c * 100)}% chance B earns more: ${range}. ${(() => {
      const toGo = daysToDecide(c, daysRunning);
      return toGo == null ? "It may never show a clear winner." : `If the current difference holds, about ${toGo} more day${toGo === 1 ? "" : "s"} should settle it.`;
    })()}`,
    daysLeft: daysToDecide(c, daysRunning),
    shipB: false,
  };
}
