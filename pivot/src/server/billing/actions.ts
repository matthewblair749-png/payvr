"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { db } from "../db";
import { appUrl } from "../email";
import { toActionError, UserError, type ActionResult } from "../errors";
import { LIMITS, rateLimit } from "../rate-limit";
import { requireRole, workspaceForAction } from "../workspace";
import { getStripe, PRICE_IDS, stripeConfigured } from "./stripe";

/** Subscription states where the subscription still exists and bills (or will). */
const LIVE = new Set(["active", "trialing", "past_due", "unpaid", "incomplete", "paused"]);

/**
 * Start a Stripe Checkout subscription for Pro or Business, or, when the
 * company already has a subscription, change that one's plan. (A second
 * Checkout would open a second subscription and keep billing the first.)
 */
export async function startCheckout(companyId: string, plan: string): Promise<ActionResult> {
  let url: string;
  try {
    const ws = await workspaceForAction(companyId);
    requireRole(ws, ["OWNER"], "change the plan");
    rateLimit(`billing:${ws.company.id}`, LIMITS.mutate);
    const p = z.enum(["PRO", "BUSINESS"]).parse(plan);
    if (!stripeConfigured()) throw new UserError("Payments aren't switched on in this environment yet. Your plan hasn't changed.");
    const price = PRICE_IDS[p];
    if (!price) throw new UserError("That plan isn't available to buy online yet. Contact sales@pivot.app.");
    const company = await db.company.findUniqueOrThrow({ where: { id: ws.company.id }, select: { stripeCustomerId: true, stripeSubscriptionId: true, subscriptionStatus: true } });
    if (company.stripeSubscriptionId && LIVE.has(company.subscriptionStatus ?? "active")) {
      if (company.subscriptionStatus !== "active" && company.subscriptionStatus !== "trialing" && company.subscriptionStatus !== null) {
        throw new UserError("Your subscription has a payment problem. Use Manage billing to fix it before changing plans.");
      }
      const stripe = getStripe();
      const sub = await stripe.subscriptions.retrieve(company.stripeSubscriptionId);
      const item = sub.items.data[0];
      if (!item) throw new Error("Subscription has no items");
      // The customer.subscription.updated webhook moves the company to the new plan.
      await stripe.subscriptions.update(sub.id, {
        items: [{ id: item.id, price }],
        proration_behavior: "create_prorations",
        metadata: { companyId: ws.company.id, plan: p },
      });
      url = appUrl("/app/settings/billing?checkout=changed");
    } else {
      const session = await getStripe().checkout.sessions.create({
        mode: "subscription",
        line_items: [{ price, quantity: 1 }],
        ...(company.stripeCustomerId ? { customer: company.stripeCustomerId } : { customer_email: ws.user.email }),
        client_reference_id: ws.company.id,
        metadata: { companyId: ws.company.id, plan: p },
        subscription_data: { metadata: { companyId: ws.company.id, plan: p } },
        allow_promotion_codes: true,
        success_url: appUrl("/app/settings/billing?checkout=success"),
        cancel_url: appUrl("/app/settings/billing?checkout=cancelled"),
      });
      if (!session.url) throw new Error("Checkout session has no URL");
      url = session.url;
    }
  } catch (e) {
    return toActionError(e, "We couldn't start checkout. Please try again.");
  }
  redirect(url);
}

/** Stripe's customer portal: update card, see invoices, cancel. */
export async function openBillingPortal(companyId: string): Promise<ActionResult> {
  let url: string;
  try {
    const ws = await workspaceForAction(companyId);
    requireRole(ws, ["OWNER"], "manage billing");
    if (!stripeConfigured()) throw new UserError("Payments aren't switched on in this environment yet.");
    const company = await db.company.findUniqueOrThrow({ where: { id: ws.company.id }, select: { stripeCustomerId: true } });
    if (!company.stripeCustomerId) throw new UserError("There's no subscription to manage yet.");
    const portal = await getStripe().billingPortal.sessions.create({ customer: company.stripeCustomerId, return_url: appUrl("/app/settings/billing") });
    url = portal.url;
  } catch (e) {
    return toActionError(e, "We couldn't open billing. Please try again.");
  }
  redirect(url);
}
