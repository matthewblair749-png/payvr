import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { createOnboardingLink } from "@/server/payments/connect";

/**
 * Stripe sends merchants here when an onboarding link expires or is reused.
 * We mint a fresh link and send them straight back to Stripe.
 */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login?next=/studio/payments");
  const merchant = await db.merchant.findUnique({ where: { userId: session.user.id } });
  if (!merchant) redirect("/studio");
  const url = await createOnboardingLink(merchant.id, {
    email: session.user.email,
    appUrl: (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, ""),
  });
  redirect(url);
}
