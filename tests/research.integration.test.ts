/**
 * Research Assistant + proposals + insights (real Postgres, fake Claude).
 */
import "dotenv/config";
import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { DEMO_CONFIG } from "@/lib/checkout/defaults";
import { db } from "@/server/db";
import { resolveCheckout } from "@/server/dal/public-checkout";
import { __setAnthropicForTests, runResearchTurn, threadForDisplay, type ResearchEvent } from "@/server/research/agent";
import { generateInsights, listInsights } from "@/server/research/insights";
import { applyChanges, createProposal, startProposal } from "@/server/research/proposals";

const RUN = Math.random().toString(36).slice(2, 8);
let userId = "";
let merchantId = "";
let pageId = "";

beforeAll(async () => {
  const user = await db.user.create({ data: { email: `rs-${RUN}@lumen.test` } });
  userId = user.id;
  merchantId = (await db.merchant.create({ data: { userId, name: "Moth Press" } })).id;
  const product = await db.product.create({ data: { merchantId, name: "Riso print", priceCents: 2900 } });
  const page = await db.checkoutPage.create({ data: { merchantId, productId: product.id, name: "Prints", slug: `rs-${RUN}`, draftConfig: DEMO_CONFIG } });
  const v = await db.checkoutPageVersion.create({ data: { checkoutPageId: page.id, number: 1, config: DEMO_CONFIG } });
  await db.checkoutPage.update({ where: { id: page.id }, data: { status: "PUBLISHED", publishedVersionId: v.id } });
  pageId = page.id;
});

afterAll(async () => {
  __setAnthropicForTests(null);
  await db.user.delete({ where: { id: userId } });
  await db.$disconnect();
});

// ---------------------------------------------------------------------------
describe("applyChanges", () => {
  it("applies each operation and keeps the config valid", () => {
    const { config, priceCents } = applyChanges(DEMO_CONFIG, [
      { op: "hide_block", block_type: "coupon" },
      { op: "move_block", block_type: "testimonial", position: "top" },
      { op: "set_price", price_cents: 3900 },
    ]);
    expect(config.blocks.find((b) => b.type === "coupon")?.hidden).toBe(true);
    expect(config.blocks[0].type).toBe("testimonial");
    expect(priceCents).toBe(3900);
    expect(config.blocks.filter((b) => b.type === "payment")).toHaveLength(1);
  });
  it("adds a block that doesn't exist yet when showing it", () => {
    const base = { ...DEMO_CONFIG, blocks: DEMO_CONFIG.blocks.filter((b) => b.type !== "trustBadges") };
    const { config } = applyChanges(base, [{ op: "set_trust_badges", items: ["shipping", "secure"] }]);
    const tb = config.blocks.find((b) => b.type === "trustBadges");
    expect(tb?.type === "trustBadges" && tb.props.items).toEqual(["shipping", "secure"]);
  });
  it("refuses to hide a block that isn't there", () => {
    const base = { ...DEMO_CONFIG, blocks: DEMO_CONFIG.blocks.filter((b) => b.type !== "coupon") };
    expect(() => applyChanges(base, [{ op: "hide_block", block_type: "coupon" }])).toThrow(/no coupon/);
  });
});

describe("proposals → one-click experiments", () => {
  it("starts a price test whose price reaches the buyer", async () => {
    const p = await createProposal(merchantId, {
      checkoutId: pageId,
      title: "Try $39",
      hypothesis: "Test a higher price on revenue per visit.",
      metric: "revenue_per_visit",
      changes: [{ op: "set_price", price_cents: 3900 }],
      source: "assistant",
    });
    const started = await startProposal(merchantId, p.id);
    expect(started.alreadyStarted).toBe(false);
    expect(await startProposal(merchantId, p.id)).toMatchObject({ experimentId: started.experimentId, alreadyStarted: true });

    // Find a visitor id that lands in B and one in A (hash-based assignment).
    const prices = new Set<number>();
    for (let i = 0; i < 40 && prices.size < 2; i++) {
      const r = await resolveCheckout(`rs-${RUN}`, `visitor-${i}`);
      prices.add(r!.product.priceCents);
    }
    expect([...prices].sort()).toEqual([2900, 3900]);

    // Only one test per checkout at a time.
    const p2 = await createProposal(merchantId, {
      checkoutId: pageId, title: "Hide coupon", hypothesis: "Coupon field leaks buyers.", metric: "conversion",
      changes: [{ op: "hide_block", block_type: "coupon" }], source: "insight",
    });
    await expect(startProposal(merchantId, p2.id)).rejects.toThrow(/already has a test/);
    await expect(startProposal("another-merchant", p2.id)).rejects.toThrow(/no longer exists/);
    await db.experiment.updateMany({ where: { checkoutPageId: pageId }, data: { status: "STOPPED" } });
  });
});

