import { DERIVED, type MetricRow } from "../data/metrics";
import { CsvError, type ParsedCsv } from "./parse";
import { toMonth, toNumber, TARGETS, type Target } from "./detect";

/**
 * Turn a parsed CSV + confirmed column mapping into monthly metric rows.
 *
 * Two file shapes:
 * - Periodic: each row is a period (month, week or day), optionally split by
 *   one product / channel / segment column. Amounts are summed per month,
 *   customer counts take the month's last value, rates are averaged.
 * - Transactions: one row per order with a customer ID. PIVOT counts orders,
 *   distinct customers and first-time customers per month.
 */
export type Mapping = Record<string, Target>;

export interface ImportSummary {
  shape: "periodic" | "transactions";
  months: string[];
  metrics: string[];
  breakdowns: { kind: "product" | "channel" | "segment"; values: number } | null;
  warnings: string[];
  skippedRows: number;
}

const ADDITIVE = new Set<Target>(["revenue", "orders", "newCustomers", "churnedCustomers", "cogs", "opex", "marketingSpend", "visitors", "profit", "units"]);
const RATES = new Set<Target>(["retention", "churnRate", "conversionRate"]);
const METRICS = new Set<Target>([...ADDITIVE, ...RATES, "customers"]);
const DIM_KEYS: Record<"product" | "channel" | "segment", Target[]> = {
  product: ["revenue", "units"],
  channel: ["marketingSpend", "newCustomers"],
  segment: ["customers", "churnedCustomers"],
};

const rate = (n: { value: number; percent: boolean }) => (n.percent || n.value > 1 ? n.value / 100 : n.value);

