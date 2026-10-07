/**
 * Column detection: what each column holds, and which PIVOT metric it maps
 * to. Header names are matched against common synonyms; values decide the
 * type. Everything detected here can be changed on the review screen.
 */

export type ColumnType = "date" | "number" | "percent" | "category" | "id" | "text" | "empty";

export const TARGETS = {
  ignore: "Don't import",
  date: "Date / month",
  revenue: "Revenue",
  orders: "Orders",
  customers: "Active customers",
  newCustomers: "New customers",
  churnedCustomers: "Churned customers",
  retention: "Retention rate",
  churnRate: "Churn rate",
  cogs: "Cost of goods",
  opex: "Operating expenses",
  marketingSpend: "Marketing spend",
  visitors: "Website visitors",
  conversionRate: "Conversion rate",
  profit: "Profit",
  units: "Units sold",
  product: "Product (breakdown)",
  channel: "Marketing channel (breakdown)",
  segment: "Customer segment (breakdown)",
  customerId: "Customer ID (for transaction files)",
} as const;
export type Target = keyof typeof TARGETS;

const SYNONYMS: [Target, string[]][] = [
  ["date", ["date", "month", "period", "day", "week", "orderdate", "createdat", "created", "timestamp", "invoicedate", "transactiondate", "monthstart", "yearmonth"]],
  ["newCustomers", ["newcustomers", "newusers", "signups", "newclients", "newsubscribers", "acquiredcustomers", "newaccounts", "customersacquired"]],
  ["churnedCustomers", ["churned", "churnedcustomers", "lostcustomers", "cancellations", "cancelled", "canceled", "churns", "customerslost"]],
  ["customers", ["customers", "activecustomers", "customercount", "users", "activeusers", "clients", "subscribers", "accounts", "activeaccounts", "payingcustomers"]],
  ["retention", ["retention", "retentionrate", "customerretention"]],
  ["churnRate", ["churnrate", "churnpct", "churnpercent"]],
  ["conversionRate", ["conversion", "conversionrate", "cvr", "convrate"]],
  ["revenue", ["revenue", "sales", "netsales", "grosssales", "totalsales", "income", "turnover", "amount", "total", "ordertotal", "gmv", "totalrevenue", "netrevenue", "salesamount", "ordervalue", "value"]],
  ["orders", ["orders", "ordercount", "transactions", "numorders", "purchases", "invoices", "numberoforders"]],
  ["cogs", ["cogs", "costofgoods", "costofgoodssold", "costofsales", "productcosts", "productcost", "goodscost"]],
  ["opex", ["opex", "operatingexpenses", "operatingcosts", "expenses", "totalexpenses", "costs", "overhead", "operatingexpense"]],
  ["marketingSpend", ["marketing", "marketingspend", "adspend", "advertising", "ads", "paidmedia", "spend", "marketingcost", "marketingcosts", "adcost"]],
  ["visitors", ["visitors", "sessions", "traffic", "websitevisitors", "visits", "uniquevisitors"]],
  ["profit", ["profit", "netprofit", "netincome", "operatingprofit", "ebitda", "grossprofit"]],
  ["units", ["units", "quantity", "qty", "unitssold", "itemssold"]],
  ["product", ["product", "productname", "sku", "item", "itemname", "productcategory", "category", "productline"]],
  ["channel", ["channel", "source", "utmsource", "marketingchannel", "acquisitionchannel", "medium"]],
  ["segment", ["segment", "customersegment", "tier", "plan", "cohort", "customertype"]],
  ["customerId", ["customerid", "customer", "email", "clientid", "userid", "accountid", "customeremail", "buyer"]],
];

