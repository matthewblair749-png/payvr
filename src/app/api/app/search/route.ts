import { RateLimitError, rateLimit } from "@/server/rate-limit";
import { searchWorkspace } from "@/server/dal/search";
import { merchantForAction } from "@/server/dal/session";

/** GET /api/app/search?q= — the top bar's ⌘K palette. */
export async function GET(req: Request) {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in to search" }, { status: 401 });
  }
  try {
    rateLimit(`search:${merchant.id}`, 120, 60_000);
  } catch (e) {
    if (e instanceof RateLimitError) return Response.json({ error: e.message }, { status: 429 });
    throw e;
  }
  const q = new URL(req.url).searchParams.get("q") ?? "";
  const hits = await searchWorkspace(merchant.id, q, merchant.defaultCurrency);
  return Response.json({ hits }, { headers: { "cache-control": "private, no-store" } });
}
