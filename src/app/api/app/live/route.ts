import { liveStatus } from "@/server/dal/orders";
import { merchantForAction } from "@/server/dal/session";

/** GET /api/app/live — recent paid orders, for the top bar's "Live" pulse. */
export async function GET() {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in" }, { status: 401 });
  }
  return Response.json(await liveStatus(merchant.id), { headers: { "cache-control": "private, no-store" } });
}
