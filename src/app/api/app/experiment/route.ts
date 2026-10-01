import { experimentCard } from "@/server/dal/activity";
import { merchantOr401, noStore } from "@/server/dal/guard";

/** GET /api/app/experiment — the active (or most recent) test for Home's card. */
export async function GET() {
  const { merchant, error } = await merchantOr401();
  if (!merchant) return error;
  return Response.json({ experiment: await experimentCard(merchant.id) }, noStore);
}