export const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function targetFromHeader(header: string): Target | null {
  const h = norm(header);
  if (!h) return null;
  for (const [t, words] of SYNONYMS) if (words.includes(h)) return t;
  // Looser match: the header contains a synonym ("Total Net Sales (USD)").
  for (const [t, words] of SYNONYMS) {
    if (t === "date" || t === "customerId") continue;
    if (words.some((w) => w.length >= 5 && h.includes(w))) return t;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Values

const MONTHS = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const pad = (n: number) => String(n).padStart(2, "0");
const ok = (y: number, m: number) => y >= 1990 && y <= 2100 && m >= 1 && m <= 12;

/** Parse a date-like value to "YYYY-MM". `dayFirst` resolves 03/04/2026 ambiguity. */
export function toMonth(raw: string, dayFirst = false): string | null {
  const v = raw.trim();
  if (!v) return null;
  let m = v.match(/^(\d{4})[-/.](\d{1,2})(?:[-/.](\d{1,2}))?(?:[T\s].*)?$/);
  if (m) return ok(+m[1], +m[2]) ? `${m[1]}-${pad(+m[2])}` : null;
  m = v.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{2,4})(?:\s.*)?$/);
  if (m) {
    const y = +m[3] < 100 ? 2000 + +m[3] : +m[3];
    const a = +m[1];
    const b = +m[2];
    const month = dayFirst ? b : a > 12 ? b : a;
    return ok(y, month) ? `${y}-${pad(month)}` : null;
  }
  m = v.match(/^([A-Za-z]{3,9})\.?[\s,-]+(\d{4})$/);
  if (m) {
    const k = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return k >= 0 && ok(+m[2], k + 1) ? `${m[2]}-${pad(k + 1)}` : null;
  }
  m = v.match(/^(\d{4})[\s-]+([A-Za-z]{3,9})$/);
  if (m) {
    const k = MONTHS.indexOf(m[2].slice(0, 3).toLowerCase());
    return k >= 0 && ok(+m[1], k + 1) ? `${m[1]}-${pad(k + 1)}` : null;
  }
  m = v.match(/^\d{1,2}[\s-]([A-Za-z]{3,9})[\s-](\d{4})$/);
  if (m) {
    const k = MONTHS.indexOf(m[1].slice(0, 3).toLowerCase());
    return k >= 0 && ok(+m[2], k + 1) ? `${m[2]}-${pad(k + 1)}` : null;
  }
  // Excel serial dates (days since 1899-12-30).
  if (/^\d{5}(\.\d+)?$/.test(v)) {
    const n = Number(v);
    if (n > 32_000 && n < 73_000) {
      const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86_400_000);
      return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`;
    }
  }
  return null;
}

/** "$1,234.50" -> 1234.5, "(200)" -> -200, "12.5%" -> 12.5 (percent flag set). */
export function toNumber(raw: string): { value: number; percent: boolean } | null {
  let v = raw.trim();
  if (!v || v === "-" || /^(n\/?a|null|none|—)$/i.test(v)) return null;
  let neg = false;
  if (/^\(.*\)$/.test(v)) {
    neg = true;
    v = v.slice(1, -1);
  }
  const percent = v.endsWith("%");
  v = v.replace(/[%$€£¥₹\s]|USD|EUR|GBP/gi, "");
  if (/^-/.test(v)) {
    neg = !neg;
    v = v.slice(1);
  }
  // 1.234,56 (European) -> 1234.56; 1,234.56 -> 1234.56
  if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(v)) v = v.replace(/\./g, "").replace(",", ".");
  else v = v.replace(/,/g, "");
  if (!/^\d*\.?\d+(e[+-]?\d+)?$/i.test(v)) return null;
  const n = Number(v);
  return Number.isFinite(n) ? { value: neg ? -n : n, percent } : null;
}

export interface DetectedColumn {
  name: string;
  type: ColumnType;
  target: Target;
  samples: string[];
  distinct: number;
}

/** Detect each column's type and the metric it most likely maps to. */
export function detectColumns(header: string[], rows: string[][]): { columns: DetectedColumn[]; dayFirst: boolean } {
  const sample = rows.slice(0, 2000);
  // Day-first dates if any "a/b/yyyy" value has a > 12.
  const dayFirst = sample.some((r) => r.some((c) => /^\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}/.test(c) && Number(c.split(/[/.-]/)[0]) > 12));
  const columns = header.map((name, k) => {
    const vals = sample.map((r) => r[k]).filter((x) => x !== "" && x !== undefined);
    const distinct = new Set(vals).size;
    let type: ColumnType = "text";
    if (!vals.length) type = "empty";
    else {
      const dates = vals.filter((x) => toMonth(x, dayFirst) !== null).length / vals.length;
      const nums = vals.map(toNumber);
      const numeric = nums.filter(Boolean).length / vals.length;
      const pcts = nums.filter((x) => x?.percent).length / vals.length;
      const hinted = targetFromHeader(name);
      if (dates >= 0.9 && (hinted === "date" || numeric < 0.9)) type = "date";
      else if (numeric >= 0.9) type = pcts >= 0.5 ? "percent" : "number";
      else if (distinct <= Math.max(50, vals.length * 0.05)) type = "category";
      else if (distinct >= vals.length * 0.5) type = "id";
    }
    let target: Target = targetFromHeader(name) ?? "ignore";
    // Keep the mapping consistent with the values.
    const numericTargets: Target[] = ["revenue", "orders", "customers", "newCustomers", "churnedCustomers", "retention", "churnRate", "cogs", "opex", "marketingSpend", "visitors", "conversionRate", "profit", "units"];
    if (numericTargets.includes(target) && type !== "number" && type !== "percent") target = target === "customers" && (type === "id" || type === "text") ? "customerId" : "ignore";
    if (target === "date" && type !== "date") target = "ignore";
    if ((target === "product" || target === "channel" || target === "segment") && (type === "number" || type === "percent")) target = "ignore";
    return { name, type, target, samples: vals.slice(0, 3).map((x) => x.slice(0, 40)), distinct };
  });
  // Exactly one date column: the first one wins.
  let dateSeen = false;
  for (const c of columns) {
    if (c.target === "date") {
      if (dateSeen) c.target = "ignore";
      dateSeen = true;
    }
  }
  if (!dateSeen) {
    const firstDate = columns.find((c) => c.type === "date");
    if (firstDate) firstDate.target = "date";
  }
  // Each metric maps from one column only.
  const used = new Set<Target>();
  for (const c of columns) {
    if (c.target === "ignore" || c.target === "date") continue;
    if (used.has(c.target)) c.target = "ignore";
    else used.add(c.target);
  }
  return { columns, dayFirst };
}
