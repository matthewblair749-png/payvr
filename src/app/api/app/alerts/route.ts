import { criticalAlerts } from "@/server/dal/alerts";
import { merchantOr401, noStore } from "@/server/dal/guard";

/** GET /api/app/alerts — critical alerts only (failure spike, disputes, paused payouts). */
export async function GET() {
  const { merchant, error } = await merchantOr401();
  if (!merchant) return error;
  return Response.json({ alerts: await criticalAlerts(merchant) }, noStore);
}
