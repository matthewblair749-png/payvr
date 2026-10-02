import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { BetaMessage, BetaMessageParam, BetaTool, BetaToolResultBlockParam, BetaToolUseBlock } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import { z } from "zod";
import type { Prisma } from "@/generated/prisma/client";
import { answerLabel } from "@/lib/survey/questions";
import { AI_MODEL } from "../brand-import/ai";
import { db } from "../db";
import { appendMessage, assistantEnabled, getAnthropic, shopContext, toolDefinitions } from "../research/agent";
import { getProposal, type ProposalView } from "../research/proposals";
import { RESEARCH_TOOLS, runTool, type ToolContext } from "../research/tools";

/**
 * Ask lumen: one plain-English question → a short answer, a small chart,
 * "How I calculated this", and maybe a one-click next step.
 *
 * The method section is recorded by us, never written by the model: every
 * query that ran, in plain words, with its inputs and the rows it returned.
 * Questions are saved as research conversations, so ⌘K can find them.
 */

export type AskChart = {
  kind: "bar" | "line";
  title: string;
  unit: "money" | "count" | "percent";
  points: { label: string; value: number }[];
  /** Label of the one point the answer is about (drawn in orange). */
  highlight: string | null;
};

export type AskStep = { label: string; logic: string; input: Record<string, unknown>; rows: Record<string, unknown>[]; totalRows: number };

export type AskAction =
  | { kind: "start_test"; proposal: ProposalView }
  | { kind: "link"; label: string; href: string };

export type AskAnswer = {
  question: string;
  answer: string;
  chart: AskChart | null;
  steps: AskStep[];
  action: AskAction | null;
  source: "ai" | "quick";
  threadId: string | null;
};

export type AskEvent = { type: "step"; label: string } | { type: "answer"; answer: AskAnswer } | { type: "error"; message: string };

/** How each query works, in the merchant's words (shown under "How I calculated this"). */
const LOGIC: Record<string, string> = {
  list_checkouts: "Lists your checkouts with their product, price and current setup.",
  get_daily_metrics:
    "For each day (UTC): visits are checkout sessions that opened the page; conversion is sessions that paid ÷ visits; revenue is paid orders minus refunds.",
  compare_segments: "Groups checkout sessions by one trait (like device) and divides sessions that paid by all sessions in each group.",
  get_funnel: "Takes each session's furthest step and counts how many reached each one.",
  get_checkout_funnel:
    "Takes each session's furthest step (Visit, Start, Details, Payment, Paid) and counts how many reached each. Drop-off is the share who reached one step but not the next, compared with the period before.",
  get_payment_failures: "Counts payment attempts and how many were declined, grouped by country, payment method or device.",
  get_survey_answers: "Counts buyers' answers to the one-tap question after they paid.",
  get_experiment_results: "Compares visits, sales and revenue per visit for each version of a running or recent test.",
  get_traffic_sources: "Groups checkout sessions by where the visit came from (referring site or utm_source tag) and divides sessions that paid by visits.",
  propose_experiment: "Drafted a test you can start in one click. Nothing changes until you start it.",
};

function rowsOf(result: unknown): Record<string, unknown>[] {
  if (Array.isArray(result)) return result as Record<string, unknown>[];
  if (result && typeof result === "object") {
    for (const key of ["days", "segments", "stages", "drop_offs", "attempts", "variants", "checkouts"]) {
      const v = (result as Record<string, unknown>)[key];
      if (Array.isArray(v)) return v as Record<string, unknown>[];
    }
    return [result as Record<string, unknown>];
  }
  return [];
}

function step(name: string, input: unknown, result: unknown): AskStep {
  const rows = rowsOf(result);
  const def = RESEARCH_TOOLS.find((t) => t.name === name);
  return {
    label: def?.label ?? name,
    logic: LOGIC[name] ?? "",
    input: (input && typeof input === "object" ? input : {}) as Record<string, unknown>,
    rows: rows.slice(0, 60),
    totalRows: rows.length,
  };
}

