import { parseRange, rangeDays } from "@/lib/date-range";
import { homeMode } from "@/server/dal/home-source";
import { homeOverview } from "@/server/dal/home";
import { merchantForAction } from "@/server/dal/session";

/** GET /api/app/home?range=7|30|90 — North Star + KPI tiles for Home. */
export async function GET(req: Request) {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in to see your numbers" }, { status: 401 });
  }
  const range = parseRange(new URL(req.url).searchParams.get("range"));
  const mode = await homeMode(merchant);
  const data = await homeOverview(mode.dataMerchantId ?? merchant.id, mode.currency, rangeDays(range));
  return Response.json(data, { headers: { "cache-control": "private, no-store" } });
}
