import { parseRange, rangeDays } from "@/lib/date-range";
import { homeMode } from "@/server/dal/home-source";
import { whyTheyBuy } from "@/server/dal/activity";
import { merchantOr401, noStore } from "@/server/dal/guard";

/** GET /api/app/why?range= — ranked one-tap answers for "Why they buy". */
export async function GET(req: Request) {
  const { merchant, error } = await merchantOr401();
  if (!merchant) return error;
  const days = rangeDays(parseRange(new URL(req.url).searchParams.get("range")));
  const mode = await homeMode(merchant);
  return Response.json({ why: await whyTheyBuy(mode.dataMerchantId ?? merchant.id, days) }, noStore);
}
