import { parseRange, rangeDays } from "@/lib/date-range";
import { homeMode } from "@/server/dal/home-source";
import { funnelDrilldown, isStageKey } from "@/server/dal/funnel";
import { merchantForAction } from "@/server/dal/session";

/** GET /api/app/funnel/details?range= — one leak, segmented by device, source, new vs returning and order value. */
export async function GET(req: Request, ctx: RouteContext<"/api/app/funnel/[step]">) {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in to see your funnel" }, { status: 401 });
  }
  const { step } = await ctx.params;
  if (!isStageKey(step)) return Response.json({ error: "Unknown funnel step" }, { status: 404 });
  const range = parseRange(new URL(req.url).searchParams.get("range"));
  const mode = await homeMode(merchant);
  const data = await funnelDrilldown(mode.dataMerchantId ?? merchant.id, mode.currency, rangeDays(range), step);
  return Response.json(data, { headers: { "cache-control": "private, no-store" } });
}
