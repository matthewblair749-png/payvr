import { describe, expect, it } from "vitest";
import { getDemo } from "@/lib/demo";
import { buildAIFacts, ungroundedNumbers } from "@/server/ai/facts";
import { localProvider } from "@/server/ai/local";

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
