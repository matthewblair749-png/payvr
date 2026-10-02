/**
 * Morning brief + Ask lumen (real Postgres; Claude is a scripted fake).
 */
import "dotenv/config";
import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { localDayRange, localDate, addDays } from "@/lib/zoned";
import { db } from "@/server/db";
import { ask, periodFor, quickAnswer, type AskEvent } from "@/server/home/ask";
import { getBrief, sentenceIsGrounded, templateSentence, type BriefFacts } from "@/server/home/brief";
import { __setAnthropicForTests } from "@/server/research/agent";

const RUN = Math.random().toString(36).slice(2, 8);
const TZ = "America/New_York";
const userIds: string[] = [];
let merchantId = "";
let emptyMerchantId = "";

async function newMerchant(tag: string) {
  const user = await db.user.create({ data: { email: `ba-${tag}-${RUN}@lumen.test` } });
  userIds.push(user.id);
  return (await db.merchant.create({ data: { userId: user.id, name: tag } })).id;
}

beforeAll(async () => {
  merchantId = await newMerchant("shop");
  emptyMerchantId = await newMerchant("empty");
  const yday = addDays(localDate(TZ), -1);
  const at = (ymd: string) => new Date(localDayRange(TZ, ymd).from.getTime() + 15 * 3_600_000); // 3pm local
  await db.order.createMany({
    data: [
      { merchantId, amountCents: 6000, currency: "usd", status: "SUCCEEDED", createdAt: at(yday) },
      { merchantId, amountCents: 6000, currency: "usd", status: "SUCCEEDED", createdAt: at(yday) },
      { merchantId, amountCents: 10000, currency: "usd", status: "SUCCEEDED", createdAt: at(addDays(yday, -7)) },
    ],
  });
});

afterEach(() => __setAnthropicForTests(null));
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

const facts = (over: Partial<BriefFacts> = {}): BriefFacts => ({
  day: "2026-10-01",
  timeZone: TZ,
  currency: "usd",
  yesterday: { date: "2026-09-30", weekday: "Wednesday", revenueCents: 124000, orders: 20, compareRevenueCents: 110700 },
  leak: {
    to: "details",
    fromLabel: "Start",
    toLabel: "Details",
    dropRate: 0.4,
    who: "mobile shoppers",
    segmentRate: 0.52,
    othersRate: 0.22,
    lastField: "shipping",
    perWeekCents: 30000,
    basis: "previous",
    checkout: { id: "c1", name: "Mugs" },
  },
  suggestion: null,
  ...over,
});

describe("brief sentence", () => {
  it("templates yesterday and the opportunity in the brief's tone", () => {
    expect(templateSentence(facts())).toBe(
      "You made $1,240 yesterday, up 12% on last Wednesday. Mobile shoppers are dropping off at shipping address, and fixing it could add about $300 a week.",
    );
    expect(templateSentence(facts({ yesterday: { ...facts().yesterday, orders: 0, revenueCents: 0 }, leak: null }))).toBe("No sales yesterday (Wednesday).");
  });

  it("only accepts sentences whose dollar amounts come from the facts", () => {
    expect(sentenceIsGrounded("You made $1,240 yesterday; fixing shipping could add about $300 a week.", facts())).toBe(true);
    expect(sentenceIsGrounded("You made $1,240 yesterday and could add $5,000.", facts())).toBe(false);
  });
});

