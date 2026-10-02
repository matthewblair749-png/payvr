import { cookies } from "next/headers";
import { homeMode, canWrite } from "@/server/dal/home-source";
import { TZ_COOKIE } from "@/components/app-shell/greeting";
import { merchantForAction } from "@/server/dal/session";
import { UserError } from "@/server/errors";
import { getBrief } from "@/server/home/brief";
import { LIMITS, RateLimitError, rateLimit } from "@/server/rate-limit";
import { createProposal, startProposal } from "@/server/research/proposals";

/**
 * POST /api/app/brief/start-test — the brief's one-click test. The test comes
 * from today's stored brief facts (never from the request body), then goes
 * through the same proposal checks as every other test.
 */
export async function POST() {
  let merchant;
  try {
    merchant = await merchantForAction();
    rateLimit(`mutate:${merchant.id}`, LIMITS.mutate.limit, LIMITS.mutate.windowMs);
  } catch (e) {
    if (e instanceof RateLimitError) return Response.json({ error: e.message }, { status: 429 });
    return Response.json({ error: "Sign in" }, { status: 401 });
  }
  try {
    const tz = decodeURIComponent((await cookies()).get(TZ_COOKIE)?.value ?? "UTC");
    if (!canWrite(await homeMode(merchant))) throw new UserError("Tests can't be started on sample data.");
    const brief = await getBrief(merchant.id, merchant.defaultCurrency, tz);
    const s = brief?.facts.suggestion;
    if (!s || brief.actions[0].kind !== "start_test") throw new UserError("There's no test to start from today's brief.");
    const proposal = await createProposal(merchant.id, { ...s, metric: "conversion", source: "insight" });
    const started = await startProposal(merchant.id, proposal.id);
    return Response.json({ experimentId: started.experimentId });
  } catch (e) {
    if (e instanceof UserError) return Response.json({ error: e.message }, { status: 409 });
    throw e;
  }
}
