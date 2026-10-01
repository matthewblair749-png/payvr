import { ingestSchema } from "@/lib/tracking/events";
import { db } from "@/server/db";
import { RateLimitError, rateLimit } from "@/server/rate-limit";
import { clientIpFromHeaders, countryFromHeaders, deviceFromUA } from "@/server/request-meta";

/**
 * POST /api/events — checkout analytics ingest (sendBeacon-friendly).
 *
 * The client only says *what happened*. Merchant, device and country are
 * derived here; the variant is accepted only if it belongs to the page's
 * running experiment. Unknown/unpublished pages are dropped silently.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  const text = await req.text();
  if (text.length > 16_000) return new Response(null, { status: 413 });

  let payload;
  try {
    payload = ingestSchema.parse(JSON.parse(text));
  } catch {
    return new Response(null, { status: 400 });
  }

  try {
    rateLimit(`events-ip:${clientIpFromHeaders(req.headers)}`, 600, 10 * 60_000);
    rateLimit(`events-session:${payload.sessionId}`, 120, 10 * 60_000);
  } catch (e) {
    if (e instanceof RateLimitError) return new Response(null, { status: 429 });
    throw e;
  }

  const page = await db.checkoutPage.findFirst({
    where: { id: payload.pageId, status: "PUBLISHED" },
    select: {
      merchantId: true,
      experiments: { where: { status: "RUNNING" }, select: { variants: { select: { id: true } } } },
    },
  });
  if (!page) return new Response(null, { status: 204 });

  const validVariants = new Set(page.experiments.flatMap((e) => e.variants.map((v) => v.id)));
  const variantId = payload.variantId && validVariants.has(payload.variantId) ? payload.variantId : null;
  const device = deviceFromUA(req.headers.get("user-agent"));
  const country = countryFromHeaders(req.headers);

  // One VIEW per session, even if the tab is reloaded.
  let events = payload.events;
  if (events.some((e) => e.type === "VIEW")) {
    const already = await db.checkoutEvent.count({ where: { sessionId: payload.sessionId, type: "VIEW" } });
    if (already) events = events.filter((e) => e.type !== "VIEW");
  }
  if (!events.length) return new Response(null, { status: 204 });

  // Explicit, strictly increasing timestamps keep in-batch order (a DB default
  // would give every row the same time, making "last field touched" ambiguous).
  const base = Date.now();
  await db.checkoutEvent.createMany({
    data: events.map((e, i) => ({
      createdAt: new Date(base + i),
      merchantId: page.merchantId,
      checkoutPageId: payload.pageId,
      variantId,
      sessionId: payload.sessionId,
      type: e.type,
      step: e.step ?? null,
      field: e.field ?? null,
      device,
      country,
    })),
  });
  return new Response(null, { status: 204 });
}
