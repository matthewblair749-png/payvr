import { parseRange, rangeDays } from "@/lib/date-range";
import { homeMode } from "@/server/dal/home-source";
import { funnelOverview } from "@/server/dal/funnel";
import { merchantForAction } from "@/server/dal/session";

/** GET /api/app/funnel?range= — Home's checkout funnel. */
export async function GET(req: Request) {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in to see your funnel" }, { status: 401 });
  }
  const range = parseRange(new URL(req.url).searchParams.get("range"));
  const mode = await homeMode(merchant);
  const data = await funnelOverview(mode.dataMerchantId ?? merchant.id, mode.currency, rangeDays(range));
  return Response.json(data, { headers: { "cache-control": "private, no-store" } });
}
