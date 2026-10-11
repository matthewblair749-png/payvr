import { randomUUID } from "node:crypto";
import type Stripe from "stripe";

/**
 * Minimal Stripe objects with just the fields the webhook reads. Cast through
 * unknown because the real types have dozens of fields we don't use.
 */
export function fakeSubscription(opts: {
  id?: string;
  customer: string;
  userId?: string;
  lookupKey?: string | null;
  status?: Stripe.Subscription.Status;
  quantity?: number;
  periodEnd?: number;
  cancelAtPeriodEnd?: boolean;
}): Stripe.Subscription {
  return {
    id: opts.id ?? `sub_${randomUUID()}`,
    object: "subscription",
    customer: opts.customer,
    status: opts.status ?? "active",
    cancel_at_period_end: opts.cancelAtPeriodEnd ?? false,
    cancel_at: null,
    metadata: opts.userId ? { userId: opts.userId } : {},
    items: {
      object: "list",
      data: [
        {
          id: `si_${randomUUID()}`,
          quantity: opts.quantity ?? 1,
          current_period_end: opts.periodEnd ?? 1_793_000_000,
          price: { id: `price_${randomUUID()}`, lookup_key: opts.lookupKey === undefined ? "babel_plus_monthly" : opts.lookupKey },
        },
      ],
    },
  } as unknown as Stripe.Subscription;
}

let clock = 1_790_000_000;

/** A Stripe event; `created` increases with each call unless given. */
export function fakeEvent<T extends Stripe.Event["type"]>(type: T, object: unknown, created?: number): Stripe.Event {
  clock += 10;
  return {
    id: `evt_${randomUUID()}`,
    object: "event",
    type,
    created: created ?? clock,
    data: { object },
  } as unknown as Stripe.Event;
}

export function fakeCheckoutSession(opts: { subscription: string; customer: string; userId: string }) {
  return {
    id: `cs_${randomUUID()}`,
    object: "checkout.session",
    mode: "subscription",
    subscription: opts.subscription,
    customer: opts.customer,
    client_reference_id: opts.userId,
  };
}

export function fakeFailedInvoice(subscriptionId: string) {
  return {
    id: `in_${randomUUID()}`,
    object: "invoice",
    parent: { type: "subscription_details", subscription_details: { subscription: subscriptionId } },
  };
}
