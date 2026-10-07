import { describe, expect, it } from "vitest";
import { aggregate } from "@/lib/csv/aggregate";
import { detectColumns, toMonth, toNumber } from "@/lib/csv/detect";
import { CsvError, parseCsv } from "@/lib/csv/parse";
import { fromMetricRows, toMetricRows } from "@/lib/data/metrics";
import { northstarCsv, northstarData } from "@/lib/demo/northstar";
import { analyze } from "@/lib/engine/analyze";

const mapOf = (cols: { name: string; target: string }[]) => Object.fromEntries(cols.map((c) => [c.name, c.target])) as Record<string, never>;

describe("parseCsv", () => {
  it("handles quotes, escaped quotes, CRLF and a BOM", () => {
    const p = parseCsv('﻿month,"Net Sales","Note"\r\n2026-01,"1,200","said ""hi"""\r\n2026-02,1300,\r\n');
    expect(p.header).toEqual(["month", "Net Sales", "Note"]);
    expect(p.rows).toEqual([
      ["2026-01", "1,200", 'said "hi"'],
      ["2026-02", "1300", ""],
    ]);
  });
  it("sniffs semicolons and tabs", () => {
    expect(parseCsv("a;b\n1;2").delimiter).toBe(";");
    expect(parseCsv("a\tb\n1\t2").rows[0]).toEqual(["1", "2"]);
  });
  it("rejects empty, binary and malformed files with friendly messages", () => {
    expect(() => parseCsv("")).toThrow(CsvError);
    expect(() => parseCsv("a,b\n\u0000\u0001")).toThrow(/text CSV/);
    expect(() => parseCsv('a,b\n"unclosed,1')).toThrow(/never closed/);
    expect(() => parseCsv("only,a,header")).toThrow(/header row and at least one row/);
  });
  it("enforces row limits", () => {
    const big = "a\n" + "1\n".repeat(20);
    expect(() => parseCsv(big, 10)).toThrow(/more than 10 rows/);
  });
});

describe("value parsing", () => {
  it("reads many date formats", () => {
    expect(toMonth("2026-09-30")).toBe("2026-09");
    expect(toMonth("2026/9")).toBe("2026-09");
    expect(toMonth("Sep 2026")).toBe("2026-09");
    expect(toMonth("September 2026")).toBe("2026-09");
    expect(toMonth("09/30/2026")).toBe("2026-09");
    expect(toMonth("30/09/2026")).toBe("2026-09");
    expect(toMonth("03/04/2026", true)).toBe("2026-04");
    expect(toMonth("46295")).toBe("2026-09"); // Excel serial
    expect(toMonth("not a date")).toBeNull();
  });
  it("reads money, negatives and percentages", () => {
    expect(toNumber("$1,234.50")?.value).toBe(1234.5);
    expect(toNumber("(200)")?.value).toBe(-200);
    expect(toNumber("1.234,56")?.value).toBe(1234.56);
    expect(toNumber("12.5%")).toEqual({ value: 12.5, percent: true });
    expect(toNumber("n/a")).toBeNull();
  });
});

