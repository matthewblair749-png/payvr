import { z } from "zod";
import { buildAIFacts } from "@/server/ai/facts";
import { providerFor } from "@/server/ai";
import { localProvider } from "@/server/ai/local";
import { getAnalysis } from "@/server/analysis/get";
import { currentUser } from "@/server/auth/session";
import { RateLimitError, rateLimit, LIMITS } from "@/server/rate-limit";
import { clientIp, isSameOrigin } from "@/server/request-meta";
import { demoWorkspace, workspaceForAction, type Workspace } from "@/server/workspace";

/**
 * Ask PIVOT. Streams newline-delimited JSON events:
 *   {"type":"text","delta":"..."}  {"type":"done","source":"claude"|"engine"}  {"type":"error","message":"..."}
 * Answers come only from the caller's own workspace analysis (or the public demo).
 */
const Body = z.object({
  question: z.string().trim().min(1).max(500),
  history: z.array(z.object({ role: z.enum(["user", "assistant"]), text: z.string().max(2000) })).max(8).default([]),
  mode: z.enum(["app", "demo"]),
});

const json = (status: number, error: string) => Response.json({ error }, { status, headers: { "cache-control": "no-store" } });

export async function POST(request: Request) {
  if (!isSameOrigin(request)) return json(403, "Not allowed.");
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await request.json());
  } catch {
    return json(400, "Ask a question of up to 500 characters.");
  }

  let ws: Workspace;
  try {
    ws = body.mode === "demo" ? await demoWorkspace() : await workspaceForAction();
  } catch {
    return json(401, "Your session has ended. Log in again.");
  }

  try {
    const who = ws.mode === "app" ? `u:${ws.user.id}` : `ip:${await clientIp()}`;
    rateLimit(`ask:${who}`, LIMITS.ask);
    const perDay = ws.entitlements.limits.askPerDay;
    if (perDay !== null) rateLimit(`ask-day:${ws.mode === "app" ? ws.company.id : who}`, { limit: ws.mode === "demo" ? 30 : perDay, windowMs: 86_400_000 });
  } catch (e) {
    if (e instanceof RateLimitError) {
      const user = await currentUser();
      return json(429, ws.mode === "app" && user ? `${e.message} Upgrade your plan for more questions.` : e.message);
    }
    throw e;
  }

  const { analysis, data } = await getAnalysis(ws);
  const facts = buildAIFacts(analysis, data);
  const provider = providerFor(ws);
  const encoder = new TextEncoder();
  const signal = request.signal;

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (ev: object) => controller.enqueue(encoder.encode(JSON.stringify(ev) + "\n"));
      let sent = false;
      try {
        for await (const delta of provider.answer({ question: body.question, history: body.history, facts, analysis, signal })) {
          sent = true;
          send({ type: "text", delta });
        }
        send({ type: "done", source: provider.id === "anthropic" ? "claude" : "engine" });
      } catch (e) {
        if (signal.aborted) return controller.close();
        console.error("[pivot] ask failed", e instanceof Error ? e.message : e);
        if (!sent) {
          // The AI service failed before answering: fall back to the built-in engine.
          for await (const delta of localProvider.answer({ question: body.question, history: [], facts, analysis })) send({ type: "text", delta });
          send({ type: "done", source: "engine" });
        } else {
          send({ type: "text", delta: "\n\n(The answer was cut short. Please ask again.)" });
          send({ type: "done", source: "claude" });
        }
      }
      controller.close();
    },
  });

  return new Response(stream, { headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store", "x-content-type-options": "nosniff" } });
}
