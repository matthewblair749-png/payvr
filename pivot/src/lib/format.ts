/**
 * Number formatting used everywhere a number is shown. Specific numbers build
 * trust, so these keep 3 significant figures for compact money ($2.84M,
 * $684K) and one decimal for percentages (+12.4%).
 */

const SYMBOLS: Record<string, string> = { USD: "$", EUR: "€", GBP: "£", CAD: "CA$", AUD: "A$", JPY: "¥", INR: "₹" };

export function currencySymbol(currency = "USD") {
  return SYMBOLS[currency.toUpperCase()] ?? `${currency.toUpperCase()} `;
}

/** 3 significant figures, trimmed: 2.84, 684, 18.4 */
function sig3(n: number) {
  if (n >= 100) return Math.round(n).toString();
  if (n >= 10) return (Math.round(n * 10) / 10).toString();
  return (Math.round(n * 100) / 100).toString();
}

/** $2.84M, $684K, $12.4K, $940 */
export function money(value: number, currency = "USD") {
  const sym = currencySymbol(currency);
  const sign = value < 0 ? "−" : "";
  const v = Math.abs(value);
  if (v >= 1e9) return `${sign}${sym}${sig3(v / 1e9)}B`;
  if (v >= 1e6) {
    // 999,950 rounds to "1000K"; show it as $1M instead.
    return `${sign}${sym}${sig3(v / 1e6)}M`;
  }
  if (v >= 1e3) {
    const k = sig3(v / 1e3);
    return k === "1000" ? `${sign}${sym}1M` : `${sign}${sym}${k}K`;
  }
  return `${sign}${sym}${Math.round(v).toLocaleString("en-US")}`;
}

/** +$184K / -$41K (always signed, for deltas). */
export function moneyDelta(value: number, currency = "USD") {
  if (Math.abs(value) < 0.5) return `${currencySymbol(currency)}0`;
  return `${value > 0 ? "+" : "−"}${money(Math.abs(value), currency)}`;
}

/** Full precision money for tables: $2,840,112 */
export function moneyFull(value: number, currency = "USD") {
  return `${value < 0 ? "−" : ""}${currencySymbol(currency)}${Math.round(Math.abs(value)).toLocaleString("en-US")}`;
}

/** 48,291 */
export function int(value: number) {
  return Math.round(value).toLocaleString("en-US");
}

/** 48.3K for compact contexts, 48,291 otherwise. */
export function count(value: number, compact = false) {
  const v = Math.abs(value);
  if (!compact || v < 10_000) return int(value);
  if (v >= 1e6) return `${sig3(value / 1e6)}M`;
  return `${sig3(value / 1e3)}K`;
}

/** Ratio (0.124) -> "+12.4%". */
export function pctDelta(ratio: number, digits = 1) {
  const p = ratio * 100;
  const r = Number(p.toFixed(digits));
  if (r === 0) return `0%`;
  return `${r > 0 ? "+" : "−"}${Math.abs(r).toFixed(digits)}%`;
}

/** Ratio (0.914) -> "91.4%". */
export function pct(ratio: number, digits = 1) {
  return `${(ratio * 100).toFixed(digits)}%`;
}

/** Percentage-point change: 0.021 -> "−2.1 pts" */
export function ptsDelta(ratioDiff: number, digits = 1) {
  const p = Number((ratioDiff * 100).toFixed(digits));
  if (p === 0) return "0 pts";
  return `${p > 0 ? "+" : "−"}${Math.abs(p).toFixed(digits)} pts`;
}

/** "2026-09" -> "September 2026" (or "Sep 2026" short). */
export function monthLabel(period: string, short = false) {
  const [y, m] = period.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1, 1));
  return d.toLocaleDateString("en-US", { month: short ? "short" : "long", year: "numeric", timeZone: "UTC" });
}

/** "2026-09" -> "Sep" */
export function monthShort(period: string) {
  const [y, m] = period.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
}

export function dateLabel(d: Date | string) {
  return new Date(d).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export function relativeTime(d: Date | string, now = Date.now()) {
  const s = Math.round((now - new Date(d).getTime()) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return dateLabel(d);
}
