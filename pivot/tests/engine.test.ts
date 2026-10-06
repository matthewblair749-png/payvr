import { describe, expect, it } from "vitest";
import { northstarCsv, northstarData } from "@/lib/demo/northstar";
import { analyze } from "@/lib/engine/analyze";
import { answerLocally } from "@/lib/engine/ask";
import { buildReport, dataAsOf } from "@/lib/engine/report";
import { pivotScore, scoreLabel } from "@/lib/engine/score";
import { PRESETS, simulate } from "@/lib/engine/simulate";
import type { BusinessData } from "@/lib/engine/types";
import { money, pctDelta } from "@/lib/format";

const NOW = new Date("2026-10-06T12:00:00Z");
const demo = northstarData(NOW);
const a = analyze(demo);
const kpi = (k: string) => a.kpis.find((x) => x.key === k)!;

describe("Northstar demo analysis", () => {
  it("ends at the last complete month", () => {
    expect(a.period).toBe("2026-09");
    expect(a.coverage.months).toBe(24);
  });

  it("produces the headline KPIs", () => {
    expect(kpi("revenue").display).toBe("$2.84M");
    expect(kpi("revenue").changeDisplay).toBe("+12.4%");
    expect(kpi("customers").display).toBe("48,291");
    expect(kpi("customers").changeDisplay).toBe("+8.7%");
    expect(kpi("profit").display).toBe("$684K");
    expect(kpi("profit").changeDisplay).toBe("+6.2%");
    expect(kpi("retention").display).toBe("91.4%");
    expect(kpi("retention").changeDisplay).toBe("−2.1 pts");
    expect(kpi("score").display).toBe("87/100");
  });

  it("scores business health from the data", () => {
    const dims = Object.fromEntries(a.health.dimensions.map((d) => [d.key, d.score]));
    expect(dims).toEqual({ revenue: 92, customers: 88, retention: 79, operations: 91, marketing: 84, products: 89 });
    expect(a.health.score).toBe(87);
  });

  it("lists what's changing", () => {
    expect(a.changes.map((c) => c.title)).toEqual(["Revenue is accelerating", "Customer retention is declining", "Product B is gaining momentum"]);
  });

  it("finds the three insights, in order, with all four answers", () => {
    expect(a.insights.map((i) => [i.severity, i.title])).toEqual([
      ["ACTION", "Customer retention is declining."],
      ["OPPORTUNITY", "Product B demand is accelerating."],
      ["WATCH", "Marketing costs increased."],
    ]);
    for (const i of a.insights) for (const part of [i.what, i.why, i.soWhat, i.nowWhat]) expect(part.length).toBeGreaterThan(20);
    expect(a.insights[0].why).toMatch(/price-sensitive segment are leaving at a higher rate/);
    expect(a.insights[1].what).toBe("Demand for Product B increased 31% over the last 60 days.");
    expect(a.insights[2].what).toMatch(/^Customer acquisition cost increased 18%/);
  });

  it("scores the top opportunity like the brief", () => {
    const top = a.opportunities[0];
    expect(top.title).toBe("Expand Product B into a new customer segment");
    expect(top.score).toBe(91);
    expect(top.scoreLabel).toBe("Excellent opportunity");
    expect([top.impact, top.effort, top.risk]).toEqual(["High", "Medium", "Low"]);
    expect(top.factors).toMatchObject({ impact: 94, demand: 91, cost: 78, risk: 23, difficulty: 42, confidence: 88 });
  });

  it("ranks recommendations", () => {
    expect(a.recommendations.slice(0, 3).map((r) => [r.title, r.impact, r.difficulty, r.risk])).toEqual([
      ["Improve customer retention", "Very high", "Medium", "Low"],
      ["Increase investment in Product B", "High", "Medium", "Medium"],
      ["Reduce spending in Channel C", "Medium", "Low", "Low"],
    ]);
    expect(a.recommendations[0].reasoning).toBe(
      "Retention has declined consistently for three consecutive periods while acquisition costs are increasing.",
    );
  });

  it("simulates a 10% price cut like the brief", () => {
    const s = simulate(a.baseline!, "price", -10);
    expect(money(s.deltas.revenue)).toBe("$184K");
    expect(Math.round(s.deltas.profit / 1000)).toBe(41);
    expect(pctDelta(s.deltas.customersPct)).toBe("+8.2%");
    expect(s.deltas.marketSharePts!.toFixed(1)).toBe("3.4");
    expect(s.risk).toBe("Medium");
    expect(s.confidence).toBe(76);
    expect(money(s.projected.revenue)).toBe("$3.02M");
    expect(money(s.projected.profit)).toBe("$725K");
  });

  it("runs every preset scenario with stated assumptions", () => {
    for (const p of PRESETS) {
      const s = simulate(a.baseline!, p.kind, p.value);
      expect(Number.isFinite(s.projected.revenue)).toBe(true);
      expect(s.assumptions.at(-1)).toMatch(/not guaranteed outcomes/);
      expect(s.confidence).toBeGreaterThanOrEqual(30);
    }
    // Raising prices on price-sensitive demand loses money.
    expect(simulate(a.baseline!, "price", 10).deltas.profit).toBeLessThan(0);
    // Out-of-range input is clamped, not trusted.
    expect(simulate(a.baseline!, "price", -500).value).toBe(-30);
  });

  it("keeps the generated data internally consistent", () => {
    const m = demo.metrics;
    for (let i = 1; i < demo.periods.length; i++) {
      expect(m.customers![i]).toBe(m.customers![i - 1]! - m.churnedCustomers![i]! + m.newCustomers![i]!);
      const prodSum = Object.values(demo.products).reduce((s, p) => s + p.revenue[i]!, 0);
      expect(prodSum).toBe(m.revenue![i]);
      const spend = Object.values(demo.channels).reduce((s, c) => s + (c.spend[i] as number), 0);
      expect(spend).toBe(m.marketingSpend![i]);
    }
    expect(northstarCsv(NOW).split("\n")[0]).toMatch(/^month,revenue,orders,customers/);
  });
});

