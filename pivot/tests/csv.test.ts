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
    const { columns, dayFirst } = detectColumns(p.header, p.rows);
    expect(columns.map((c) => c.target)).toEqual(["date", "revenue", "customers", "marketingSpend", "churnRate"]);
    const { rows, summary } = aggregate(p, mapOf(columns), dayFirst);
    expect(summary.months).toEqual(["2026-07", "2026-08", "2026-09"]);
    const ret = rows.find((r) => r.key === "retention" && r.period === "2026-08")!;
    expect(ret.value).toBeCloseTo(0.94);
  });

  it("sums daily rows into months and builds product breakdowns", () => {
    const p = parseCsv("date,product,revenue,units\n2026-08-01,Mugs,100,4\n2026-08-15,Mugs,50,2\n2026-08-02,Bowls,70,1\n2026-09-03,Mugs,90,3\n2026-09-04,Bowls,80,2\n");
    const { columns, dayFirst } = detectColumns(p.header, p.rows);
    expect(columns.map((c) => c.target)).toEqual(["date", "product", "revenue", "units"]);
    const { rows } = aggregate(p, mapOf(columns), dayFirst);
    const data = fromMetricRows(rows, { name: "T", currency: "USD" });
    expect(data.periods).toEqual(["2026-08", "2026-09"]);
    expect(data.metrics.revenue).toEqual([220, 170]);
    expect(data.products.Mugs.revenue).toEqual([150, 90]);
    expect(data.products.Bowls.units).toEqual([1, 2]);
  });

  it("aggregates order-level files with customer IDs", () => {
    const p = parseCsv("order_date,customer_id,amount\n2026-08-01,a,10\n2026-08-02,b,20\n2026-09-01,a,15\n2026-09-02,c,5\n2026-09-05,c,5\n");
    const { columns, dayFirst } = detectColumns(p.header, p.rows);
    expect(columns.map((c) => c.target)).toEqual(["date", "customerId", "revenue"]);
    const { rows, summary } = aggregate(p, mapOf(columns), dayFirst);
    expect(summary.shape).toBe("transactions");
    const data = fromMetricRows(rows, { name: "T", currency: "USD" });
    expect(data.metrics.revenue).toEqual([30, 25]);
    expect(data.metrics.orders).toEqual([2, 3]);
    expect(data.metrics.customers).toEqual([2, 2]);
    expect(data.metrics.newCustomers).toEqual([null, 1]);
  });

  it("explains what's missing", () => {
    const p = parseCsv("label,value\nx,1\ny,2\n");
    const { columns, dayFirst } = detectColumns(p.header, p.rows);
    expect(() => aggregate(p, mapOf(columns), dayFirst)).toThrow(/date or month/);
  });

  it("round-trips the sample CSV through the importer into the same analysis", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    const p = parseCsv(northstarCsv(now));
    const { columns, dayFirst } = detectColumns(p.header, p.rows);
    expect(columns.filter((c) => c.target === "ignore")).toEqual([]);
    const { rows } = aggregate(p, mapOf(columns), dayFirst);
    const fromCsv = analyze(fromMetricRows(rows, { name: "Northstar Commerce", currency: "USD", industry: "ecommerce" }));
    const direct = analyze(fromMetricRows(toMetricRows(northstarData(now)), { name: "Northstar Commerce", currency: "USD", industry: "ecommerce" }));
    expect(fromCsv.kpis.map((k) => k.display)).toEqual(direct.kpis.filter((k) => k.key !== "score").map((k) => k.display).concat(fromCsv.kpis.at(-1)!.display));
  });
});