// ---------------------------------------------------------------------------
// AI path

const ANSWER_TOOL: BetaTool = {
  name: "give_answer",
  description: "Give the merchant your final answer. Call this exactly once, last, after you have the numbers.",
  strict: true,
  input_schema: {
    type: "object",
    additionalProperties: false,
    required: ["answer", "chart", "next_step"],
    properties: {
      answer: { type: "string", description: "2-3 plain sentences, under 70 words. Lead with the answer. Use **bold** for the one key number." },
      chart: {
        anyOf: [
          { type: "null" },
          {
            type: "object",
            additionalProperties: false,
            required: ["kind", "title", "unit", "points", "highlight"],
            properties: {
              kind: { type: "string", enum: ["bar", "line"], description: "line for change over time, bar for comparing groups" },
              title: { type: "string" },
              unit: { type: "string", enum: ["money", "count", "percent"], description: "money values in cents; percent values as 0-1 fractions" },
              points: {
                type: "array",
                description: "At most 12 points, copied exactly from tool results",
                items: {
                  type: "object",
                  additionalProperties: false,
                  required: ["label", "value"],
                  properties: { label: { type: "string" }, value: { type: "number" } },
                },
              },
              highlight: { anyOf: [{ type: "null" }, { type: "string" }], description: "Label of the point the answer is about, or null" },
            },
          },
        ],
      },
      next_step: {
        type: "string",
        enum: ["none", "start_proposed_test", "see_funnel", "see_payments", "see_experiments"],
        description: "start_proposed_test only if you called propose_experiment successfully",
      },
    },
  },
};

const AnswerInput = z.object({
  answer: z.string().min(1).max(800),
  chart: z
    .object({
      kind: z.enum(["bar", "line"]),
      title: z.string().max(80),
      unit: z.enum(["money", "count", "percent"]),
      points: z.array(z.object({ label: z.string().max(40), value: z.number().finite() })).max(40),
      highlight: z.string().max(40).nullable(),
    })
    .nullable(),
  next_step: z.enum(["none", "start_proposed_test", "see_funnel", "see_payments", "see_experiments"]),
});

const ASK_SYSTEM = `You are "Ask lumen", the question bar on a small creator's checkout dashboard. Answer ONE question about their own shop data.

How to work:
- Get the numbers with the read-only tools first. Never estimate or invent a number; if the data can't answer, say so.
- Tool results give money in integer cents and days in UTC.
- If a concrete, testable change follows clearly from the evidence, call propose_experiment once. Never say a test has started.
- Finish by calling give_answer exactly once.

The answer (the merchant is busy, not an analyst):
- 2-3 plain sentences, under 70 words, leading with the answer. **Bold** the one key number.
- No jargon, no statistics terms, don't mention tools or queries.
- Add a chart only when it helps: copy values exactly from tool results (cents for money, 0-1 fractions for percent), at most 12 points, highlight the one the answer is about.`;