describe("PIVOT Score", () => {
  it("doesn't penalize low risk or moderate difficulty", () => {
    expect(pivotScore({ impact: 94, revenue: 95, demand: 91, market: 90, confidence: 88, cost: 78, risk: 23, difficulty: 42 })).toBe(91);
  });
  it("penalizes high risk and difficulty", () => {
    const base = { impact: 80, revenue: 80, demand: 80, market: 80, confidence: 80, cost: 80, risk: 20, difficulty: 30 };
    expect(pivotScore({ ...base, risk: 80 })).toBeLessThan(pivotScore(base) - 15);
    expect(pivotScore({ ...base, difficulty: 90 })).toBeLessThan(pivotScore(base) - 10);
  });
  it("labels scores", () => {
    expect(scoreLabel(91)).toBe("Excellent opportunity");
    expect(scoreLabel(72)).toBe("Strong opportunity");
    expect(scoreLabel(40)).toBe("Weak opportunity");
  });
});

describe("Degrades with less data", () => {
  const revenueOnly: BusinessData = {
    company: { name: "Acme Inc.", currency: "USD" },
    periods: ["2026-05", "2026-06", "2026-07", "2026-08", "2026-09"],
    metrics: { revenue: [100_000, 104_000, 99_000, 103_000, 108_000] },
    products: {},
    channels: {},
    segments: {},
  };
  const r = analyze(revenueOnly);

  it("still analyzes revenue, and lists what's missing", () => {
    expect(r.kpis.map((k) => k.key)).toEqual(["revenue", "score"]);
    expect(r.health.dimensions.map((d) => d.key)).toEqual(["revenue"]);
    expect(r.health.missing.map((m) => m.label)).toEqual(["Customers", "Retention", "Operations", "Marketing", "Products"]);
  });

  it("marks simulator inputs it had to estimate", () => {
    expect(r.baseline!.estimated.length).toBeGreaterThan(0);
    const s = simulate(r.baseline!, "price", -10);
    expect(s.assumptions.some((x) => x.startsWith("Cost of goods estimated"))).toBe(true);
  });

  it("refuses to guess about data it doesn't have", () => {
    expect(answerLocally("Which product is performing best?", r).answer).toMatch(/doesn't break revenue down by product/);
    expect(answerLocally("How do we compare to competitors?", r).answer).toMatch(/doesn't include competitors/);
  });

  it("handles an empty workspace", () => {
    const empty = analyze({ ...revenueOnly, periods: [], metrics: {} });
    expect(empty.kpis).toEqual([]);
    expect(empty.baseline).toBeNull();
    expect(answerLocally("What should we focus on?", empty).answer).toMatch(/no business data/);
  });
});

describe("Ask PIVOT (built-in)", () => {
  it("answers the example questions from the data", () => {
    expect(answerLocally("What is hurting our growth?", a).answer).toMatch(/retention is declining/i);
    expect(answerLocally("Which product is performing best?", a).answer).toMatch(/Product B/);
    expect(answerLocally("What should we focus on?", a).answer).toMatch(/Improve customer retention/);
    expect(answerLocally("Why did revenue change?", a).answer).toMatch(/8\.7% more customers/);
    expect(answerLocally("Show me our biggest opportunities.", a).answer).toMatch(/PIVOT Score 91/);
  });
});

describe("Reports", () => {
  it("builds a report for a past month from data as of that month", () => {
    expect(dataAsOf(demo, "2026-06").periods.at(-1)).toBe("2026-06");
    const { content } = buildReport(demo, "2026-09");
    expect(content.period).toBe("2026-09");
    expect(content.score.value).toBe(87);
    expect(content.actions[0].title).toBe("Improve customer retention");
    expect(content.revenue.products[0].name).toBe("Product A");
    const past = buildReport(demo, "2026-06").content;
    expect(past.period).toBe("2026-06");
    expect(past.kpis.find((k) => k.key === "revenue")!.display).not.toBe("$2.84M");
  });
});
