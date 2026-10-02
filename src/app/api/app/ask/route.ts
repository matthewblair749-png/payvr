import Anthropic from "@anthropic-ai/sdk";
import { homeMode, canWrite } from "@/server/dal/home-source";
import { z } from "zod";
import { parseRange, rangeDays } from "@/lib/date-range";
import { merchantForAction } from "@/server/dal/session";
import { ask, type AskEvent } from "@/server/home/ask";
import { RateLimitError, rateLimit } from "@/server/rate-limit";

/** POST /api/app/ask → newline-delimited JSON: step events, then one answer. */
export const runtime = "nodejs";
export const maxDuration = 120;

const body = z.object({ question: z.string().trim().min(2).max(300), range: z.string().optional() });

export async function POST(req: Request) {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in to ask" }, { status: 401 });
  }
  const parsed = body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: "Ask a question (2-300 characters)." }, { status: 400 });
  const days = rangeDays(parseRange(parsed.data.range));

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (e: AskEvent) => controller.enqueue(encoder.encode(JSON.stringify(e) + "\n"));
      try {
        // Shares the Research Assistant's hourly budget: both run the same tools.
        rateLimit(`research:${merchant.id}`, 40, 60 * 60_000);
        const mode = await homeMode(merchant);
        await ask({
          merchantId: merchant.id,
          dataMerchantId: mode.dataMerchantId ?? merchant.id,
          allowProposals: canWrite(mode),
          question: parsed.data.question,
          days,
          emit,
          signal: req.signal,
        });
      } catch (e) {
        if (e instanceof RateLimitError) emit({ type: "error", message: e.message });
        else if (e instanceof Error && e.message === "busy") emit({ type: "error", message: "Still working on your last question. One moment." });
        else if (e instanceof Anthropic.RateLimitError) emit({ type: "error", message: "lumen is busy right now. Try again in a minute." });
        else if (e instanceof Anthropic.AuthenticationError) emit({ type: "error", message: "lumen's AI key was rejected. Check ANTHROPIC_API_KEY." });
        else if (!req.signal.aborted) {
          console.error("[ask] failed", e);
          emit({ type: "error", message: "Something went wrong while answering. Your data is fine; please try again." });
        }
      } finally {
        controller.close();
      }
    },
  });
  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store" } });
}
