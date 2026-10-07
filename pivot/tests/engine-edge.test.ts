/**
 * Edge cases from real-world uploads: thin data, losses, gaps and zero churn.
 * Nothing here may reach the UI as NaN or with the wrong sign.
 */
import { describe, expect, it } from "vitest";
import { analyze } from "@/lib/engine/analyze";
import { simulate } from "@/lib/engine/simulate";
import type { BusinessData, Series } from "@/lib/engine/types";

const months = (n: number) => Array.from({ length: n }, (_, i) => `2026-${String(i + 1).padStart(2, "0")}`);
const data = (periods: string[], metrics: BusinessData["metrics"], extra: Partial<BusinessData> = {}): BusinessData => ({
  company: { name: "Acme Inc.", currency: "USD", industry: "ecommerce" },
  periods,
  metrics,
  products: {},
  channels: {},
  segments: {},
  ...extra,
});
const noNaN = (v: unknown) => expect(JSON.stringify(v)).not.toMatch(/NaN|Infinity|null%/);

describe("thin data", () => {
  it("scores a single month without NaN", () => {
    const a = analyze(data(["2026-09"], { revenue: [100_000], customers: [1_000] }));
    noNaN(a.health);
    noNaN(a.kpis);
    expect(a.health.missing.map((m) => m.label)).toContain("Revenue");
  });
});

describe("profit from a loss", () => {
  const p = months(6);
  const run = (profit: Series) => analyze(data(p, { revenue: [50e3, 50e3, 50e3, 50e3, 50e3, 50e3], profit })).kpis.find((k) => k.key === "profit")!;

  it("shows a loss turning into a profit as an improvement", () => {
    const k = run([1e3, 1e3, 1e3, 1e3, -10e3, 5e3]);
    expect(k.good).toBe(true);
    expect(k.change).toBeGreaterThan(0);
    expect(k.changeDisplay).toBe("+$15K");
    expect(k.explain.what).toMatch(/from a \$10K loss/);
  });

  it("shows a deepening loss as worse", () => {
    const k = run([1e3, 1e3, 1e3, 1e3, -10e3, -20e3]);
    expect(k.good).toBe(false);
    expect(k.change).toBeLessThan(0);
    expect(k.changeDisplay).toBe("−$10K");
    expect(k.explain.what).toMatch(/^\$20K loss/);
  });

  it("keeps percentages for ordinary months", () => {
    expect(run([1e3, 1e3, 1e3, 1e3, 10e3, 11e3]).changeDisplay).toBe("+10.0%");
  });
});

describe("cost gaps", () => {
  it("leaves profit unknown for a month whose costs are missing", () => {
    const p = months(6);
    const a = analyze(data(p, { revenue: [50e3, 51e3, 52e3, 53e3, 54e3, 55e3], opex: [20e3, 20e3, 20e3, 20e3, 20e3, 20e3], cogs: [20e3, 20.4e3, 20.8e3, 21.2e3, 21.6e3, null] }));
    // September's COGS isn't in yet: no $35K "profit" spike.
    expect(a.kpis.find((k) => k.key === "profit")).toBeUndefined();
  });
});

describe("What-If baseline", () => {
  it("never infers negative operating costs from revenue and COGS alone", () => {
    const p = months(6);
    const a = analyze(data(p, { revenue: [50e3, 51e3, 52e3, 53e3, 54e3, 55e3], cogs: [20e3, 20.4e3, 20.8e3, 21.2e3, 21.6e3, 22e3] }));
    const b = a.baseline!;
    expect(b.opex).toBeGreaterThan(0);
    const cut = simulate(b, "costs", 10);
    expect(cut.deltas.profit).toBeGreaterThan(0);
    expect(cut.summary).not.toMatch(/saves −/);
    expect(simulate(b, "newProduct", 6).deltas.profit).toBeLessThan(simulate(b, "newProduct", 6).deltas.revenue);
  });

  it("uses the remainder of real profit as operating costs when every other cost is known", () => {
    const p = months(6);
    const a = analyze(data(p, { revenue: [100e3, 100e3, 100e3, 100e3, 100e3, 100e3], cogs: Array(6).fill(40e3), marketingSpend: Array(6).fill(10e3), profit: Array(6).fill(20e3) }));
    expect(a.baseline!.opex).toBe(30e3);
  });

  it("changes nothing at a 0% price change, whatever reported profit includes", () => {
    const p = months(6);
    const a = analyze(data(p, { revenue: Array(6).fill(100e3), cogs: Array(6).fill(40e3), opex: Array(6).fill(30e3), marketingSpend: Array(6).fill(10e3), profit: Array(6).fill(12e3) }));
    expect(simulate(a.baseline!, "price", 0).deltas.profit).toBe(0);
  });

  it("handles 100% retention", () => {
    const p = months(6);
    const a = analyze(
      data(p, {
        revenue: [50e3, 51e3, 52e3, 53e3, 54e3, 55e3],
        customers: [100, 102, 104, 106, 108, 110],
        churnedCustomers: [0, 0, 0, 0, 0, 0],
        newCustomers: [2, 2, 2, 2, 2, 2],
        marketingSpend: Array(6).fill(5e3),
      }),
    );
    expect(a.baseline!.retention).toBe(1);
    for (const kind of ["marketing", "costs", "price"] as const) {
      const s = simulate(a.baseline!, kind, kind === "costs" ? 20 : 20);
      noNaN(s);
    }
  });

  it("doesn't talk about customers it can't see", () => {
    const p = months(6);
    const a = analyze(data(p, { revenue: [100e3, 104e3, 99e3, 103e3, 108e3, 110e3] }));
    const s = simulate(a.baseline!, "price", -10);
    noNaN(s);
    expect(s.summary).not.toMatch(/customers/);
  });
});