async function askWithClaude(
  ctx: ToolContext,
  merchantName: string,
  question: string,
  days: number,
  threadId: string,
  emit: (e: AskEvent) => void,
  signal?: AbortSignal,
  allowProposals = true,
) {
  const steps: AskStep[] = [];
  let proposal: ProposalView | null = null;
  const tools = [...toolDefinitions().filter((t) => allowProposals || t.name !== "propose_experiment"), ANSWER_TOOL];
  const messages: BetaMessageParam[] = [
    {
      role: "user",
      content: [
        { type: "text", text: await shopContext(ctx, merchantName) },
        { type: "text", text: `The dashboard is showing the last ${days} days; use that period unless the question names another.` },
        { type: "text", text: question },
      ],
    },
  ];
  await appendMessage(threadId, "user", messages[0].content);
  let nudged = false;

  for (let i = 0; i < 8; i++) {
    let message: BetaMessage;
    try {
      message = await getAnthropic()
        .beta.messages.stream(
          {
            model: AI_MODEL,
            max_tokens: 16_000,
            system: [{ type: "text", text: ASK_SYSTEM, cache_control: { type: "ephemeral" } }],
            tools,
            messages,
            output_config: { effort: "medium" },
            betas: ["server-side-fallback-2026-07-01"],
            fallbacks: "default",
          },
          { signal },
        )
        .finalMessage();
    } catch (e) {
      if (e instanceof Anthropic.APIError || signal?.aborted) throw e;
      continue; // an unparseable streamed tool input: ask again
    }
    messages.push({ role: "assistant", content: message.content });
    await appendMessage(threadId, "assistant", message.content);

    if (message.stop_reason === "refusal") return { answer: "I can't help with that one. Try asking about your sales, shoppers or checkouts.", chart: null, steps, action: null };
    if (message.stop_reason === "pause_turn") continue;
    const uses = message.content.filter((b): b is BetaToolUseBlock => b.type === "tool_use");

    const final = uses.find((u) => u.name === "give_answer");
    if (final) {
      const parsed = AnswerInput.safeParse(final.input);
      if (!parsed.success) throw new Error("Invalid give_answer input");
      const a = parsed.data;
      const action: AskAction | null =
        a.next_step === "start_proposed_test" && proposal && !proposal.startedExperimentId
          ? { kind: "start_test", proposal }
          : a.next_step === "see_funnel"
            ? { kind: "link", label: "See the funnel", href: "/studio/funnel/details" }
            : a.next_step === "see_payments"
              ? { kind: "link", label: "See payments", href: "/studio/orders" }
              : a.next_step === "see_experiments"
                ? { kind: "link", label: "See experiments", href: "/studio/experiments" }
                : null;
      await appendMessage(threadId, "user", [{ type: "tool_result", tool_use_id: final.id, content: "Shown to the merchant." }]);
      return { answer: a.answer, chart: a.chart && a.chart.points.length ? { ...a.chart, points: a.chart.points.slice(0, 12) } : null, steps, action };
    }

    if (!uses.length) {
      // `auto` doesn't guarantee the answer tool: nudge once, then use the text.
      const text = message.content.flatMap((b) => (b.type === "text" ? [b.text] : [])).join("\n").trim();
      if (nudged || message.stop_reason === "max_tokens") return { answer: text || "I couldn't put an answer together. Try rephrasing the question.", chart: null, steps, action: null };
      nudged = true;
      const nudge: BetaMessageParam = { role: "user", content: "Please call give_answer with your final answer." };
      messages.push(nudge);
      await appendMessage(threadId, "user", nudge.content);
      continue;
    }

    const results: BetaToolResultBlockParam[] = [];
    for (const use of uses) {
      emit({ type: "step", label: RESEARCH_TOOLS.find((t) => t.name === use.name)?.label ?? "Looking into it" });
      const r =
        use.name === "propose_experiment" && !allowProposals
          ? { ok: false, content: JSON.stringify({ error: "Proposals are off for sample data." }) }
          : await runTool(ctx, use.name, use.input);
      results.push({ type: "tool_result", tool_use_id: use.id, content: r.content, ...(r.ok ? {} : { is_error: true }) });
      if (!r.ok) continue;
      const data = JSON.parse(r.content) as unknown;
      if (use.name === "propose_experiment") {
        const id = (data as { proposal_id?: string }).proposal_id;
        proposal = id ? await getProposal(ctx.merchantId, id) : proposal;
      }
      if (use.name !== "list_checkouts") steps.push(step(use.name, use.input, data));
    }
    messages.push({ role: "user", content: results });
    await appendMessage(threadId, "user", results);
  }
  return { answer: "That question took too many steps. Try a narrower one.", chart: null, steps, action: null };
}

// ---------------------------------------------------------------------------
// Quick answers: common questions answered from the same tools without AI
// (used when no AI is configured).

