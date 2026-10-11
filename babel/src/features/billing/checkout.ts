import "server-only";
import { z } from "zod";
import { PAID_PLAN_IDS, stripeLookupKey, TEAM_SEATS, type PaidPlanId } from "@/config/plans";
import type { Db } from "@/server/db";
import { getStripe } from "./stripe";

export const checkoutSchema = z.object({
  plan: z.enum(PAID_PLAN_IDS as [PaidPlanId, ...PaidPlanId[]]),
  interval: z.enum(["monthly", "annual"]),
  seats: z.coerce.number().int().min(TEAM_SEATS.min).max(TEAM_SEATS.max).optional(),
});
export type CheckoutInput = z.infer<typeof checkoutSchema>;

/** Statuses where the user already has a subscription to manage instead. */
const LIVE_STATUSES = new Set(["active", "trialing", "past_due", "unpaid"]);

export type CheckoutResult = { kind: "redirect"; url: string } | { kind: "price_missing" };

/** The site's own origin for Stripe return URLs. */
export function appOrigin(request: Request): string {
  return process.env.APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
}

/**
 * Starts an upgrade. People who already pay go to the Customer Portal to
 * change plans, so nobody ends up with two subscriptions.
 */
export async function startCheckout(db: Db, userId: string, input: CheckoutInput, origin: string): Promise<CheckoutResult> {
  const stripe = getStripe();
  const user = await db.user.findUniqueOrThrow({ where: { id: userId }, include: { subscription: true } });

  if (user.subscription && LIVE_STATUSES.has(user.subscription.status) && user.stripeCustomerId) {
    return { kind: "redirect", url: await portalUrl(user.stripeCustomerId, origin) };
  }

  const prices = await stripe.prices.list({ lookup_keys: [stripeLookupKey(input.plan, input.interval)], active: true, limit: 1 });
  const price = prices.data[0];
  if (!price) return { kind: "price_missing" };

  let customerId = user.stripeCustomerId;
  if (!customerId) {
    // The idempotency key stops a double click from creating two customers.
    const customer = await stripe.customers.create(
      { email: user.email, metadata: { userId } },
      { idempotencyKey: `babel-customer-${userId}` },
    );
    customerId = customer.id;
    await db.user.update({ where: { id: userId }, data: { stripeCustomerId: customerId } });
  }

  const quantity = input.plan === "teams" ? (input.seats ?? TEAM_SEATS.default) : 1;
  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    client_reference_id: userId,
    line_items: [{ price: price.id, quantity }],
    subscription_data: { metadata: { userId } },
    success_url: `${origin}/dashboard?checkout=success`,
    cancel_url: `${origin}/pricing?checkout=cancelled`,
  });
  if (!session.url) throw new Error("Stripe returned a Checkout session without a URL");
  return { kind: "redirect", url: session.url };
}

/** A Customer Portal link for managing or cancelling a subscription. */
export async function portalUrl(customerId: string, origin: string): Promise<string> {
  const session = await getStripe().billingPortal.sessions.create({ customer: customerId, return_url: `${origin}/dashboard` });
  return session.url;
}
