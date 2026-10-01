import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type {
  BetaContentBlockParam,
  BetaMessage,
  BetaMessageParam,
  BetaTool,
  BetaToolResultBlockParam,
  BetaToolUseBlock,
} from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import { Prisma } from "@/generated/prisma/client";
import { db } from "../db";
import { AI_MODEL } from "../brand-import/ai";
import { getProposal, type ProposalView } from "./proposals";
import { RESEARCH_TOOLS, runTool, type ToolContext } from "./tools";

/**
 * The Research Assistant: Claude + read-only tools over the merchant's own
 * data, streamed to the browser.
 *
 * Conversation history is stored exactly as the API returned it (thinking,
 * text, tool_use, fallback blocks) and only ever appended, then replayed
 * verbatim on the next turn, which preserved thinking requires.
 */

export type ResearchEvent =
  | { type: "thread"; threadId: string; title: string }
  | { type: "text"; delta: string }
  | { type: "tool"; name: string; label: string }
  | { type: "proposal"; proposal: ProposalView }
  | { type: "done" }
  | { type: "error"; message: string; code?: string };


const MAX_ITERATIONS = 8;
export const CONTEXT_MARKER = "<shop_context>";

let client: Anthropic | null = null;
export function getAnthropic() {
  return (client ??= new Anthropic({ maxRetries: 2 }));
}
/** Test hook. */
export function __setAnthropicForTests(fake: Anthropic | null) {
  client = fake;
}
export const assistantEnabled = () => Boolean(process.env.ANTHROPIC_API_KEY) || client !== null;

const SYSTEM_PROMPT = `You are the Research Assistant inside lumen, a checkout and payments platform for solo creators and small brands. You help one merchant understand why their customers buy (or don't), using only their own checkout data.

How to work:
- Ground every number in a tool result. Never estimate or invent data. If the data can't answer the question, say so plainly.
- Start with list_checkouts if you need checkout ids. Use compare_segments with a baseline period to explain changes; use get_payment_failures when a drop might be payments; use get_funnel for "where do people leave"; use get_survey_answers for "why".
- Tool results give money as integer cents and dates in UTC. Format money normally ($48.00) and dates like "Tue, Sep 29".

How to answer (the merchant is busy and not a data analyst):
- Lead with the answer in one or two sentences.
- Then 2-4 short bullet points of evidence with the key numbers.
- Then what to do next.
- Plain language only: no p-values, confidence intervals, "statistical significance", or jargon. Say things like "clear difference", "probably", or "too early to tell".
- Don't mention tool names or how you looked things up.
- Use **bold** for the single most important number. Keep it under ~180 words unless asked for more.

Experiments:
- When a concrete, testable change follows from the evidence, call propose_experiment ONCE with a clear title and a hypothesis that cites the evidence. The merchant sees a card with a "Start test" button; never say the test has started.
- Pricing questions ("should I charge $29 or $39?") can't be answered from past data alone unless a price test already ran. Explain that, share what the data does suggest (e.g. how many buyers mention price), and propose a price test with set_price and metric revenue_per_visit.
- Don't propose changes the merchant can't keep (for example, a free-shipping badge only if they actually offer free shipping; say so in the hypothesis).`;

/** Tool definitions generated from the zod schemas (single source of truth). */
function toolDefinitions(): BetaTool[] {
  return RESEARCH_TOOLS.map((t) => {
    const schema = z.toJSONSchema(t.input, { target: "draft-7" }) as Record<string, unknown>;
    delete schema.$schema;
    return {
      name: t.name,
      description: t.description,
      input_schema: anyOfOnly(schema) as BetaTool["input_schema"],
      // Streamed request + client tools: inputs stream as generated; we validate each input ourselves.
      eager_input_streaming: true,
    };
  });
}

