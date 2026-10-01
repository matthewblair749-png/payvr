import { cookies } from "next/headers";
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
  const brief = await getBrief(merchant.id, merchant.defaultCurrency, tz);
  return Response.json({ brief }, { headers: { "cache-control": "private, no-store" } });
}
