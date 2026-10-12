import { NextResponse } from "next/server";
import { userForToken } from "@/features/extension/server/tokens";
import { getUsageSummary } from "@/features/usage/server";
import { db } from "@/server/db";

/** GET /api/extension/me: who the extension is connected as, for the popup. */
export async function GET(request: Request) {
  const userId = await userForToken(db, request.headers.get("authorization"));
  if (!userId) return NextResponse.json({ ok: false, code: "unauthorized" }, { status: 401 });
  const [user, usage] = await Promise.all([db.user.findUniqueOrThrow({ where: { id: userId }, select: { email: true } }), getUsageSummary(db, userId)]);
  return NextResponse.json({
    ok: true,
    email: user.email,
    plan: usage.entitlement.plan.name,
    translations: { used: usage.translations.used, limit: usage.translations.limit },
  });
}