const iso = (d: Date) => d.toISOString().slice(0, 10);
type Period = { from: string; to: string; days: number; label: string };

/** The question's own period wins over the page's date range ("this week" means 7 days). */
export function periodFor(question: string, fallbackDays: number, now = new Date()): Period {
  const q = question.toLowerCase();
  const day = (offset: number) => iso(new Date(now.getTime() - offset * 86_400_000));
  if (/\btoday\b/.test(q)) return { from: day(0), to: day(0), days: 1, label: "today" };
  if (/\byesterday\b/.test(q)) return { from: day(1), to: day(1), days: 1, label: "yesterday" };
  const days = /\b(90 days|quarter|3 months|three months)\b/.test(q)
    ? 90
    : /\b(this month|last month|30 days|month)\b/.test(q)
      ? 30
      : /\b(this week|last week|7 days|week)\b/.test(q)
        ? 7
        : fallbackDays;
  return { from: day(days - 1), to: day(0), days, label: `the last ${days} days` };
}
const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: 0 }).format(Math.round(cents / 100));
const pct = (v: number) => `${Math.round(v * 100)}%`;

type Quick = { answer: string; chart: AskChart | null; steps: AskStep[]; action: AskAction | null };

async function run(ctx: ToolContext, name: string, input: Record<string, unknown>, steps: AskStep[], emit: (e: AskEvent) => void) {
  emit({ type: "step", label: RESEARCH_TOOLS.find((t) => t.name === name)?.label ?? "Looking into it" });
  const r = await runTool(ctx, name, input);
  if (!r.ok) throw new Error(`Quick answer tool failed: ${r.content}`);
  const data = JSON.parse(r.content) as unknown;
  steps.push(step(name, input, data));
  return data;
}

