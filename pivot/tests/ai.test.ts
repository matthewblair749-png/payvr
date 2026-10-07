import { describe, expect, it } from "vitest";
import { getDemo } from "@/lib/demo";
import { buildAIFacts, ungroundedNumbers } from "@/server/ai/facts";
import { localProvider } from "@/server/ai/local";
import { analyze } from "@/lib/engine/analyze";

const { analysis, data } = getDemo(new Date("2026-10-06T12:00:00Z"));
const facts = buildAIFacts(analysis, data);

describe("AI grounding", () => {
  it("accepts text whose numbers all come from the analysis", () => {
    expect(ungroundedNumbers("Revenue grew 12.4% to $2.84M while retention fell to 91.4%. Improve retention, worth about $5M.", facts)).toEqual([]);
  });
  it("flags invented numbers", () => {
    expect(ungroundedNumbers("Revenue will hit $9.7M next quarter, up 38%.", facts)).toEqual(["$9.7M", "38%"]);
  });
  it("allows small counts and years", () => {
    expect(ungroundedNumbers("Down 3 months in a row since 2026.", facts)).toEqual([]);
  });
  it("tells the model what data doesn't exist", () => {
    expect(facts.data_available.not_available).toContain("competitors");
    expect(JSON.stringify(facts)).not.toMatch(/passwordHash|email/);
  });
});

describe("local provider", () => {
  it("streams an answer built from the analysis", async () => {
    let text = "";
    for await (const piece of localProvider.answer({ question: "What is hurting our growth?", history: [], facts, analysis })) text += piece;
    expect(text).toMatch(/retention is declining/i);
    expect(await localProvider.summarize(facts)).toBeNull();
  });
});

describe("AI grounding: direction, units and years", () => {
  it("rejects a figure whose direction contradicts the facts", () => {
    expect(ungroundedNumbers("Revenue fell 12.4% to $2.84M.", facts)).toEqual(["12.4%"]);
    expect(ungroundedNumbers("Revenue grew 12.4% to $2.84M.", facts)).toEqual([]);
    expect(ungroundedNumbers("Revenue was −12.4%.", facts)).toEqual(["−12.4%"]);
  });
  it("keeps percent and points apart", () => {
    expect(ungroundedNumbers("Retention fell 2.1 pts.", facts)).toEqual([]);
    expect(ungroundedNumbers("Retention fell 2.1%.", facts)).toEqual(["2.1%"]);
  });
  it("only treats bare 4-digit numbers as years", () => {
    expect(ungroundedNumbers("We'll add $2,050 and 2,099 customers.", facts)).toEqual(["$2,050", "2,099"]);
  });
});

describe("AI facts", () => {
  it("leaves a month without revenue empty instead of $0, and never counts actuals as forecast", () => {
    const gap = { ...data, metrics: { ...data.metrics, revenue: data.metrics.revenue!.map((v, i, a) => (i === a.length - 3 ? null : v)) } };
    const f = buildAIFacts(analyze(gap), gap);
    const last = f.revenue_by_month.at(-1)!;
    expect(last.month).toBe("September 2026");
    expect(last.revenue).toBe("$2.84M");
    expect(f.revenue_by_month.at(-3)!.revenue).toBeNull();
    expect(f.revenue_forecast_next_3_months).toHaveLength(3);
    expect(f.revenue_forecast_next_3_months).not.toContain("$2.84M");
  });
});

describe("AI grounding: contrast sentences", () => {
  it("reads the direction from the figure's own clause", () => {
    for (const ok of [
      "Despite falling retention, revenue grew 12.4% to $2.84M.",
      "Retention is down, but revenue grew 12.4%.",
      "Despite lower margins, profit rose 6.2% to $684K.",
      "With retention down, profit grew 6.2%.",
    ]) expect(ungroundedNumbers(ok, facts)).toEqual([]);
    expect(ungroundedNumbers("Retention is up, but revenue fell 12.4%.", facts)).toEqual(["12.4%"]);
  });
});