export function aggregate(parsed: ParsedCsv, mapping: Mapping, dayFirst: boolean): { rows: MetricRow[]; summary: ImportSummary } {
  const col = (t: Target) => parsed.header.findIndex((h) => mapping[h] === t);
  const dateIdx = col("date");
  if (dateIdx < 0) throw new CsvError("Choose which column holds the date or month.");
  const metricCols = parsed.header.map((h, i) => ({ h, i, t: mapping[h] })).filter((c) => METRICS.has(c.t));
  const dims = (["product", "channel", "segment"] as const).map((k) => ({ k, i: col(k) })).filter((d) => d.i >= 0);
  const custIdx = col("customerId");
  const warnings: string[] = [];
  if (dims.length > 1) warnings.push(`Only one breakdown column is used per file; using ${dims[0].k}.`);
  const dim = dims[0] ?? null;
  if (!metricCols.length && custIdx < 0) throw new CsvError("Map at least one column to a metric, such as Revenue.");

  const rows: MetricRow[] = [];
  let skipped = 0;
  const monthsSet = new Set<string>();

  if (custIdx >= 0) {
    // ---- Transactions -------------------------------------------------------
    const revIdx = col("revenue");
    const unitsIdx = col("units");
    if (revIdx < 0) throw new CsvError("For order-level files, map the order amount column to Revenue.");
    type M = { revenue: number; orders: number; customers: Set<string>; prod: Map<string, { revenue: number; units: number }>; seg: Map<string, Set<string>> };
    const byMonth = new Map<string, M>();
    for (const r of parsed.rows) {
      const month = toMonth(r[dateIdx] ?? "", dayFirst);
      const amt = toNumber(r[revIdx] ?? "");
      if (!month || !amt) {
        skipped++;
        continue;
      }
      const m = byMonth.get(month) ?? { revenue: 0, orders: 0, customers: new Set(), prod: new Map(), seg: new Map() };
      byMonth.set(month, m);
      m.revenue += amt.value;
      m.orders++;
      const cust = (r[custIdx] ?? "").trim().toLowerCase();
      if (cust) m.customers.add(cust);
      if (dim?.k === "product") {
        const name = (r[dim.i] ?? "").trim().slice(0, 60) || "Other";
        const p = m.prod.get(name) ?? { revenue: 0, units: 0 };
        p.revenue += amt.value;
        p.units += unitsIdx >= 0 ? (toNumber(r[unitsIdx] ?? "")?.value ?? 0) : 1;
        m.prod.set(name, p);
      } else if (dim?.k === "segment" && cust) {
        const name = (r[dim.i] ?? "").trim().slice(0, 60) || "Other";
        (m.seg.get(name) ?? m.seg.set(name, new Set()).get(name)!).add(cust);
      }
    }
    if (dim?.k === "channel") warnings.push("Channel breakdowns need marketing spend by channel; this order file's channel column was not used.");
    const months = [...byMonth.keys()].sort();
    const seen = new Set<string>();
    months.forEach((month, k) => {
      const m = byMonth.get(month)!;
      monthsSet.add(month);
      rows.push({ period: month, key: "revenue", dimension: "", value: m.revenue }, { period: month, key: "orders", dimension: "", value: m.orders });
      if (m.customers.size) {
        rows.push({ period: month, key: "customers", dimension: "", value: m.customers.size });
        const fresh = [...m.customers].filter((c) => !seen.has(c)).length;
        // The first month has no history: everyone would look "new".
        if (k > 0) rows.push({ period: month, key: "newCustomers", dimension: "", value: fresh });
        m.customers.forEach((c) => seen.add(c));
      }
      for (const [name, p] of m.prod) {
        rows.push({ period: month, key: "revenue", dimension: `product:${name}`, value: p.revenue });
        rows.push({ period: month, key: "units", dimension: `product:${name}`, value: p.units });
      }
      for (const [name, s] of m.seg) rows.push({ period: month, key: "customers", dimension: `segment:${name}`, value: s.size });
    });
    warnings.push("Customers are counted as people who bought that month, so retention means the share of last month's buyers who bought again.");
    return finish(rows, monthsSet, "transactions", dim, skipped, warnings);
  }

  // ---- Periodic --------------------------------------------------------------
  // (month, dimension value) -> metric -> accumulated value
  type Acc = { sum: number; n: number; last: number };
  const acc = new Map<string, Map<Target, Acc>>();
  const dimValues = new Set<string>();
  for (const r of parsed.rows) {
    const month = toMonth(r[dateIdx] ?? "", dayFirst);
    if (!month) {
      skipped++;
      continue;
    }
    const dv = dim ? (r[dim.i] ?? "").trim().slice(0, 60) || "Other" : "";
    if (dim) dimValues.add(dv);
    const key = `${month}\u0000${dv}`;
    const m = acc.get(key) ?? new Map<Target, Acc>();
    acc.set(key, m);
    let any = false;
    for (const c of metricCols) {
      const n = toNumber(r[c.i] ?? "");
      if (!n) continue;
      any = true;
      const v = RATES.has(c.t) ? rate(n) : n.value;
      const a = m.get(c.t) ?? { sum: 0, n: 0, last: 0 };
      a.sum += v;
      a.n++;
      a.last = v;
      m.set(c.t, a);
    }
    if (!any) skipped++;
    else monthsSet.add(month);
  }

  const valueOf = (t: Target, a: Acc) => (ADDITIVE.has(t) ? a.sum : t === "customers" ? a.last : a.sum / a.n);
  const totals = new Map<string, Map<Target, { sum: number; n: number }>>();
  for (const [key, m] of acc) {
    const [month, dv] = key.split("\u0000");
    const t = totals.get(month) ?? new Map();
    totals.set(month, t);
    for (const [target, a] of m) {
      const v = valueOf(target, a);
      const cur = t.get(target) ?? { sum: 0, n: 0 };
      cur.sum += v;
      cur.n++;
      t.set(target, cur);
      if (dim && DIM_KEYS[dim.k].includes(target)) rows.push({ period: month, key: target, dimension: `${dim.k}:${dv}`, value: v });
    }
  }
  for (const [month, t] of totals) {
    for (const [target, { sum, n }] of t) {
      const v = RATES.has(target) ? sum / n : sum;
      // A total summed from a breakdown (e.g. revenue across the products in
      // this file) is "derived": it fills gaps but never overrides a real
      // company total from another dataset.
      const dimension = dim && DIM_KEYS[dim.k].includes(target) ? DERIVED : "";
      if (target === "churnRate") rows.push({ period: month, key: "retention", dimension, value: 1 - v });
      else rows.push({ period: month, key: target, dimension, value: v });
    }
  }
  if (dim && dimValues.size > 40) warnings.push(`The ${dim.k} column has ${dimValues.size} different values. Breakdowns read best with fewer than 20.`);
  return finish(rows, monthsSet, "periodic", dim ? { k: dim.k, i: dimValues.size } : null, skipped, warnings);
}

function finish(
  rows: MetricRow[],
  monthsSet: Set<string>,
  shape: ImportSummary["shape"],
  dim: { k: "product" | "channel" | "segment"; i: number } | null,
  skipped: number,
  warnings: string[],
) {
  const months = [...monthsSet].sort();
  if (!months.length) throw new CsvError("We couldn't read any dates in the date column. Use a format like 2026-09 or 2026-09-30.");
  if (months.length < 2) warnings.unshift("Only one month of data: PIVOT needs at least two to show changes, and six or more for trends.");
  if (skipped) warnings.push(`${skipped.toLocaleString("en-US")} row${skipped === 1 ? " was" : "s were"} skipped because the date or values couldn't be read.`);
  const metrics = [...new Set(rows.filter((r) => r.dimension === "" || r.dimension === DERIVED).map((r) => r.key))].map((k) => (k in TARGETS ? TARGETS[k as Target] : k));
  return {
    rows,
    summary: { shape, months, metrics, breakdowns: dim ? { kind: dim.k, values: dim.i } : null, warnings, skippedRows: skipped },
  };
}
