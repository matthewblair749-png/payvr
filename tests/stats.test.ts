import { describe, expect, it } from "vitest";
import { compareConversion, compareRevenue, conversionVerdict, normCdf, splitLooksBroken, visitsNeeded } from "@/lib/experiments/stats";

describe("compareConversion", () => {
  it("detects a clear winner", () => {
    const r = compareConversion({ visits: 2000, conversions: 800 }, { visits: 2000, conversions: 920 });
    expect(r.chanceBBetter).toBeGreaterThan(0.99);
    expect(r.diff.mid).toBeCloseTo(0.06, 2);
    expect(r.diff.low).toBeGreaterThan(0);
  });
  it("is ~50/50 for identical data, and deterministic", () => {
    const a = compareConversion({ visits: 500, conversions: 200 }, { visits: 500, conversions: 200 });
    expect(a.chanceBBetter).toBeGreaterThan(0.45);
    expect(a.chanceBBetter).toBeLessThan(0.55);
    expect(compareConversion({ visits: 500, conversions: 200 }, { visits: 500, conversions: 200 })).toEqual(a);
  });
  it("matches the analytic answer for a moderate case", () => {
    // Normal approx: diff .03, se = sqrt(.4*.6/1000 + .43*.57/1000) ≈ .0221 → P ≈ Φ(1.36) ≈ .913
    const r = compareConversion({ visits: 1000, conversions: 400 }, { visits: 1000, conversions: 430 });
    expect(r.chanceBBetter).toBeGreaterThan(0.88);
    expect(r.chanceBBetter).toBeLessThan(0.94);
  });
});

describe("compareRevenue", () => {
  it("compares mean revenue per visit including zeros", () => {
    // A: 1000 visits, 400 sales at $29 → $11.60/visit. B: 1000 visits, 370 sales at $39 → $14.43/visit.
    const mk = (visits: number, sales: number, price: number) => ({ visits, sumCents: sales * price, sumSqCents: sales * price * price });
    const r = compareRevenue(mk(1000, 400, 2900), mk(1000, 370, 3900));
    expect(r.perVisitA).toBe(1160);
    expect(r.perVisitB).toBe(1443);
    expect(r.chanceBBetter).toBeGreaterThan(0.95);
  });
});

describe("verdicts", () => {
  const base = { visitsA: 1500, visitsB: 1500, daysRunning: 14, dailyPerVariant: 100 };
  it("says too early with little data", () => {
    const v = conversionVerdict({ ...base, visitsA: 40, visitsB: 40, daysRunning: 2, result: compareConversion({ visits: 40, conversions: 16 }, { visits: 40, conversions: 22 }) });
    expect(v.status).toBe("too_early");
    expect(v.shipB).toBe(false);
  });
  it("ships B only when very likely better", () => {
    const v = conversionVerdict({ ...base, result: compareConversion({ visits: 1500, conversions: 600 }, { visits: 1500, conversions: 700 }) });
    expect(v.status).toBe("b_better");
    expect(v.shipB).toBe(true);
    expect(v.detail).toMatch(/sales per 100 visitors/);
    expect(v.detail).not.toMatch(/p-value|significan|confidence interval/i);
  });
  it("calls practically-equal versions a tie", () => {
    const v = conversionVerdict({ ...base, visitsA: 40000, visitsB: 40000, result: compareConversion({ visits: 40000, conversions: 16000 }, { visits: 40000, conversions: 16040 }) });
    expect(v.status).toBe("no_difference");
  });
  it("estimates days left when leaning", () => {
    const v = conversionVerdict({ ...base, visitsA: 300, visitsB: 300, result: compareConversion({ visits: 300, conversions: 120 }, { visits: 300, conversions: 135 }) });
    expect(["leaning_b", "keep_going"]).toContain(v.status);
    expect(v.daysLeft).toBeGreaterThan(0);
  });
});

describe("helpers", () => {
  it("normCdf", () => {
    expect(normCdf(0)).toBeCloseTo(0.5, 5);
    expect(normCdf(1.96)).toBeCloseTo(0.975, 3);
  });
  it("visitsNeeded grows as the effect shrinks", () => {
    expect(visitsNeeded(0.4, 0.05)).toBeLessThan(visitsNeeded(0.4, 0.02));
    expect(visitsNeeded(0.4, 0)).toBe(Infinity);
  });
  it("flags broken splits only when clearly broken", () => {
    expect(splitLooksBroken(1000, 1040, 50, 50)).toBe(false);
    expect(splitLooksBroken(1000, 1300, 50, 50)).toBe(true);
    expect(splitLooksBroken(900, 100, 90, 10)).toBe(false);
  });
});
