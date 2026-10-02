import { cookies } from "next/headers";
import { homeMode, canWrite } from "@/server/dal/home-source";
import { TZ_COOKIE } from "@/components/app-shell/greeting";
import { merchantForAction } from "@/server/dal/session";
import { getBrief } from "@/server/home/brief";

/** GET /api/app/brief — today's morning brief (written once per local day). */
export async function GET() {
  let merchant;
  try {
    merchant = await merchantForAction();
  } catch {
    return Response.json({ error: "Sign in" }, { status: 401 });
  }
  const tz = decodeURIComponent((await cookies()).get(TZ_COOKIE)?.value ?? "UTC");
  const mode = await homeMode(merchant);
  if (!mode.dataMerchantId) return Response.json({ brief: null }, { headers: { "cache-control": "private, no-store" } });
  const brief = await getBrief(mode.dataMerchantId, mode.currency, tz);
  // Sample data is read-only: never offer to start a test on the demo shop.
  if (brief && !canWrite(mode) && brief.actions[0].kind === "start_test") {
    brief.actions = [brief.actions[1], { kind: "ask", label: "Ask lumen what to try", question: "What should I test first?" }];
  }
  return Response.json({ brief }, { headers: { "cache-control": "private, no-store" } });
}
