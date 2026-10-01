/**
 * Number formatting and period-over-period deltas for Home.
 * Every figure on Home is shown with its comparison, so the rules live here once.
 */

export type MetricKind = "money" | "count" | "rate";

export function money(cents: number, currency: string, opts: { cents?: boolean } = {}) {
  const showCents = opts.cents ?? Math.abs(cents) < 100_000; // under $1,000: keep cents
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    minimumFractionDigits: showCents && cents % 100 !== 0 ? 2 : 0,
    maximumFractionDigits: showCents ? 2 : 0,
  }).format(cents / 100);
}

/** Axis ticks: $0, $500, $1.5K. */
export function moneyCompact(cents: number, currency: string) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: currency.toUpperCase(),
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(cents / 100);
}

export const count = (v: number) => new Intl.NumberFormat("en-US").format(v);
export const pct = (v: number, digits = 1) => `${(v * 100).toFixed(digits)}%`;

export function formatMetric(kind: MetricKind, v: number, currency: string) {
  return kind === "money" ? money(v, currency) : kind === "rate" ? pct(v) : count(v);
}

const dayFmt = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
const longDayFmt = new Intl.DateTimeFormat("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
/** "2026-09-07" → "Sep 7" */
export const shortDay = (iso: string) => dayFmt.format(new Date(`${iso}T00:00:00Z`));
/** "2026-09-07" → "Mon, Sep 7" */
export const longDay = (iso: string) => longDayFmt.format(new Date(`${iso}T00:00:00Z`));

export type Delta = {
  /** "up" / "down" / "flat", or "new" when there's nothing to compare with. */
  direction: "up" | "down" | "flat" | "new";
  /** good / bad / neutral, from the direction and whether up is good for this metric. */
  tone: "good" | "bad" | "neutral";
  /** "12.4%" or "0.4 pts" (rates change in percentage points). */
  text: string;
  /** Spoken form: "up 12.4%". */
  spoken: string;
};

/**
 * Change vs the previous period. Rates compare in percentage points (a 3%→4%
 * conversion is "+1 pt", not "+33%"); everything else compares relatively.
 */
export function delta(kind: MetricKind, current: number, previous: number, upIsGood = true): Delta {
  if (kind === "rate") {
    // From the values as displayed (one decimal), so "1.8% vs 1.8%" never shows a change.
    const pts = (Math.round(current * 1000) - Math.round(previous * 1000)) / 10;
    if (Math.abs(pts) < 0.1) return { direction: "flat", tone: "neutral", text: "No change", spoken: "no change" };
    const dir = pts > 0 ? "up" : "down";
    const text = `${Math.abs(pts).toFixed(1)} pts`;
    return { direction: dir, tone: (dir === "up") === upIsGood ? "good" : "bad", text, spoken: `${dir} ${text.replace("pts", "percentage points")}` };
  }
  if (previous === 0) {
    return current === 0
      ? { direction: "flat", tone: "neutral", text: "No change", spoken: "no change" }
      : { direction: "new", tone: "neutral", text: "New", spoken: "new this period" };
  }
  const rel = (current - previous) / previous;
  // Under 1% is noise, not news: calm beats twitchy.
  if (Math.abs(rel) < 0.01) return { direction: "flat", tone: "neutral", text: "No change", spoken: "no change" };
  const dir = rel > 0 ? "up" : "down";
  const text = `${(Math.abs(rel) * 100).toFixed(Math.abs(rel) < 0.1 ? 1 : 0)}%`;
  return { direction: dir, tone: (dir === "up") === upIsGood ? "good" : "bad", text, spoken: `${dir} ${text}` };
}

/** Trailing mean over `window` points (nulls skipped); smooths daily noise into a trend. */
export function rollingMean(points: (number | null)[], window: number): (number | null)[] {
  if (window <= 1) return points;
  return points.map((_, i) => {
    const slice = points.slice(Math.max(0, i - window + 1), i + 1).filter((v): v is number => v != null);
    return slice.length ? slice.reduce((a, b) => a + b, 0) / slice.length : null;
  });
}
