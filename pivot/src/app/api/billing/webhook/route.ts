import type Stripe from "stripe";
import { db } from "@/server/db";
import { getStripe, planForPrice, stripeConfigured } from "@/server/billing/stripe";

/**
 * Stripe webhooks: keep each company's plan in sync with its subscription.
 * Signature-verified; idempotent (every handler sets state, never increments).
 */
export async function POST(request: Request) {
  if (!stripeConfigured()) return new Response("Billing is not configured", { status: 404 });
  const sig = request.headers.get("stripe-signature");
  if (!sig) return new Response("Missing signature", { status: 400 });
  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(await request.text(), sig, process.env.STRIPE_WEBHOOK_SECRET!);
  } catch {
    return new Response("Invalid signature", { status: 400 });
  }

  try {
    if (event.type === "checkout.session.completed") {
      const s = event.data.object;
      const companyId = s.metadata?.companyId ?? s.client_reference_id;
      const plan = s.metadata?.plan === "BUSINESS" ? "BUSINESS" : "PRO";
      if (companyId && s.mode === "subscription") {
        const subscriptionId = typeof s.subscription === "string" ? s.subscription : (s.subscription?.id ?? null);
        // Safety net: never leave an older subscription billing alongside the new one.
        const previous = await db.company.findUnique({ where: { id: companyId }, select: { stripeSubscriptionId: true } });
        if (previous?.stripeSubscriptionId && previous.stripeSubscriptionId !== subscriptionId) {
          await getStripe()
            .subscriptions.cancel(previous.stripeSubscriptionId, { prorate: true })
            .catch((e) => console.error("[pivot] couldn't cancel the previous subscription", previous.stripeSubscriptionId, e));
        }
        await db.company.updateMany({
          where: { id: companyId },
          data: {
            plan,
            stripeCustomerId: typeof s.customer === "string" ? s.customer : (s.customer?.id ?? null),
            stripeSubscriptionId: subscriptionId,
            subscriptionStatus: "active",
            trialEndsAt: null,
          },
        });
      }
    } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.created") {
      const sub = event.data.object;
      const plan = planForPrice(sub.items.data[0]?.price.id);
      const active = sub.status === "active" || sub.status === "trialing" || sub.status === "past_due";
      await db.company.updateMany({
        where: { stripeSubscriptionId: sub.id },
        data: { subscriptionStatus: sub.status, ...(plan && active ? { plan } : {}), ...(!active ? { plan: "FREE" } : {}) },
      });
    } else if (event.type === "customer.subscription.deleted") {
      const sub = event.data.object;
      await db.company.updateMany({ where: { stripeSubscriptionId: sub.id }, data: { plan: "FREE", subscriptionStatus: "canceled", stripeSubscriptionId: null } });
    }
  } catch (e) {
    console.error("[pivot] webhook handling failed", e);
    return new Response("Handler error", { status: 500 });
  }
  return new Response("ok");
}
