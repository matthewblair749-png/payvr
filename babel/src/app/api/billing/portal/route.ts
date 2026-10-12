import { NextResponse } from "next/server";
import { currentUserId } from "@/features/auth/auth";
import { appOrigin, portalUrl } from "@/features/billing/checkout";
import { isSameOrigin } from "@/features/billing/same-origin";
import { billingConfigured } from "@/features/billing/stripe";
import { db } from "@/server/db";

/** POST /api/billing/portal: opens Stripe's Customer Portal. */
export async function POST(request: Request) {
  const origin = appOrigin(request);
  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(`${origin}/signin?callbackUrl=${encodeURIComponent("/dashboard")}`, 303);

  const user = await db.user.findUnique({ where: { id: userId }, select: { stripeCustomerId: true } });
  if (!billingConfigured() || !user?.stripeCustomerId) return NextResponse.redirect(`${origin}/dashboard?billing=unavailable`, 303);

  try {
    return NextResponse.redirect(await portalUrl(user.stripeCustomerId, origin), 303);
  } catch (error) {
    console.error("portal failed:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown error");
    return NextResponse.redirect(`${origin}/dashboard?billing=error`, 303);
  }
}
