import { isNum } from "../engine/series";
import { METRIC_KEYS, type BusinessData, type MetricKey, type Series } from "../engine/types";

/**
 * Stored metrics <-> engine input.
 *
 * One row per (month, metric, dimension). Dimension "" is a company total;
 * "product:X", "channel:X" and "segment:X" hold breakdowns.
 */
/** Dimension marker for a company total summed from a breakdown file. */
export const DERIVED = "*";

export interface MetricRow {
  period: string; // YYYY-MM
  key: string;
  dimension: string;
  value: number;
}

export const DIMENSION_KEYS = {
  product: ["revenue", "units"],
  channel: ["marketingSpend", "newCustomers"],
  segment: ["customers", "churnedCustomers"],
} as const;

export function toMetricRows(data: BusinessData): MetricRow[] {
  const rows: MetricRow[] = [];
  const push = (series: Series | undefined, key: string, dimension: string) =>
    series?.forEach((v, i) => {
      if (isNum(v)) rows.push({ period: data.periods[i], key, dimension, value: v });
    });
  for (const k of METRIC_KEYS) push(data.metrics[k], k, "");
  for (const [name, p] of Object.entries(data.products)) {
    push(p.revenue, "revenue", `product:${name}`);
    push(p.units, "units", `product:${name}`);
  }
  for (const [name, c] of Object.entries(data.channels)) {
    push(c.spend, "marketingSpend", `channel:${name}`);
    push(c.newCustomers, "newCustomers", `channel:${name}`);
  }
  for (const [name, s] of Object.entries(data.segments)) {
    push(s.customers, "customers", `segment:${name}`);
    push(s.churned, "churnedCustomers", `segment:${name}`);
  }
  return rows;
}

/** Every month from the first to the last, so series have no gaps in time. */
export function monthRange(first: string, last: string): string[] {
  const out: string[] = [];
  let [y, m] = first.split("-").map(Number);
  const [ly, lm] = last.split("-").map(Number);
  while ((y < ly || (y === ly && m <= lm)) && out.length < 600) {
    out.push(`${y}-${String(m).padStart(2, "0")}`);
    m++;
    if (m > 12) {
      m = 1;
      y++;
    }
  }
  return out;
}

/**
 * Rows (oldest dataset first) -> BusinessData. When two datasets cover the
 * same month and metric, the newer one wins. Derived totals (summed from a
 * breakdown) only fill months that have no real total.
 */
export function fromMetricRows(rows: MetricRow[], company: BusinessData["company"]): BusinessData {
  const empty: BusinessData = { company, periods: [], metrics: {}, products: {}, channels: {}, segments: {} };
  if (!rows.length) return empty;
  const periods = monthRange(
    rows.reduce((a, r) => (r.period < a ? r.period : a), rows[0].period),
    rows.reduce((a, r) => (r.period > a ? r.period : a), rows[0].period),
  );
  const idx = new Map(periods.map((p, i) => [p, i]));
  const blank = (): Series => periods.map(() => null);
  const data: BusinessData = { ...empty, periods };

  const derived: MetricRow[] = [];
  for (const r of rows) {
    const i = idx.get(r.period);
    if (i === undefined || !Number.isFinite(r.value)) continue;
    if (r.dimension === DERIVED) {
      derived.push(r);
      continue;
    }
    if (r.dimension === "") {
      if (!(METRIC_KEYS as readonly string[]).includes(r.key)) continue;
      const k = r.key as MetricKey;
      (data.metrics[k] ??= blank())[i] = r.value;
      continue;
    }
    const sep = r.dimension.indexOf(":");
    const kind = r.dimension.slice(0, sep);
    const name = r.dimension.slice(sep + 1);
    if (!name) continue;
    if (kind === "product") {
      const p = (data.products[name] ??= { revenue: blank() });
      if (r.key === "revenue") p.revenue[i] = r.value;
      else if (r.key === "units") (p.units ??= blank())[i] = r.value;
    } else if (kind === "channel") {
      const c = (data.channels[name] ??= { spend: blank() });
      if (r.key === "marketingSpend") c.spend[i] = r.value;
      else if (r.key === "newCustomers") (c.newCustomers ??= blank())[i] = r.value;
    } else if (kind === "segment") {
      const s = (data.segments[name] ??= { customers: blank() });
      if (r.key === "customers") s.customers[i] = r.value;
      else if (r.key === "churnedCustomers") (s.churned ??= blank())[i] = r.value;
    }
  }
  for (const r of derived) {
    if (!(METRIC_KEYS as readonly string[]).includes(r.key)) continue;
    const s = (data.metrics[r.key as MetricKey] ??= blank());
    const i = idx.get(r.period)!;
    if (s[i] === null) s[i] = r.value;
  }
  return data;
}
