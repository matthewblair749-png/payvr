import type { Series } from "./types";

/** Small, dependency-free statistics over monthly series. */

export const isNum = (v: number | null | undefined): v is number => typeof v === "number" && Number.isFinite(v);

/** Last non-null value and its index. */
export function last(s: Series | undefined, offset = 0): number | null {
  if (!s) return null;
  const i = s.length - 1 - offset;
  return i >= 0 && isNum(s[i]) ? s[i] : null;
}

/** Value at the latest period (index n-1) minus `back` months. */
export function at(s: Series | undefined, index: number): number | null {
  if (!s || index < 0 || index >= s.length) return null;
  const v = s[index];
  return isNum(v) ? v : null;
}

export function ratioChange(now: number | null, before: number | null): number | null {
  if (!isNum(now) || !isNum(before) || before === 0) return null;
  return now / before - 1;
}

export function mean(xs: number[]): number {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0;
}

export function std(xs: number[]): number {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(xs.reduce((a, b) => a + (b - m) ** 2, 0) / (xs.length - 1));
}

export function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}

/** Non-null values of the last `n` months (fewer if missing). */
export function tail(s: Series | undefined, n: number): number[] {
  if (!s) return [];
  return s.slice(Math.max(0, s.length - n)).filter(isNum);
}

/** Month-over-month growth rates for the whole series (null where undefined). */
export function growthRates(s: Series): (number | null)[] {
  return s.map((v, i) => (i === 0 ? null : ratioChange(v, s[i - 1])));
}

/** Average monthly growth (compound) over the last `months` months. */
export function cagr(s: Series | undefined, months: number): number | null {
  if (!s || months < 1 || s.length <= months) return null;
  const end = s[s.length - 1];
  const start = s[s.length - 1 - months];
  if (!isNum(end) || !isNum(start) || start <= 0 || end <= 0) return null;
  return (end / start) ** (1 / months) - 1;
}

/** How many consecutive months (ending now) the series went down. */
export function consecutiveDeclines(s: Series | undefined): number {
  if (!s) return 0;
  let n = 0;
  for (let i = s.length - 1; i > 0; i--) {
    const a = s[i];
    const b = s[i - 1];
    if (isNum(a) && isNum(b) && a < b) n++;
    else break;
  }
  return n;
}

/** Least-squares line through the non-null points. */
export function linearFit(values: Series): { slope: number; intercept: number } | null {
  const pts = values.flatMap((v, i) => (isNum(v) ? [[i, v] as const] : []));
  if (pts.length < 2) return null;
  const mx = mean(pts.map((p) => p[0]));
  const my = mean(pts.map((p) => p[1]));
  let num = 0;
  let den = 0;
  for (const [x, y] of pts) {
    num += (x - mx) * (y - my);
    den += (x - mx) ** 2;
  }
  const slope = den === 0 ? 0 : num / den;
  return { slope, intercept: my - slope * mx };
}

/**
 * Forecast `ahead` months using the trend of the last 12 months, fitted in
 * log space (growth compounds) when every value is positive.
 */
export function forecast(s: Series, ahead: number): number[] {
  const window = s.slice(-12);
  const positive = window.every((v) => !isNum(v) || v > 0);
  const fit = linearFit(positive ? window.map((v) => (isNum(v) ? Math.log(v) : null)) : window);
  if (!fit) return [];
  const lastIndex = window.length - 1;
  // Anchor to the latest actual so the forecast starts where the data ends.
  const lastActual = window[lastIndex];
  if (!isNum(lastActual)) return [];
  const out: number[] = [];
  for (let k = 1; k <= ahead; k++) {
    out.push(positive ? lastActual * Math.exp(fit.slope * k) : lastActual + fit.slope * k);
  }
  return out;
}

/** Robust z-score of the latest value against the previous `window` values. */
export function latestZ(s: Series | undefined, window = 12): number | null {
  if (!s || s.length < 6) return null;
  const latest = s[s.length - 1];
  const hist = s.slice(Math.max(0, s.length - 1 - window), s.length - 1).filter(isNum);
  if (!isNum(latest) || hist.length < 5) return null;
  const sd = std(hist);
  return sd === 0 ? null : (latest - mean(hist)) / sd;
}

export function clamp(n: number, lo = 0, hi = 100) {
  return Math.min(hi, Math.max(lo, n));
}

/** Logistic curve mapping an indicator to 0-100. `mid` scores 50; `scale` sets steepness. */
export function logistic(x: number, mid: number, scale: number) {
  return 100 / (1 + Math.exp(-(x - mid) / scale));
}

/** Round to a "human" amount for estimates: 3,712,345 -> 3,700,000. */
export function roughly(n: number) {
  const a = Math.abs(n);
  const step = a >= 1e6 ? 1e5 : a >= 1e5 ? 1e4 : a >= 1e4 ? 1e3 : a >= 1e3 ? 100 : 10;
  return Math.round(n / step) * step;
}