describe("detectColumns + aggregate", () => {
  it("maps common headers and imports a monthly file", () => {
    const p = parseCsv("Month,Net Sales,Active Customers,Ad Spend,Churn Rate\n2026-07,100000,1000,8000,5%\n2026-08,110000,1050,9000,6%\n2026-09,120000,1100,9500,5.5%\n");
    const { columns, format } = detectColumns(p.header, p.rows, p.delimiter);
    expect(columns.map((c) => c.target)).toEqual(["date", "revenue", "customers", "marketingSpend", "churnRate"]);
    const { rows, summary } = aggregate(p, mapOf(columns), format);
    expect(summary.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    const ret = rows.find((r) => r.key === "retention" && r.period === "2026-08")!;
    expect(ret.value).toBeCloseTo(0.94);
  });

  it("sums daily rows into months and builds product breakdowns", () => {
    const p = parseCsv("date,product,revenue,units\n2026-08-01,Mugs,100,4\n2026-08-15,Mugs,50,2\n2026-08-02,Bowls,70,1\n2026-09-03,Mugs,90,3\n2026-09-04,Bowls,80,2\n");
    const { columns, format } = detectColumns(p.header, p.rows, p.delimiter);
    expect(columns.map((c) => c.target)).toEqual(["date", "product", "revenue", "units"]);
    const { rows } = aggregate(p, mapOf(columns), format);
    const data = fromMetricRows(rows, { name: "T", currency: "USD" });
    expect(data.periods).toEqual(["2026-08", "2026-09"]);
    expect(data.metrics.revenue).toEqual([220, 170]);
    expect(data.products.Mugs.revenue).toEqual([150, 90]);
    expect(data.products.Bowls.units).toEqual([1, 2]);
  });

  it("aggregates order-level files with customer IDs", () => {
    const p = parseCsv("order_date,customer_id,amount\n2026-08-01,a,10\n2026-08-02,b,20\n2026-09-01,a,15\n2026-09-02,c,5\n2026-09-05,c,5\n");
    const { columns, format } = detectColumns(p.header, p.rows, p.delimiter);
    expect(columns.map((c) => c.target)).toEqual(["date", "customerId", "revenue"]);
    const { rows, summary } = aggregate(p, mapOf(columns), format);
    expect(summary.shape).toBe("transactions");
    const data = fromMetricRows(rows, { name: "T", currency: "USD" });
    expect(data.metrics.revenue).toEqual([30, 25]);
    expect(data.metrics.orders).toEqual([2, 3]);
    expect(data.metrics.customers).toEqual([2, 2]);
    expect(data.metrics.newCustomers).toEqual([null, 1]);
  });

  it("explains what's missing", () => {
    const p = parseCsv("label,value\nx,1\ny,2\n");
    const { columns, format } = detectColumns(p.header, p.rows, p.delimiter);
    expect(() => aggregate(p, mapOf(columns), format)).toThrow(/date or month/);
  });

  it("round-trips the sample CSV through the importer into the same analysis", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const p = parseCsv(northstarCsv(now));
    const { columns, format } = detectColumns(p.header, p.rows, p.delimiter);
    expect(columns.filter((c) => c.target === "ignore")).toEqual([]);
    const { rows } = aggregate(p, mapOf(columns), format);
    const fromCsv = analyze(fromMetricRows(rows, { name: "Northstar Commerce", currency: "USD", industry: "ecommerce" }));
    const direct = analyze(fromMetricRows(toMetricRows(northstarData(now)), { name: "Northstar Commerce", currency: "USD", industry: "ecommerce" }));
    expect(fromCsv.kpis.map((k) => k.display)).toEqual(direct.kpis.filter((k) => k.key !== "score").map((k) => k.display).concat(fromCsv.kpis.at(-1)!.display));
  });
});

describe("combining datasets", () => {
  it("never lets a breakdown file's summed total override a real total", () => {
    const totals = parseCsv("month,revenue,customers\n2026-08,1000,50\n2026-09,1200,55\n");
    const byProduct = parseCsv("month,product,revenue\n2026-08,Mugs,300\n2026-09,Mugs,350\n2026-10,Mugs,400\n");
    const a = detectColumns(totals.header, totals.rows);
    const b = detectColumns(byProduct.header, byProduct.rows);
    const rows = [...aggregate(totals, mapOf(a.columns), a.format).rows, ...aggregate(byProduct, mapOf(b.columns), b.format).rows];
    const data = fromMetricRows(rows, { name: "T", currency: "USD" });
    // Real totals win where they exist; the product sum only fills October.
    expect(data.metrics.revenue).toEqual([1000, 1200, 400]);
    expect(data.products.Mugs.revenue).toEqual([300, 350, 400]);
  });
});

