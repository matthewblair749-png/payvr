import { NextResponse } from "next/server";
import { currentUserId } from "@/features/auth/auth";
import { appOrigin, checkoutSchema, startCheckout } from "@/features/billing/checkout";
import { isSameOrigin } from "@/features/billing/same-origin";
import { billingConfigured } from "@/features/billing/stripe";
import { db } from "@/server/db";

/** POST /api/billing/checkout (form post from the pricing page). */
export async function POST(request: Request) {
  const origin = appOrigin(request);
  const back = (query: string) => NextResponse.redirect(`${origin}/pricing?${query}`, 303);

  if (!isSameOrigin(request)) return NextResponse.json({ error: "Cross-site request refused" }, { status: 403 });

  const userId = await currentUserId();
  if (!userId) return NextResponse.redirect(`${origin}/signup?callbackUrl=${encodeURIComponent("/pricing")}`, 303);

  if (!billingConfigured()) return back("checkout=unavailable");

  const parsed = checkoutSchema.safeParse(Object.fromEntries(await request.formData()));
  if (!parsed.success) return back("checkout=invalid");

  try {
    const result = await startCheckout(db, userId, parsed.data, origin);
    if (result.kind === "price_missing") {
      console.error(`checkout: no active Stripe price for plan=${parsed.data.plan} interval=${parsed.data.interval}`);
      return back("checkout=unavailable");
    }
    return NextResponse.redirect(result.url, 303);
  } catch (error) {
    console.error("checkout failed:", error instanceof Error ? `${error.name}: ${error.message}` : "unknown error");
    return back("checkout=error");
  }
}