describe("getBrief", () => {
  it("returns nothing before the first sale", async () => {
    expect(await getBrief(emptyMerchantId, "usd", TZ)).toBeNull();
  });

  it("greets the first sales on day one instead of 'no sales yesterday', without storing it", async () => {
    const id = await newMerchant("dayone");
    await db.order.create({ data: { merchantId: id, amountCents: 4800, currency: "usd", status: "SUCCEEDED", createdAt: new Date() } });
    expect((await getBrief(id, "usd", TZ))!.sentence).toBe("Your first sale came in today: $48. From tomorrow, this brief compares each day with the one before.");
    await db.order.create({ data: { merchantId: id, amountCents: 5200, currency: "usd", status: "SUCCEEDED", createdAt: new Date() } });
    expect((await getBrief(id, "usd", TZ))!.sentence).toMatch(/^Your first 2 sales came in today: \$100 in all\./);
    expect(await db.morningBrief.count({ where: { merchantId: id } })).toBe(0);
  });

  it("uses the merchant's local yesterday, writes once per day, and keeps it", async () => {
    const b = await getBrief(merchantId, "usd", TZ);
    expect(b!.source).toBe("template"); // no AI configured in tests
    expect(b!.facts.yesterday).toMatchObject({ revenueCents: 12000, orders: 2, compareRevenueCents: 10000 });
    expect(b!.sentence).toBe("You made $120 yesterday, up 20% on last " + b!.facts.yesterday.weekday + ".");
    expect(b!.actions).toHaveLength(2);
    await db.order.create({ data: { merchantId, amountCents: 99900, currency: "usd", status: "SUCCEEDED", createdAt: new Date() } });
    expect((await getBrief(merchantId, "usd", TZ))!.sentence).toBe(b!.sentence); // stored, not rewritten
  });

  it("uses Claude's sentence only when it's grounded in the facts", async () => {
    await db.morningBrief.deleteMany({ where: { merchantId } });
    let reply = "Yesterday brought in $120, up from $100 last week.";
    const calls: Record<string, unknown>[] = [];
    __setAnthropicForTests({
      beta: {
        messages: {
          async parse(params: Record<string, unknown>) {
            calls.push(params);
            return { stop_reason: "end_turn", parsed_output: { sentence: reply } };
          },
        },
      },
    } as unknown as Anthropic);
    const ok = await getBrief(merchantId, "usd", TZ);
    expect(ok).toMatchObject({ source: "ai", sentence: reply });
    expect(calls[0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default", betas: ["server-side-fallback-2026-07-01"] });

    await db.morningBrief.deleteMany({ where: { merchantId } });
    reply = "Yesterday brought in $4,000!"; // invented number
    expect(await getBrief(merchantId, "usd", TZ)).toMatchObject({ source: "template" });
  });
});

describe("Ask lumen", () => {
  it("reads the period from the question", () => {
    const now = new Date("2026-10-01T12:00:00Z");
    expect(periodFor("sales this week?", 30, now)).toMatchObject({ from: "2026-09-25", to: "2026-10-01", days: 7 });
    expect(periodFor("what did I make yesterday", 30, now)).toMatchObject({ from: "2026-09-30", to: "2026-09-30", days: 1 });
    expect(periodFor("conversion by device", 90, now)).toMatchObject({ days: 90 });
    expect(periodFor("revenue this month", 7, now)).toMatchObject({ days: 30 });
  });

  it("answers common questions from the demo data without AI, showing its working", async () => {
    const demo = await db.merchant.findFirst({ where: { user: { email: "demo@lumen.test" } } });
    if (!demo) return;
    const ctx = { merchantId: demo.id, currency: "usd" };
    const noop = () => {};
    const drop = await quickAnswer(ctx, "Where do people drop off?", 30, noop);
    expect(drop!.answer).toMatch(/biggest leak is before \*\*Details\*\*, mostly at shipping address/);
    expect(drop!.chart!.points.map((p) => p.label)).toEqual(["Visit", "Start", "Details", "Payment", "Paid"]);
    expect(drop!.steps[0]).toMatchObject({ label: "Walking the checkout funnel", input: { days: 30 } });
    expect(drop!.steps[0].logic).toMatch(/furthest step/);
    expect((await quickAnswer(ctx, "mobile vs desktop?", 30, noop))!.chart!.unit).toBe("percent");
    expect((await quickAnswer(ctx, "How much did I make?", 7, noop))!.answer).toMatch(/You made \*\*\$[\d,]+\*\* in the last 7 days/);
    expect(await quickAnswer(ctx, "Write me a poem", 30, noop)).toBeNull();
    // The question's period beats the page's range.
    const week = await quickAnswer(ctx, "How much did I make this week?", 30, noop);
    expect(week!.answer).toMatch(/in the last 7 days/);
    expect(week!.chart!.points).toHaveLength(7);
  });

  it("runs Claude with tools, records the real queries, and saves the question", async () => {
    let i = 0;
    const script = [
      { role: "assistant", stop_reason: "tool_use", content: [{ type: "tool_use", id: "t1", name: "get_traffic_sources", input: { from: "2026-09-01", to: "2026-09-30" } }] },
      {
        role: "assistant",
        stop_reason: "tool_use",
        content: [
          {
            type: "tool_use",
            id: "t2",
            name: "give_answer",
            input: { answer: "Most come from **Instagram**.", chart: { kind: "bar", title: "Visits", unit: "count", points: [{ label: "Instagram", value: 3 }], highlight: "Instagram" }, next_step: "start_proposed_test" },
          },
        ],
      },
    ];
    const seen: Record<string, unknown>[] = [];
    __setAnthropicForTests({
      beta: { messages: { stream: (p: Record<string, unknown>) => (seen.push(structuredClone(p)), { finalMessage: async () => script[i++] }) } },
    } as unknown as Anthropic);
    const events: AskEvent[] = [];
    const a = await ask({ merchantId, question: "Where do my shoppers come from?", days: 30, emit: (e) => events.push(e) });
    expect(a).toMatchObject({ source: "ai", answer: "Most come from **Instagram**.", chart: { highlight: "Instagram" } });
    // "Start a test" needs a real stored proposal; none was made, so no action.
    expect(a.action).toBeNull();
    expect(a.steps).toHaveLength(1);
    expect(a.steps[0]).toMatchObject({ label: "Checking where shoppers come from", input: { from: "2026-09-01", to: "2026-09-30" } });
    expect(events.map((e) => e.type)).toEqual(["step", "answer"]);
    const tools = (seen[0].tools as { name: string; strict?: boolean }[]).map((t) => t.name);
    expect(tools).toContain("give_answer");
    expect((seen[0].tools as { name: string; strict?: boolean }[]).find((t) => t.name === "give_answer")!.strict).toBe(true);
    expect(seen[0]).toMatchObject({ model: "claude-opus-5-5", fallbacks: "default" });
    const thread = await db.researchThread.findUniqueOrThrow({ where: { id: a.threadId! }, include: { messages: true } });
    expect(thread.title).toBe("Where do my shoppers come from?");
    expect(thread.messages.length).toBe(5); // question, tool call, results, answer call, ack
  });

  it("nudges once when Claude answers in plain text", async () => {
    let i = 0;
    const script = [
      { role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "Instagram." }] },
      { role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "Mostly Instagram." }] },
    ];
    __setAnthropicForTests({ beta: { messages: { stream: () => ({ finalMessage: async () => script[i++] }) } } } as unknown as Anthropic);
    const a = await ask({ merchantId, question: "Sources?", days: 30, emit: () => {} });
    expect(a.answer).toBe("Mostly Instagram.");
    expect(i).toBe(2);
  });
});