/** Normalize `oneOf` to `anyOf` for broad JSON-Schema compatibility. */
function anyOfOnly(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(anyOfOnly);
  if (v && typeof v === "object") {
    return Object.fromEntries(Object.entries(v).map(([k, val]) => [k === "oneOf" ? "anyOf" : k, anyOfOnly(val)]));
  }
  return v;
}

async function shopContext(ctx: ToolContext, merchantName: string) {
  const checkouts = JSON.parse((await runTool(ctx, "list_checkouts", {})).content) as {
    id: string;
    name: string;
    status: string;
    product: { name: string; price_cents: number } | null;
  }[];
  const today = new Date().toISOString().slice(0, 10);
  const weekday = new Date().toLocaleDateString("en-US", { weekday: "long", timeZone: "UTC" });
  return `${CONTEXT_MARKER}
Shop: ${merchantName}
Today: ${weekday}, ${today} (UTC)
Currency: ${ctx.currency.toUpperCase()}
Checkouts: ${checkouts.map((c) => `${c.name} [${c.id}] ${c.status.toLowerCase()}${c.product ? `, sells ${c.product.name} at ${(c.product.price_cents / 100).toFixed(2)}` : ""}`).join("; ")}
</shop_context>`;
}

async function appendMessage(threadId: string, role: "user" | "assistant", content: unknown) {
  // seq = count is safe: one turn per thread at a time (enforced by the route's per-thread lock).
  const seq = await db.researchMessage.count({ where: { threadId } });
  await db.researchMessage.create({ data: { threadId, seq, role, content: content as Prisma.InputJsonValue } });
}

const turnLocks = new Set<string>();

export async function runResearchTurn(opts: {
  merchantId: string;
  threadId?: string | null;
  question: string;
  emit: (e: ResearchEvent) => void;
  signal?: AbortSignal;
}) {
  const { merchantId, question, emit, signal } = opts;
  const merchant = await db.merchant.findUniqueOrThrow({ where: { id: merchantId } });
  const ctx: ToolContext = { merchantId, currency: merchant.defaultCurrency };

  // Load (merchant-scoped) or create the thread.
  let thread = opts.threadId ? await db.researchThread.findFirst({ where: { id: opts.threadId, merchantId } }) : null;
  const isNew = !thread;
  thread ??= await db.researchThread.create({ data: { merchantId, title: question.slice(0, 80) } });
  emit({ type: "thread", threadId: thread.id, title: thread.title });

  if (turnLocks.has(thread.id)) {
    emit({ type: "error", message: "Still working on your last question in this conversation." });
    return;
  }
  turnLocks.add(thread.id);
  try {
    const content: BetaContentBlockParam[] = [];
    if (isNew) content.push({ type: "text", text: await shopContext(ctx, merchant.name) });
    content.push({ type: "text", text: question });
    await appendMessage(thread.id, "user", content);

    const tools = toolDefinitions();
    const anthropic = getAnthropic();
    let jsonRetries = 0;

    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const rows = await db.researchMessage.findMany({ where: { threadId: thread.id }, orderBy: { seq: "asc" } });
      const messages = rows.map((r) => ({ role: r.role, content: r.content }) as BetaMessageParam);

      const stream = anthropic.beta.messages.stream(
        {
          model: AI_MODEL,
          max_tokens: 16_000,
          system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
          tools,
          messages,
          output_config: { effort: "medium" },
          // If a safeguard declines, the API re-runs on a suitable fallback model.
          betas: ["server-side-fallback-2026-07-01"],
          fallbacks: "default",
        },
        { signal },
      );
      stream.on("text", (delta) => emit({ type: "text", delta }));

      let message: BetaMessage;
      try {
        message = await stream.finalMessage();
        jsonRetries = 0;
      } catch (err) {
        // Only an unparseable tool input is retried; API errors propagate.
        if (err instanceof Anthropic.APIError || signal?.aborted || jsonRetries++ >= 2) throw err;
        continue;
      }

      // Append exactly what came back (thinking/fallback blocks included).
      await appendMessage(thread.id, "assistant", message.content);

      if (message.stop_reason === "refusal") {
        emit({ type: "text", delta: "\n\nI can't help with that one. Try asking about your checkout data." });
        break;
      }
      if (message.stop_reason === "pause_turn") continue;

      const toolUses = message.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");
      if (!toolUses.length) break; // end_turn or other terminal stop
      if (message.stop_reason === "max_tokens") {
        emit({ type: "error", message: "That answer ran long and got cut off. Try a narrower question." });
        break;
      }

      const results: BetaToolResultBlockParam[] = [];
      for (const use of toolUses) {
        const def = RESEARCH_TOOLS.find((t) => t.name === use.name);
        emit({ type: "tool", name: use.name, label: def?.label ?? "Looking into it" });
        const r = await runTool(ctx, use.name, use.input);
        results.push({ type: "tool_result", tool_use_id: use.id, content: r.content, ...(r.ok ? {} : { is_error: true }) });
        if (r.ok && use.name === "propose_experiment") {
          const id = (JSON.parse(r.content) as { proposal_id?: string }).proposal_id;
          const proposal = id ? await getProposal(merchantId, id) : null;
          if (proposal) emit({ type: "proposal", proposal });
        }
      }
      // All results for one assistant turn go back in a single user message.
      await appendMessage(thread.id, "user", results);
    }
    await db.researchThread.update({ where: { id: thread.id }, data: { updatedAt: new Date() } });
    emit({ type: "done" });
  } finally {
    turnLocks.delete(thread.id);
  }
}

