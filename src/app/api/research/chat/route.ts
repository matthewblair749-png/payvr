import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { RateLimitError, rateLimit } from "@/server/rate-limit";
import { assistantEnabled, runResearchTurn, type ResearchEvent } from "@/server/research/agent";

/**
 * POST /api/research/chat → newline-delimited JSON stream of ResearchEvents.
 * Auth: the signed-in merchant only; every tool is scoped to their data.
 */
export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.object({
  threadId: z.string().min(1).max(40).nullable().optional(),
  message: z.string().trim().min(2).max(2000),
});

export async function POST(req: Request) {
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) return Response.json({ error: "Not signed in" }, { status: 401 });
  const merchant = await db.merchant.findUnique({ where: { userId }, select: { id: true } });
  if (!merchant) return Response.json({ error: "No merchant" }, { status: 403 });

  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ask a question (2-2000 characters)." }, { status: 400 });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: ResearchEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        if (!assistantEnabled()) {
          emit({ type: "error", code: "no_api_key", message: "The Research Assistant needs an Anthropic API key (ANTHROPIC_API_KEY)." });
          return;
        }
        rateLimit(`research:${merchant.id}`, 40, 60 * 60_000);
        await runResearchTurn({ merchantId: merchant.id, threadId: parsed.data.threadId, question: parsed.data.message, emit, signal: req.signal });
      } catch (e) {
        if (e instanceof RateLimitError) emit({ type: "error", message: e.message });
        else if (e instanceof Anthropic.RateLimitError) emit({ type: "error", message: "The assistant is busy right now. Try again in a minute." });
        else if (e instanceof Anthropic.AuthenticationError) emit({ type: "error", code: "bad_api_key", message: "The Anthropic API key was rejected." });
        else if (!req.signal.aborted) {
          console.error("[research] turn failed", e);
          emit({ type: "error", message: "Something went wrong while researching. Please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
