import type { BusinessData, Series } from "../engine/types";

/**
 * Northstar Commerce: the demo company.
 *
 * 24 months of realistic, internally consistent data for a direct-to-consumer
 * retailer: revenue, orders, customers (new and churned), costs, marketing by
 * channel, products, segments and site traffic. Deterministic (seeded), so
 * the demo tells the same story every time:
 *
 * Northstar started a growth push in the last three months. Marketing spend
 * tripled, revenue accelerated (+12.4% last month) and Product B took off
 * (+31% demand in 60 days). But most of the extra spend went to Channel C,
 * where each customer now costs 3x more, and the push pulled in
 * price-sensitive customers who are leaving fast: retention fell three
 * months in a row.
 *
 * None of PIVOT's insights are written here. The engine finds all of it.
 * The latest month always ends at the last complete calendar month.
 */

export const NORTHSTAR = {
  name: "Northstar Commerce",
  currency: "USD",
  industry: "ecommerce" as const,
  marketSharePct: 18.6,
};

const MONTHS = 24;

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** The last complete month before `now`, as "YYYY-MM". */
export function lastCompleteMonth(now: Date): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth(); // 0-based; the previous month is m-1
  const d = new Date(Date.UTC(y, m - 1, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export function periodsEnding(end: string, count: number): string[] {
  const [y, m] = end.split("-").map(Number);
  return Array.from({ length: count }, (_, k) => {
    const d = new Date(Date.UTC(y, m - 1 - (count - 1 - k), 1));
    return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  });
}

const round = (n: number) => Math.round(n);

export function northstarData(now: Date = new Date()): BusinessData {
  const rand = mulberry32(20261006);
  const noise = () => rand() * 2 - 1;
  const periods = periodsEnding(lastCompleteMonth(now), MONTHS);
  const L = MONTHS - 1; // latest index

  // Seasonality by position: the holiday peak lands 9-10 months before the latest month.
  const season = (i: number) => ({ [L - 10]: 1.08, [L - 9]: 1.14, [L - 8]: 0.94, [L - 7]: 0.95 })[i] ?? 1;

  // Revenue
  const revenue = Array.from({ length: MONTHS }, (_, i) => 1_800_000 * 1.0145 ** i * season(i) * (1 + 0.012 * noise()));
  revenue[L - 1] = 2_526_690;
  revenue[L] = 2_840_000;

  // Retention (share of last month's customers who stayed)
  const retention: (number | null)[] = Array.from({ length: MONTHS }, (_, i) => (i === 0 ? null : 0.9455 + 0.0018 * noise()));
  retention[L - 4] = 0.945;
  retention[L - 3] = 0.946;
  retention[L - 2] = 0.941;
  retention[L - 1] = 0.935;
  retention[L] = 0.914;

  // Customers grow steadily (holiday peaks come from bigger baskets, not more
  // customers), pinned for the push months.
  const customers = revenue.map((_, i) => round(31_500 * 1.0123 ** i * (1 + 0.0015 * noise())));
  customers[L - 2] = 41_658;
  customers[L - 1] = 44_426;
  customers[L] = 48_291;

  const newCustomers: (number | null)[] = customers.map((c, i) => (i === 0 ? null : round(c - customers[i - 1] * (retention[i] as number))));
  const churned: (number | null)[] = customers.map((_, i) => (i === 0 ? null : round(customers[i - 1] * (1 - (retention[i] as number)))));
  // Make the identity exact: customers = previous - churned + new.
  for (let i = 1; i < MONTHS; i++) newCustomers[i] = customers[i] - customers[i - 1] + (churned[i] as number);

  // Acquisition cost: stable around $47-50, then rising with the push.
  const cac = Array.from({ length: MONTHS }, (_, i) => 44.5 * 1.0045 ** i * (1 + 0.02 * noise()));
  cac[L - 1] = 52.1;
  cac[L] = 52.1 * 1.18;
  const marketing = newCustomers.map((nw, i) => round((nw ?? round(customers[0] * 0.068)) * cac[i]));

  // Costs: goods are 27.5% of revenue; operating costs grow slowly.
  const cogs = revenue.map((r) => round(r * 0.275));
  const opex = revenue.map((_, i) => round(902_500 * 1.004 ** (i - (L - 1)) * (1 + 0.004 * noise())));
  // Pin profit for the last two months: Aug $644,068, Sep $684,000.
  opex[L - 1] = round(revenue[L - 1] - cogs[L - 1] - marketing[L - 1] - 644_068);
  opex[L] = round(revenue[L] - cogs[L] - marketing[L] - 684_000);

  // Orders, traffic, conversion
  const aov = revenue.map((_, i) => 72 * (i === L - 9 ? 1.05 : 1) * (1 + 0.01 * noise()));
  const orders = revenue.map((r, i) => round(r / aov[i]));
  const conversion = revenue.map(() => 0.0282 + 0.0007 * noise());
  const visitors = orders.map((o, i) => round(o / conversion[i]));

  // Products: Product B takes off in the last two months (+31% units in 60 days).
  const bShare = revenue.map((_, i) => 0.16 + (0.03 * i) / L);
  bShare[L - 2] = 0.19;
  const bUnitPrice = 46;
  const products: BusinessData["products"] = {};
  const bRevenue = revenue.map((r, i) => r * bShare[i]);
  bRevenue[L - 1] = bRevenue[L - 2] * 1.14;
  bRevenue[L] = bRevenue[L - 2] * 1.31;
  const rest = revenue.map((r, i) => r - bRevenue[i]);
  const mix = (i: number) => {
    const a = 0.5 - (0.06 * i) / L;
    const c = 0.3 + (0.04 * i) / L;
    return { a, c, d: 1 - a - c };
  };
  const unitPrices = { "Product A": 38, "Product C": 64, "Product D": 29 };
  products["Product A"] = { revenue: rest.map((x, i) => round(x * mix(i).a)), units: rest.map((x, i) => round((x * mix(i).a) / unitPrices["Product A"])) };
  products["Product B"] = { revenue: bRevenue.map(round), units: bRevenue.map((x) => round(x / bUnitPrice)) };
  products["Product C"] = { revenue: rest.map((x, i) => round(x * mix(i).c)), units: rest.map((x, i) => round((x * mix(i).c) / unitPrices["Product C"])) };
  // Product D takes the rounding remainder so products always sum to revenue.
  products["Product D"] = {
    revenue: revenue.map((r, i) => round(r) - products["Product A"].revenue[i]! - products["Product B"].revenue[i]! - products["Product C"].revenue[i]!),
    units: rest.map((x, i) => round((x * mix(i).d) / unitPrices["Product D"])),
  };

  // Channels: Channel C absorbs most of the push and gets expensive.
  const spendShare = (i: number) =>
    i === L ? [0.27, 0.3, 0.43] : i === L - 1 ? [0.34, 0.34, 0.32] : i === L - 2 ? [0.36, 0.34, 0.3] : [0.42, 0.36, 0.22];
  const newShare = (i: number) =>
    i === L ? [0.42, 0.36, 0.22] : i === L - 1 ? [0.47, 0.33, 0.2] : i === L - 2 ? [0.48, 0.34, 0.18] : [0.52, 0.33, 0.15];
  const channelNames = ["Channel A", "Channel B", "Channel C"];
  const channels: BusinessData["channels"] = {};
  channelNames.forEach((name, c) => {
    const spend = marketing.map((m, i) => (c === 2 ? m - round(marketing[i] * spendShare(i)[0]) - round(marketing[i] * spendShare(i)[1]) : round(m * spendShare(i)[c])));
    const nc: Series = newCustomers.map((nw, i) =>
      nw === null ? null : c === 2 ? nw - round(nw * newShare(i)[0]) - round(nw * newShare(i)[1]) : round(nw * newShare(i)[c]),
    );
    channels[name] = { spend, newCustomers: nc };
  });

  // Segments: price-sensitive customers churn faster, and much faster lately.
  const segNames = ["Price-sensitive", "Mainstream", "Premium"];
  const segShare = (i: number) => (i === L ? [0.31, 0.5, 0.19] : i === L - 1 ? [0.32, 0.5, 0.18] : i === L - 2 ? [0.3, 0.51, 0.19] : [0.28, 0.52, 0.2]);
  const churnMult = (i: number) => (i === L ? [1.78, 0.8, 0.5] : i === L - 1 ? [1.6, 0.88, 0.55] : i === L - 2 ? [1.5, 0.88, 0.55] : [1.4, 0.88, 0.55]);
  const segCustomers = segNames.map((_, s) =>
    customers.map((c, i) => (s === 2 ? c - round(c * segShare(i)[0]) - round(c * segShare(i)[1]) : round(c * segShare(i)[s]))),
  );
  const segChurned: Series[] = segNames.map(() => Array(MONTHS).fill(null));
  for (let i = 1; i < MONTHS; i++) {
    const prevShares = segNames.map((_, s) => segCustomers[s][i - 1] / customers[i - 1]);
    const k = (churned[i] as number) / customers[i - 1] / prevShares.reduce((acc, sh, s) => acc + sh * churnMult(i)[s], 0);
    let assigned = 0;
    for (let s = 0; s < segNames.length; s++) {
      const v = s === segNames.length - 1 ? (churned[i] as number) - assigned : round(segCustomers[s][i - 1] * churnMult(i)[s] * k);
      segChurned[s][i] = v;
      assigned += v;
    }
  }
  const segments: BusinessData["segments"] = {};
  segNames.forEach((name, s) => (segments[name] = { customers: segCustomers[s], churned: segChurned[s] }));

  return {
    company: { ...NORTHSTAR },
    periods,
    metrics: {
      revenue: revenue.map(round),
      orders,
      customers,
      newCustomers,
      churnedCustomers: churned,
      cogs,
      opex,
      marketingSpend: marketing,
      visitors,
    },
    products,
    channels,
    segments,
  };
}

/** The demo as a CSV (company totals), in the format the Data Center accepts. */
export function northstarCsv(now: Date = new Date()): string {
  const d = northstarData(now);
  const m = d.metrics;
  const header = "month,revenue,orders,customers,new_customers,churned_customers,cost_of_goods,operating_expenses,marketing_spend,website_visitors";
  const rows = d.periods.map((p, i) =>
    [
      p,
      m.revenue![i],
      m.orders![i],
      m.customers![i],
      m.newCustomers![i] ?? "",
      m.churnedCustomers![i] ?? "",
      m.cogs![i],
      m.opex![i],
      m.marketingSpend![i],
      m.visitors![i],
    ].join(","),
  );
  return [header, ...rows].join("\n") + "\n";
}