describe("segments", () => {
  const p = months(4);
  const seg = (customers: number, churned: Series) => ({ customers: Array(4).fill(customers), churned });

  it("only names a churn driver that's leaving faster than everyone else", () => {
    // Enterprise churn doubled (1% -> 2%) but SMB still churns 5%.
    const a = analyze(
      data(p, { revenue: Array(4).fill(100e3), customers: Array(4).fill(1_000), churnedCustomers: [30, 30, 30, 35], retention: [0.97, 0.97, 0.97, 0.965] }, {
        segments: { Enterprise: seg(500, [5, 5, 5, 10]), SMB: seg(500, [25, 25, 25, 25]) },
      }),
    );
    const text = JSON.stringify([a.kpis, a.insights, a.opportunities, a.recommendations]);
    expect(text).not.toMatch(/0\.\dx faster/);
    // And never "win back" and "raise prices on" the same customers.
    const keys = a.opportunities.map((o) => o.key);
    if (keys.includes("segment-winback") && keys.includes("premium-pricing")) {
      const win = a.opportunities.find((o) => o.key === "segment-winback")!;
      const prem = a.opportunities.find((o) => o.key === "premium-pricing")!;
      expect(prem.title.toLowerCase()).not.toContain(win.title.split(" ").at(-2)!.toLowerCase());
    }
  });

  it("describes a shrinking customer base as shrinking", () => {
    const p6 = months(6);
    const a = analyze(data(p6, { revenue: Array(6).fill(100e3), customers: [1100, 1080, 1060, 1040, 1020, 1000], retention: [0.9, 0.9, 0.9, 0.9, 0.9, 0.88] }));
    const dim = a.health.dimensions.find((d) => d.key === "customers")!;
    expect(dim.reason).not.toMatch(/Up −|Up -/);
    expect(dim.reason).toMatch(/^Down/);
  });
});

describe("plan insight limit", () => {
  it("keeps the top insights in full and only the headline of the rest", async () => {
    const { limitInsights } = await import("@/lib/billing/limit-insights");
    const { northstarData } = await import("@/lib/demo/northstar");
    const a = analyze(northstarData(new Date("2026-10-06T12:00:00Z")));
    expect(a.insights.length).toBeGreaterThan(1);
    const limited = limitInsights(a, 1);
    expect(limited.insights[0]).toEqual(a.insights[0]);
    for (const i of limited.insights.slice(1)) {
      expect(i.locked).toBe(true);
      expect(i.title).toBeTruthy();
      expect(i.what).toBeTruthy();
      expect(i.why + i.soWhat + i.nowWhat).toBe("");
      expect(i.evidence).toEqual({});
    }
    expect(limitInsights(a, null)).toBe(a);
  });
});

describe("Ask PIVOT with locked insights", () => {
  it("never answers with a blank, and points to Pro instead of the locked explanation", async () => {
    const { limitInsights } = await import("@/lib/billing/limit-insights");
    const { northstarData } = await import("@/lib/demo/northstar");
    const { answerLocally } = await import("@/lib/engine/ask");
    const a = analyze(northstarData(new Date("2026-10-06T12:00:00Z")));
    const locked = limitInsights(a, 0);
    for (const q of ["Which segments are doing worst?", "What is hurting our growth?", "How is marketing doing?", "Which product is performing best?"]) {
      const { answer } = answerLocally(q, locked);
      expect(answer.trim().length).toBeGreaterThan(20);
      expect(answer).not.toMatch(/undefined|null/);
      for (const i of a.insights) expect(answer).not.toContain(i.why);
    }
    expect(answerLocally("Which segments are doing worst?", locked).answer).toMatch(/on Pro/);
  });
});
