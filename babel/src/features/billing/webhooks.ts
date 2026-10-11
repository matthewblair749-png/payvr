import "server-only";
import type Stripe from "stripe";
import { PAYMENT_GRACE_PERIOD_DAYS, parseLookupKey } from "@/config/plans";
import { Prisma } from "@/generated/prisma/client";
import type { Db } from "@/server/db";

/**
 * Stripe webhook handling.
 *
 * Idempotent in two layers:
 * 1. Every processed event id is recorded in StripeEvent inside the same
 *    transaction as its changes. A redelivered event is skipped; a failed one
 *    rolls back completely so Stripe's retry starts clean.
 * 2. Subscription rows remember the creation time of the last event applied
 *    (stripeEventAt). An older event arriving late is ignored, so delivery
 *    order can't roll a subscription back.
 */

export const HANDLED_EVENTS = [
  "checkout.session.completed",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
] as const;

export type WebhookOutcome = "processed" | "duplicate" | "ignored" | "stale";

export interface WebhookDeps {
  db: Db;
  /** Fetches a subscription from Stripe (injected so tests don't hit the API). */
  retrieveSubscription: (id: string) => Promise<Stripe.Subscription>;
}

const DAY_MS = 24 * 60 * 60 * 1000;
const ENDED = new Set(["canceled", "incomplete_expired"]);

/** Grace periods start when Stripe saw the failure, not when we heard about it. */
function graceEnd(failedAt: Date): Date {
  return new Date(failedAt.getTime() + PAYMENT_GRACE_PERIOD_DAYS * DAY_MS);
}

/** The subscription fields we mirror, read from a Stripe Subscription. */
export function mirrorFields(sub: Stripe.Subscription) {
  const item = sub.items.data[0];
  if (!item) throw new Error(`Subscription ${sub.id} has no items`);
  const parsed = parseLookupKey(item.price.lookup_key);
  if (!parsed) {
    // Not one of our prices. Throwing makes Stripe retry, which surfaces the
    // misconfiguration in the dashboard instead of silently granting nothing.
    throw new Error(`Subscription ${sub.id} uses a price without a babel lookup key`);
  }
  return {
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer.id,
    plan: parsed.plan,
    interval: parsed.interval,
    seats: item.quantity ?? 1,
    status: sub.status,
    // Since API version 2025-03-31 the billing period lives on the item.
    currentPeriodEnd: new Date(item.current_period_end * 1000),
    cancelAtPeriodEnd: sub.cancel_at_period_end || sub.cancel_at !== null,
  };
}

function idOf(value: string | { id: string } | null | undefined): string | null {
  if (!value) return null;
  return typeof value === "string" ? value : value.id;
}

/** Which of our users a Stripe subscription belongs to. */
async function findUserId(db: Prisma.TransactionClient, sub: Stripe.Subscription, hint?: string | null): Promise<string | null> {
  const candidates = [hint, sub.metadata?.userId].filter((v): v is string => Boolean(v));
  for (const id of candidates) {
    const user = await db.user.findUnique({ where: { id }, select: { id: true } });
    if (user) return user.id;
  }
  const customerId = idOf(sub.customer);
  if (customerId) {
    const user = await db.user.findUnique({ where: { stripeCustomerId: customerId }, select: { id: true } });
    if (user) return user.id;
  }
  return null;
}

/**
 * Writes Stripe's view of a subscription onto our row, unless we've already
 * applied a newer event. Returns false when the event was stale.
 */
