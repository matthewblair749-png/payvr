import { isNum } from "./series";
import type { BusinessData, MetricKey, Series } from "./types";

/**
 * Fill in the metrics that can be computed from others, so analysis works
 * with whatever columns a company has:
 * - retention from churned (or new) customers
 * - profit from revenue minus costs
 * - conversion from orders / visitors
 * Supplied values always win over computed ones.
 */
export interface Derived {
  periods: string[];
  n: number;
  revenue?: Series;
  orders?: Series;
  customers?: Series;
  newCustomers?: Series;
  churned?: Series;
  retention?: Series;
  cogs?: Series;
  opex?: Series;
  marketing?: Series;
  visitors?: Series;
  conversion?: Series;
  profit?: Series;
  margin?: Series;
  cac?: Series;
  aov?: Series;
  arpc?: Series;
}

function has(s: Series | undefined): s is Series {
  return Boolean(s && s.some(isNum));
}

function zip(a: Series, b: Series, f: (x: number, y: number) => number | null): Series {
  return a.map((x, i) => (isNum(x) && isNum(b[i]) ? f(x, b[i] as number) : null));
}

function shiftPrev(s: Series): Series {
  return [null, ...s.slice(0, -1)];
}

export function derive(data: BusinessData): Derived {
  const m = data.metrics;
  const n = data.periods.length;
  const get = (k: MetricKey) => (has(m[k]) ? (m[k] as Series) : undefined);

  const d: Derived = {
    periods: data.periods,
    n,
    revenue: get("revenue"),
    orders: get("orders"),
    customers: get("customers"),
    newCustomers: get("newCustomers"),
    churned: get("churnedCustomers"),
    cogs: get("cogs"),
    opex: get("opex"),
    marketing: get("marketingSpend"),
    visitors: get("visitors"),
  };

  // If marketing spend only exists per channel, total it.
  if (!d.marketing) {
    const chans = Object.values(data.channels);
    if (chans.length) {
      const total = data.periods.map((_, i) => {
        const vals = chans.map((c) => c.spend[i]).filter(isNum);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
      });
      if (has(total)) d.marketing = total;
    }
  }
  // Revenue from products if no total was given.
  if (!d.revenue) {
    const prods = Object.values(data.products);
    if (prods.length) {
      const total = data.periods.map((_, i) => {
        const vals = prods.map((p) => p.revenue[i]).filter(isNum);
        return vals.length ? vals.reduce((a, b) => a + b, 0) : null;
      });
      if (has(total)) d.revenue = total;
    }
  }

  // Retention: given > from churned > from new customers.
  const givenRetention = get("retention");
  if (givenRetention) d.retention = givenRetention;
  else if (d.customers && d.churned) d.retention = zip(d.churned, shiftPrev(d.customers), (ch, prev) => (prev > 0 ? 1 - ch / prev : null));
  else if (d.customers && d.newCustomers) {
    const prev = shiftPrev(d.customers);
    d.retention = d.customers.map((c, i) => {
      const p = prev[i];
      const nw = d.newCustomers![i];
      return isNum(c) && isNum(p) && isNum(nw) && p > 0 ? Math.min(1, Math.max(0, (c - nw) / p)) : null;
    });
  }
  if (!d.churned && d.customers && d.retention) {
    d.churned = zip(d.retention, shiftPrev(d.customers), (r, prev) => Math.max(0, Math.round(prev * (1 - r))));
  }
  if (!d.newCustomers && d.customers && d.retention) {
    const prev = shiftPrev(d.customers);
    d.newCustomers = d.customers.map((c, i) => {
      const p = prev[i];
      const r = d.retention![i];
      return isNum(c) && isNum(p) && isNum(r) ? Math.max(0, Math.round(c - p * r)) : null;
    });
  }

  // Profit: given > revenue minus known costs (needs COGS or operating costs).
  const givenProfit = get("profit");
  if (givenProfit) d.profit = givenProfit;
  else if (d.revenue && (d.cogs || d.opex)) {
    const costs = [d.cogs, d.opex, d.marketing].filter((s): s is Series => !!s);
    d.profit = d.revenue.map((r, i) => {
      // A gap in a cost series (books not closed yet) means profit is unknown, not cost-free.
      if (!isNum(r) || costs.some((s) => !isNum(s[i]))) return null;
      return r - costs.reduce((sum, s) => sum + (s[i] as number), 0);
    });
  }
  if (d.profit && d.revenue) d.margin = zip(d.profit, d.revenue, (p, r) => (r > 0 ? p / r : null));

  const givenConv = get("conversionRate");
  if (givenConv) d.conversion = givenConv;
  else if (d.orders && d.visitors) d.conversion = zip(d.orders, d.visitors, (o, v) => (v > 0 ? o / v : null));

  if (d.marketing && d.newCustomers) d.cac = zip(d.marketing, d.newCustomers, (s, nw) => (nw > 0 ? s / nw : null));
  if (d.revenue && d.orders) d.aov = zip(d.revenue, d.orders, (r, o) => (o > 0 ? r / o : null));
  if (d.revenue && d.customers) d.arpc = zip(d.revenue, d.customers, (r, c) => (c > 0 ? r / c : null));

  return d;
}
