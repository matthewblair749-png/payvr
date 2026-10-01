import { recentSales } from "@/server/dal/activity";
import { merchantOr401, noStore } from "@/server/dal/guard";

/** GET /api/app/feed — the latest sales, polled by Home's live feed. */
export async function GET() {
  const { merchant, error } = await merchantOr401();
  if (!merchant) return error;
  return Response.json({ sales: await recentSales(merchant.id) }, noStore);
}
