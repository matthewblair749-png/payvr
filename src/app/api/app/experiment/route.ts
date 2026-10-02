import { experimentCard } from "@/server/dal/activity";
import { homeMode } from "@/server/dal/home-source";
import { merchantOr401, noStore } from "@/server/dal/guard";

/** GET /api/app/experiment — the active (or most recent) test for Home's card. */
export async function GET() {
  const { merchant, error } = await merchantOr401();
  if (!merchant) return error;
  const mode = await homeMode(merchant);
  return Response.json({ experiment: await experimentCard(mode.dataMerchantId ?? merchant.id) }, noStore);
}