// ---------------------------------------------------------------------------
// Reading threads back for the UI

export type DisplayMessage =
  | { role: "user"; text: string }
  | { role: "assistant"; text: string; steps: string[]; proposals: ProposalView[] };

export async function listThreads(merchantId: string) {
  return db.researchThread.findMany({
    where: { merchantId },
    orderBy: { updatedAt: "desc" },
    take: 20,
    select: { id: true, title: true, updatedAt: true },
  });
}

/** Convert the raw transcript into chat bubbles (hides context, thinking and tool plumbing). */
export async function threadForDisplay(merchantId: string, threadId: string): Promise<DisplayMessage[] | null> {
  const thread = await db.researchThread.findFirst({
    where: { id: threadId, merchantId },
    include: { messages: { orderBy: { seq: "asc" } } },
  });
  if (!thread) return null;
  const out: DisplayMessage[] = [];
  const current = () => {
    const last = out[out.length - 1];
    if (last?.role === "assistant") return last;
    const fresh: DisplayMessage = { role: "assistant", text: "", steps: [], proposals: [] };
    out.push(fresh);
    return fresh;
  };
  const labels = Object.fromEntries(RESEARCH_TOOLS.map((t) => [t.name, t.label]));

  for (const m of thread.messages) {
    const blocks = (typeof m.content === "string" ? [{ type: "text", text: m.content }] : m.content) as {
      type: string;
      text?: string;
      name?: string;
      content?: unknown;
      is_error?: boolean;
    }[];
    if (m.role === "user") {
      const text = blocks
        .filter((b) => b.type === "text" && !b.text?.startsWith(CONTEXT_MARKER))
        .map((b) => b.text)
        .join("\n");
      if (text) out.push({ role: "user", text });
      for (const b of blocks) {
        if (b.type !== "tool_result" || b.is_error || typeof b.content !== "string") continue;
        try {
          const id = (JSON.parse(b.content) as { proposal_id?: string }).proposal_id;
          const p = id ? await getProposal(merchantId, id) : null;
          if (p) current().proposals.push(p);
        } catch {
          /* not JSON */
        }
      }
    } else {
      const a = current();
      for (const b of blocks) {
        if (b.type === "text" && b.text) a.text += (a.text ? "\n\n" : "") + b.text;
        if (b.type === "tool_use" && b.name) a.steps.push(labels[b.name] ?? b.name);
      }
    }
  }
  return out;
}
