/**
 * Sample data on Home (real Postgres): which data each merchant sees, and
 * that sample data is read-only.
 */
import "dotenv/config";
import type Anthropic from "@anthropic-ai/sdk";
import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
vi.mock("server-only", () => ({}));
import { db } from "@/server/db";
import { canWrite, firstRunState, homeMode } from "@/server/dal/home-source";
import { ask } from "@/server/home/ask";
import { __setAnthropicForTests } from "@/server/research/agent";

const RUN = Math.random().toString(36).slice(2, 8);
const userIds: string[] = [];
let sampleId = "";

async function merchant(tag: string, data: Record<string, unknown> = {}) {
  const user = await db.user.create({ data: { email: `sm-${tag}-${RUN}@lumen.test` } });
  userIds.push(user.id);
  return db.merchant.create({ data: { userId: user.id, name: tag, ...data } });
}

beforeAll(async () => {
  // Use the seeded demo shop if there is one, else make a sample shop.
  sampleId = (await db.merchant.findFirst({ where: { isSample: true } }))?.id ?? (await merchant("sample", { isSample: true })).id;
});
afterEach(() => __setAnthropicForTests(null));
afterAll(async () => {
  await db.user.deleteMany({ where: { id: { in: userIds } } });
  await db.$disconnect();
});

describe("homeMode", () => {
  it("shows a new merchant the demo shop's data, read-only", async () => {
    const m = await merchant("new");
    const mode = await homeMode(m);
    expect(mode).toMatchObject({ kind: "sample", dataMerchantId: sampleId });
    expect(canWrite(mode)).toBe(false);
  });

  it("shows the first-run checklist when sample data is off", async () => {
    const m = await merchant("off", { showSample: false });
    expect(await homeMode(m)).toMatchObject({ kind: "first-run", dataMerchantId: null });
    expect(await firstRunState(m.id, false)).toEqual({ published: null, stripeReady: false, visited: false });
  });

  it("switches to the merchant's own data at the first sale, whatever the setting", async () => {
    const m = await merchant("seller");
    await db.order.create({ data: { merchantId: m.id, amountCents: 2000, currency: "usd", status: "SUCCEEDED" } });
    const mode = await homeMode(m);
    expect(mode).toMatchObject({ kind: "live", dataMerchantId: m.id });
    expect(canWrite(mode)).toBe(true);
  });

  it("labels the demo shop's own data as sample data", async () => {
    const shop = await db.merchant.findUniqueOrThrow({ where: { id: sampleId } });
    expect(await homeMode(shop)).toMatchObject({ kind: "demo", dataMerchantId: sampleId });
  });
});

describe("Ask lumen on sample data", () => {
  it("reads the demo shop but never offers the proposal tool, and saves the question to the viewer", async () => {
    const viewer = await merchant("asker");
    const seen: { tools: { name: string }[] }[] = [];
    __setAnthropicForTests({
      beta: {
        messages: {
          stream: (p: { tools: { name: string }[] }) => (
            seen.push(p),
            {
              finalMessage: async () => ({
                role: "assistant",
                stop_reason: "tool_use",
                content: [{ type: "tool_use", id: "a", name: "give_answer", input: { answer: "Hi.", chart: null, next_step: "start_proposed_test" } }],
              }),
            }
          ),
        },
      },
    } as unknown as Anthropic);
    const a = await ask({ merchantId: viewer.id, dataMerchantId: sampleId, allowProposals: false, question: "What should I test?", days: 30, emit: () => {} });
    expect(seen[0].tools.map((t) => t.name)).not.toContain("propose_experiment");
    expect(a.action).toBeNull();
    expect(await db.researchThread.count({ where: { merchantId: viewer.id } })).toBe(1);
    expect(await db.insight.count({ where: { merchantId: sampleId, title: "What should I test?" } })).toBe(0);
  });
});