async function applySubscription(
  tx: Prisma.TransactionClient,
  sub: Stripe.Subscription,
  eventAt: Date,
  userHint?: string | null,
): Promise<boolean> {
  const existing = await tx.subscription.findUnique({ where: { stripeSubscriptionId: sub.id } });
  if (existing && existing.stripeEventAt > eventAt) return false;

  const userId = existing?.userId ?? (await findUserId(tx, sub, userHint));
  if (!userId) throw new Error(`No user found for subscription ${sub.id}`);

  const fields = mirrorFields(sub);

  // Late news about an old, finished subscription must not replace the one
  // the user has now (e.g. they cancelled, then subscribed again).
  if (!existing && ENDED.has(fields.status)) {
    const current = await tx.subscription.findUnique({ where: { userId }, select: { status: true } });
    if (current && !ENDED.has(current.status)) return false;
  }

  // Payment state: clear it once Stripe says the subscription is healthy again,
  // and start a grace period if Stripe reports trouble before the invoice event.
  let payment: { paymentFailedAt: Date | null; graceEndsAt: Date | null };
  if (fields.status === "active" || fields.status === "trialing") {
    payment = { paymentFailedAt: null, graceEndsAt: null };
  } else if ((fields.status === "past_due" || fields.status === "unpaid") && !existing?.paymentFailedAt) {
    payment = { paymentFailedAt: eventAt, graceEndsAt: graceEnd(eventAt) };
  } else {
    payment = { paymentFailedAt: existing?.paymentFailedAt ?? null, graceEndsAt: existing?.graceEndsAt ?? null };
  }

  const data = { ...fields, ...payment, stripeEventAt: eventAt };

  // One subscription per user: a new subscription replaces the old row.
  await tx.subscription.upsert({
    where: { userId },
    create: { userId, stripeSubscriptionId: sub.id, ...data },
    update: { stripeSubscriptionId: sub.id, ...data },
  });
  await tx.user.update({ where: { id: userId }, data: { stripeCustomerId: fields.stripeCustomerId } });
  return true;
}

export async function handleStripeEvent(event: Stripe.Event, deps: WebhookDeps): Promise<WebhookOutcome> {
  const { db } = deps;
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return "ignored";

  // Fast path for redeliveries.
  if (await db.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } })) return "duplicate";

  const eventAt = new Date(event.created * 1000);

  // Anything that needs the Stripe API happens before the transaction opens,
  // so a slow network call never holds database locks.
  let subscription: Stripe.Subscription | null = null;
  let userHint: string | null = null;
  let failedSubscriptionId: string | null = null;

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      if (session.mode !== "subscription") return "ignored";
      const subId = idOf(session.subscription);
      if (!subId) return "ignored";
      subscription = await deps.retrieveSubscription(subId);
      userHint = session.client_reference_id;
      break;
    }
    case "customer.subscription.updated":
    case "customer.subscription.deleted":
      subscription = event.data.object;
      break;
    case "invoice.payment_failed": {
      const invoice = event.data.object;
      failedSubscriptionId = idOf(invoice.parent?.subscription_details?.subscription);
      if (!failedSubscriptionId) return "ignored";
      // If this arrives before we've seen the subscription, fetch it first.
      const known = await db.subscription.findUnique({ where: { stripeSubscriptionId: failedSubscriptionId }, select: { id: true } });
      if (!known) subscription = await deps.retrieveSubscription(failedSubscriptionId);
      break;
    }
  }

  try {
    return await db.$transaction(async (tx) => {
      // Claims the event. A concurrent duplicate fails here and rolls back.
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });

      let applied = true;
      if (subscription) applied = await applySubscription(tx, subscription, eventAt, userHint);

      if (failedSubscriptionId) {
        const row = await tx.subscription.findUnique({ where: { stripeSubscriptionId: failedSubscriptionId } });
        if (row && !row.paymentFailedAt) {
          await tx.subscription.update({
            where: { id: row.id },
            data: {
              paymentFailedAt: eventAt,
              graceEndsAt: graceEnd(eventAt),
            },
          });
        }
        applied = true;
      }
      return applied ? "processed" : "stale";
    });
  } catch (error) {
    // Two deliveries of the same event racing: the loser hits the unique id.
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      const seen = await db.stripeEvent.findUnique({ where: { id: event.id }, select: { id: true } });
      if (seen) return "duplicate";
    }
    throw error;
  }
}
