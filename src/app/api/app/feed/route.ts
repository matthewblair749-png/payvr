import { recentSales } from "@/server/dal/activity";
import { homeMode } from "@/server/dal/home-source";
import { merchantOr401, noStore } from "@/server/dal/guard";

/** GET /api/app/feed — the latest sales, polled by Home's live feed. */
export async function GET() {
  const { merchant, error } = await merchantOr401();
  if (!merchant) return error;
  const mode = await homeMode(merchant);
  return Response.json({ sales: await recentSales(mode.dataMerchantId ?? merchant.id) }, noStore);
}