export async function quickAnswer(ctx: ToolContext, question: string, fallbackDays: number, emit: (e: AskEvent) => void): Promise<Quick | null> {
  const q = question.toLowerCase();
  const steps: AskStep[] = [];
  let days = fallbackDays;
  const per = periodFor(question, days);
  const range = { from: per.from, to: per.to };
  const period = per.label;
  days = per.days === 1 ? 7 : per.days; // the funnel tool works in 7/30/90-day windows

  if (/drop|leav|abandon|funnel|leak|lose|losing|lost|stuck|shipping/.test(q)) {
    const f = (await run(ctx, "get_checkout_funnel", { days }, steps, emit)) as { stages: { stage: string; sessions: number }[]; biggest_leak_before: string | null };
    const leak = f.biggest_leak_before;
    const d = leak
      ? ((await run(ctx, "get_checkout_funnel", { days, step: leak }, steps, emit)) as {
          breakdown: { worst_segment: { segment: string; drop_rate: number; everyone_else_drop_rate: number } | null; last_field_before_leaving: { field: string; share: number }[] };
        })
      : null;
    const w = d?.breakdown.worst_segment;
    const where = d?.breakdown.last_field_before_leaving.find((x) => !/without/.test(x.field))?.field.toLowerCase();
    const stageName = (k: string) => k.charAt(0).toUpperCase() + k.slice(1);
    const visits = f.stages[0]?.sessions ?? 0;
    const paid = f.stages[4]?.sessions ?? 0;
    const answer = leak
      ? `The biggest leak is before **${stageName(leak)}**${where ? `, mostly at ${where}` : ""}.${w ? ` ${w.segment} shoppers leave there at ${pct(w.drop_rate)}, vs ${pct(w.everyone_else_drop_rate)} for everyone else.` : ""} Overall, ${pct(visits ? paid / visits : 0)} of visits paid in ${period}.`
      : `No clear leak in ${period}: ${pct(visits ? paid / visits : 0)} of visits paid.`;
    return {
      answer,
      chart: { kind: "bar", title: `Shoppers at each step, ${period}`, unit: "count", points: f.stages.map((s) => ({ label: s.stage, value: s.sessions })), highlight: leak ? stageName(leak) : null },
      steps,
      action: leak ? { kind: "link", label: "See why", href: `/studio/funnel/${leak}` } : null,
    };
  }

  if (/device|mobile|desktop|phone|tablet/.test(q)) {
    const r = (await run(ctx, "compare_segments", { ...range, dimension: "device" }, steps, emit)) as { segments: { segment: string; visits: number; conversion: number | null }[] };
    const segs = r.segments.filter((s) => s.conversion != null).sort((a, b) => b.visits - a.visits);
    const best = [...segs].sort((a, b) => (b.conversion ?? 0) - (a.conversion ?? 0))[0];
    const worst = [...segs].sort((a, b) => (a.conversion ?? 0) - (b.conversion ?? 0))[0];
    const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
    return {
      answer: best && worst && best !== worst
        ? `${cap(best.segment)} converts best at **${pct(best.conversion!)}**; ${worst.segment} trails at ${pct(worst.conversion!)} over ${period}. ${cap(segs[0].segment)} brings the most visits (${segs[0].visits.toLocaleString("en-US")}).`
        : `Not enough visits in ${period} to compare devices yet.`,
      chart: { kind: "bar", title: `Conversion by device, ${period}`, unit: "percent", points: segs.map((s) => ({ label: cap(s.segment), value: s.conversion! })), highlight: worst ? cap(worst.segment) : null },
      steps,
      action: { kind: "link", label: "See where they drop off", href: "/studio/funnel/details" },
    };
  }

  if (/source|come from|coming from|instagram|tiktok|traffic|channel|referr/.test(q)) {
    const rows = (await run(ctx, "get_traffic_sources", range, steps, emit)) as { source: string; visits: number; conversion: number | null }[];
    const top = rows[0];
    const best = rows.filter((r) => r.visits >= 30 && r.conversion != null).sort((a, b) => b.conversion! - a.conversion!)[0];
    return {
      answer: top
        ? `Most shoppers come from **${top.source}** (${top.visits.toLocaleString("en-US")} visits in ${period}).${best && best !== top ? ` ${best.source} converts best, at ${pct(best.conversion!)}.` : ""}`
        : `No visits recorded in ${period}.`,
      chart: { kind: "bar", title: `Visits by source, ${period}`, unit: "count", points: rows.slice(0, 8).map((r) => ({ label: r.source, value: r.visits })), highlight: top?.source ?? null },
      steps,
      action: null,
    };
  }

  if (/why|reason|stopp|almost|nearly|survey|hesitat/.test(q)) {
    // "Why do they buy?" vs "what nearly stopped them?"
    const question = /stopp|almost|nearly|hesitat|didn.?t|not buy|abandon/.test(q) ? "nearly_stopped" : "why_bought";
    const rows = (await run(ctx, "get_survey_answers", { ...range, question }, steps, emit)) as { answer: string; count: number }[];
    const total = rows.reduce((s, r) => s + r.count, 0);
    const top = rows.find((r) => r.answer !== "nothing" && r.answer !== "other");
    const lead = question === "why_bought" ? "Asked what made them buy" : "Asked what nearly stopped them";
    const title = question === "why_bought" ? `Why buyers bought, ${period}` : `What nearly stopped buyers, ${period}`;
    return {
      answer: top
        ? `${lead}, **${pct(top.count / total)}** of buyers said “${answerLabel(question, top.answer)}” (${total.toLocaleString("en-US")} answers in ${period}).`
        : `No buyer answers to that question yet in ${period}.`,
      chart: { kind: "bar", title, unit: "percent", points: rows.map((r) => ({ label: answerLabel(question, r.answer), value: total ? r.count / total : 0 })), highlight: top ? answerLabel(question, top.answer) : null },
      steps,
      action: null,
    };
  }

  if (/revenue|sales|sold|made|make|earn|money|income|how much|best day|busiest/.test(q)) {
    const r = (await run(ctx, "get_daily_metrics", range, steps, emit)) as { currency: string; days: { day: string; revenue_cents: number }[] };
    const total = r.days.reduce((s, d) => s + d.revenue_cents, 0);
    const best = [...r.days].sort((a, b) => b.revenue_cents - a.revenue_cents)[0];
    const label = (day: string) => new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: "UTC" });
    // Daily points up to a month; weekly totals beyond that (kept readable).
    const weekly = r.days.length > 31;
    const points: { label: string; value: number }[] = [];
    if (weekly) {
      for (let end = r.days.length; end > 0; end -= 7) {
        const chunk = r.days.slice(Math.max(0, end - 7), end);
        points.unshift({ label: `Week of ${label(chunk[0].day)}`, value: chunk.reduce((s, d) => s + d.revenue_cents, 0) });
      }
    } else points.push(...r.days.map((d) => ({ label: label(d.day), value: d.revenue_cents })));
    const single = r.days.length === 1;
    return {
      answer: total
        ? single
          ? `You made **${money(total, r.currency)}** ${period} (UTC day).`
          : `You made **${money(total, r.currency)}** in ${period}. Your best day was ${label(best.day)} with ${money(best.revenue_cents, r.currency)}.`
        : `No sales ${single ? period : `in ${period}`} yet.`,
      chart: single
        ? null
        : { kind: weekly ? "bar" : "line", title: weekly ? `Revenue per week, ${period}` : `Revenue per day, ${period}`, unit: "money", points, highlight: weekly ? null : label(best.day) },
      steps,
      action: null,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------

const locks = new Set<string>();

export async function ask(opts: {
  merchantId: string;
  /** Whose numbers to read (the demo shop's in sample mode). Defaults to merchantId. */
  dataMerchantId?: string;
  /** False on sample data: no drafting tests against someone else's shop. */
  allowProposals?: boolean;
  question: string;
  days: number;
  emit: (e: AskEvent) => void;
  signal?: AbortSignal;
}): Promise<AskAnswer> {
  const { merchantId, question, days, emit, signal } = opts;
  const dataMerchantId = opts.dataMerchantId ?? merchantId;
  const allowProposals = opts.allowProposals ?? true;
  if (locks.has(merchantId)) throw new Error("busy");
  locks.add(merchantId);
  try {
    const merchant = await db.merchant.findUniqueOrThrow({ where: { id: dataMerchantId } });
    const ctx: ToolContext = { merchantId: dataMerchantId, currency: merchant.defaultCurrency };
    // Saved like a research conversation, so ⌘K finds it and Research can open it.
    const thread = await db.researchThread.create({ data: { merchantId, title: question.slice(0, 80) } });

    let result: Omit<AskAnswer, "question" | "source" | "threadId">;
    let source: AskAnswer["source"];
    if (assistantEnabled()) {
      result = await askWithClaude(ctx, merchant.name, question, days, thread.id, emit, signal, allowProposals);
      source = "ai";
    } else {
      const quick = await quickAnswer(ctx, question, days, emit);
      // Quick answers can show what the data says, not what to change.
      if (quick && /\b(how (can|do|should) i|fix|stop|improve|what should|what to (try|do)|ideas?)\b/i.test(question)) {
        quick.answer += " Ideas for what to change come from the full assistant, which isn't connected here.";
      }
      result = quick ?? {
        answer:
          "I can answer questions about your revenue, devices, drop-off, traffic sources and what buyers tell you. Questions beyond that need the full assistant, which isn't connected here (an Anthropic API key turns it on).",
        chart: null,
        steps: [],
        action: null,
      };
      source = "quick";
      await appendMessage(thread.id, "user", [{ type: "text", text: question }]);
      await appendMessage(thread.id, "assistant", [{ type: "text", text: result.answer }] as unknown as Prisma.InputJsonValue);
    }
    const answer: AskAnswer = { question, source, threadId: thread.id, ...result };
    emit({ type: "answer", answer });
    return answer;
  } finally {
    locks.delete(merchantId);
  }
}