describe("real-world file formats", () => {
  const load = (csv: string) => {
    const p = parseCsv(csv);
    const d = detectColumns(p.header, p.rows, p.delimiter);
    const out = aggregate(p, mapOf(d.columns), d.format);
    const val = (period: string, key: string) => out.rows.find((r) => r.period === period && r.key === key && (r.dimension === "" || r.dimension === "*"))?.value;
    return { ...out, ...d, val };
  };

  it("reads decimal commas in European (semicolon) files", () => {
    const f = load("Date;Revenue;Conversion rate\n2025-09;1000,50;0,8\n2025-10;1.100,25;1,2\n");
    expect(f.format.decimalComma).toBe(true);
    expect(f.val("2025-09", "revenue")).toBe(1000.5);
    expect(f.val("2025-10", "revenue")).toBe(1100.25);
    expect(f.val("2025-09", "conversionRate")).toBeCloseTo(0.008);
    expect(toNumber("1.234.567", true)?.value).toBe(1234567);
    expect(toNumber("0,8", true)?.value).toBe(0.8);
  });

  it("keeps US numbers as they are", () => {
    const f = load('Month,Revenue\n2026-01,"1,234.50"\n2026-02,"2,000.25"\n');
    expect(f.format.decimalComma).toBe(false);
    expect(f.val("2026-01", "revenue")).toBe(1234.5);
  });

  it("reads monthly day-first dates on the 1st as separate months", () => {
    const f = load("Date,Revenue\n01/09/2025,1000\n01/10/2025,1100\n01/11/2025,1200\n01/12/2025,900\n01/01/2026,1300\n");
    expect(f.format.dayFirst).toBe(true);
    expect(f.summary.months).toEqual(["2025-09", "2025-10", "2025-11", "2025-12", "2026-01"]);
  });

  it("flags dates whose order can't be told apart, and the user's choice wins", () => {
    const p = parseCsv("Date,Revenue\n03/04/2026,10\n05/06/2026,20\n");
    const d = detectColumns(p.header, p.rows, p.delimiter);
    expect(d.format.dateOrderUnclear).toBe(true);
    expect(aggregate(p, mapOf(d.columns), { dayFirst: true, decimalComma: false }).summary.months).toEqual(["2026-04", "2026-06"]);
    expect(aggregate(p, mapOf(d.columns), { dayFirst: false, decimalComma: false }).summary.months).toEqual(["2026-03", "2026-05"]);
  });

  it("chooses one percentage scale per rate column", () => {
    const f = load("Month,Revenue,Churn rate\n2026-01,100,0.8\n2026-02,100,1.2\n");
    expect(f.val("2026-01", "retention")).toBeCloseTo(0.992);
    expect(f.val("2026-02", "retention")).toBeCloseTo(0.988);
    expect(load("Month,Revenue,Retention\n2026-01,100,0.95\n2026-02,100,0.9\n").val("2026-02", "retention")).toBeCloseTo(0.9);
  });

  it("imports a file with both retention and churn rate (one retention row per month)", () => {
    const f = load("Month,Revenue,Retention rate,Churn rate\n2026-01,100,95%,5%\n2026-02,120,96%,4%\n");
    const keys = f.rows.map((r) => `${r.period}|${r.key}|${r.dimension}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(f.val("2026-02", "retention")).toBeCloseTo(0.96);
    expect(f.summary.warnings.join(" ")).toMatch(/uses the retention rate/);
  });

  it("takes customers from the month's latest date even in newest-first files", () => {
    const f = load("Date,Customers,Revenue\n2026-01-31,500,10\n2026-01-01,400,10\n2025-12-31,390,10\n2025-12-01,300,10\n");
    expect(f.val("2026-01", "customers")).toBe(500);
    expect(f.val("2025-12", "customers")).toBe(390);
  });

  it("understands common month formats", () => {
    expect(toMonth("09/2026")).toBe("2026-09");
    expect(toMonth("Sep-26")).toBe("2026-09");
    expect(toMonth("Sep '26")).toBe("2026-09");
    expect(toMonth("202609")).toBe("2026-09");
    expect(toMonth("202613")).toBeNull();
    const f = load("YearMonth,Revenue\n202601,100\n202602,120\n");
    expect(f.columns[0].target).toBe("date");
    expect(f.summary.months).toEqual(["2026-01", "2026-02"]);
  });
});