// ---------------------------------------------------------------------------
describe("Research Assistant loop (fake Claude)", () => {
  type Call = { params: Record<string, unknown> };
  const calls: Call[] = [];

  /** Scripted model: turn 1 calls tools (one with bad input), turn 2 answers. */
  function fakeClient(script: Record<string, unknown>[]) {
    let i = 0;
    return {
      beta: {
        messages: {
          stream(params: Record<string, unknown>) {
            calls.push({ params: structuredClone(params) });
            const msg = script[i++];
            const handlers: ((d: string) => void)[] = [];
            return {
              on(ev: string, cb: (d: string) => void) {
                if (ev === "text") handlers.push(cb);
                return this;
              },
              async finalMessage() {
                for (const b of msg.content as { type: string; text?: string }[]) if (b.type === "text") handlers.forEach((h) => h(b.text!));
                return msg;
              },
            };
          },
        },
      },
    } as unknown as Anthropic;
  }

  it("runs tools, emits a proposal, and replays history verbatim", async () => {
    const thinking = { type: "thinking", thinking: "", signature: "sig-abc" };
    __setAnthropicForTests(
      fakeClient([
        {
          role: "assistant",
          stop_reason: "tool_use",
          content: [
            thinking,
            { type: "text", text: "Let me look." },
            { type: "tool_use", id: "tu_1", name: "get_funnel", input: { from: "2026-09-01", to: "2026-09-30" } },
            { type: "tool_use", id: "tu_2", name: "compare_segments", input: { from: "nope" } },
            {
              type: "tool_use",
              id: "tu_3",
              name: "propose_experiment",
              input: {
                checkout_id: pageId,
                title: "Hide the coupon field",
                hypothesis: "Many people leave right after touching the coupon field.",
                metric: "conversion",
                changes: [{ op: "hide_block", block_type: "coupon" }],
              },
            },
          ],
        },
        { role: "assistant", stop_reason: "end_turn", content: [{ type: "text", text: "People leave at the **coupon field**." }] },
      ]),
    );
    const events: ResearchEvent[] = [];
    await runResearchTurn({ merchantId, question: "What's stopping people?", emit: (e) => events.push(e) });

    expect(events.filter((e) => e.type === "tool").map((e) => (e as { name: string }).name)).toEqual([
      "get_funnel",
      "compare_segments",
      "propose_experiment",
    ]);
    const proposal = events.find((e) => e.type === "proposal") as Extract<ResearchEvent, { type: "proposal" }>;
    expect(proposal.proposal.changes).toEqual(["Hide the coupon field"]);
    expect(events.at(-1)).toEqual({ type: "done" });

    // Request shape: streamed tools with eager input + server-side fallback.
    const first = calls[0].params as { tools: { eager_input_streaming?: boolean }[]; fallbacks: string; betas: string[] };
    expect(first.tools.every((t) => t.eager_input_streaming)).toBe(true);
    expect(first.fallbacks).toBe("default");
    expect(first.betas).toContain("server-side-fallback-2026-07-01");

    // Second call replays the first assistant turn verbatim, then ONE user message with all 3 results.
    const second = calls[1].params.messages as { role: string; content: { type: string; is_error?: boolean; signature?: string }[] }[];
    expect(second).toHaveLength(3);
    expect(second[1].content[0]).toEqual(thinking);
    expect(second[2].content.map((b) => b.type)).toEqual(["tool_result", "tool_result", "tool_result"]);
    expect(second[2].content[1].is_error).toBe(true); // invalid input never ran

    // The shop context goes into the first user message (stable system prompt for caching).
    expect(JSON.stringify(second[0].content)).toContain("<shop_context>");

    // UI view of the thread: context and plumbing hidden, proposal attached.
    const threadId = (events[0] as { threadId: string }).threadId;
    const view = await threadForDisplay(merchantId, threadId);
    expect(view?.[0]).toEqual({ role: "user", text: "What's stopping people?" });
    const answer = view?.[1] as Extract<NonNullable<typeof view>[number], { role: "assistant" }>;
    expect(answer.text).toContain("coupon field");
    expect(answer.steps).toEqual(["Walking the funnel", "Comparing segments", "Drafting an experiment"]);
    expect(answer.proposals).toHaveLength(1);
    expect(await threadForDisplay("someone-else", threadId)).toBeNull();
  });
});

// ---------------------------------------------------------------------------
describe("insight engine", () => {
  it("explains a conversion dip by device and payment method", async () => {
    // 14 calm days, then a bad day where mobile card payments fail.
    const now = new Date();
    const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
    const events: { merchantId: string; checkoutPageId: string; sessionId: string; type: "VIEW"; device: string; createdAt: Date }[] = [];
    const orders: Parameters<typeof db.order.createMany>[0] = { data: [] };
    const ordersData = orders.data as object[];
    for (let d = 15; d >= 1; d--) {
      const bad = d === 1;
      for (let i = 0; i < 60; i++) {
        const sessionId = crypto.randomUUID();
        const device = i % 3 === 0 ? "desktop" : "mobile";
        const t = new Date(today - d * 86_400_000 + (10 + (i % 10)) * 3_600_000);
        events.push({ merchantId, checkoutPageId: pageId, sessionId, type: "VIEW", device, createdAt: t });
        const pays = bad && device === "mobile" ? i % 5 === 0 : i % 2 === 0;
        if (pays) events.push({ merchantId, checkoutPageId: pageId, sessionId, type: "PAYMENT_SUCCEEDED" as "VIEW", device, createdAt: new Date(t.getTime() + 60_000) });
        if (i % 2 === 0) {
          ordersData.push({
            merchantId, checkoutPageId: pageId, amountCents: 2900, currency: "usd", device, paymentMethod: "card", country: "US",
            status: pays ? "SUCCEEDED" : "FAILED", createdAt: t, sessionId,
          });
        }
      }
    }
    await db.checkoutEvent.createMany({ data: events });
    await db.order.createMany(orders);

    await generateInsights(merchantId);
    const list = await listInsights(merchantId);
    const dip = list.find((i) => i.kind === "auto_conversion_dip");
    expect(dip?.title).toMatch(/Conversion dipped/);
    expect(dip?.body).toMatch(/mobile/);
    expect(dip?.body).toMatch(/Card payments on mobile failed/);

    // Regenerating replaces auto insights instead of piling them up.
    await generateInsights(merchantId);
    expect((await listInsights(merchantId)).filter((i) => i.kind === "auto_conversion_dip")).toHaveLength(1);
  });
});
