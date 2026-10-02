import "server-only";
import type Stripe from "stripe";
import { Prisma } from "@/generated/prisma/client";
import type { OrderStatus } from "@/generated/prisma/enums";
import { db } from "../db";
import { applyAccountUpdate } from "./connect";

/**
 * Stripe webhook processing.
 *
 * - Idempotent: each event id is recorded in StripeEvent in the SAME
 *   transaction as its effects. A redelivered event hits the unique key and
 *   is skipped; a failed one rolls back so Stripe's retry can succeed.
 * - Order-safe: Stripe doesn't guarantee delivery order, so every transition
 *   is guarded (e.g. a late `payment_failed` can't downgrade a paid order).
 */

type Tx = Prisma.TransactionClient;
export type WebhookOutcome = "processed" | "duplicate" | "ignored";

export const HANDLED_EVENTS = [
  "payment_intent.succeeded",
  "payment_intent.payment_failed",
  "charge.succeeded",
  "charge.refunded",
  "charge.dispute.created",
  "charge.dispute.closed",
  "account.updated",
] as const;

export async function handleStripeEvent(event: Stripe.Event): Promise<WebhookOutcome> {
  if (!(HANDLED_EVENTS as readonly string[]).includes(event.type)) return "ignored";
  // account.updated has no order side effects and is naturally idempotent.
  if (event.type === "account.updated") {
    await applyAccountUpdate(event.data.object as Stripe.Account);
    return "processed";
  }
  try {
    await db.$transaction(async (tx) => {
      await tx.stripeEvent.create({ data: { id: event.id, type: event.type } });
      await apply(tx, event);
    });
    return "processed";
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") return "duplicate";
    throw e;
  }
}

async function apply(tx: Tx, event: Stripe.Event) {
  switch (event.type) {
    case "payment_intent.succeeded":
      return onPaymentSucceeded(tx, event.data.object);
    case "payment_intent.payment_failed":
      return onPaymentFailed(tx, event.data.object);
    case "charge.succeeded":
      return onChargeSucceeded(tx, event.data.object);
    case "charge.refunded":
      return onChargeRefunded(tx, event.data.object);
    case "charge.dispute.created":
      return onDispute(tx, event.data.object, "created");
    case "charge.dispute.closed":
      return onDispute(tx, event.data.object, "closed");
  }
}

const idOf = (v: string | { id: string } | null | undefined) => (typeof v === "string" ? v : (v?.id ?? null));

async function orderForIntent(tx: Tx, pi: string | null) {
  return pi ? tx.order.findUnique({ where: { stripePaymentIntentId: pi } }) : null;
}

async function onPaymentSucceeded(tx: Tx, pi: Stripe.PaymentIntent) {
  const order = await orderForIntent(tx, pi.id);
  if (!order) return; // not a lumen checkout payment
  const paidAt = new Date();

  // Never overwrite a later state (refund/dispute) with "succeeded".
  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
    data: { status: "SUCCEEDED", amountCents: pi.amount_received || pi.amount, paidAt, failureMessage: null },
  });
  if (!count) return;

  // First sale → triggers the merchant's celebration in the Studio.
  await tx.merchant.updateMany({ where: { id: order.merchantId, firstSaleAt: null }, data: { firstSaleAt: paidAt } });

  if (order.checkoutPageId && order.sessionId) {
    await tx.checkoutEvent.create({
      data: {
        merchantId: order.merchantId,
        checkoutPageId: order.checkoutPageId,
        variantId: order.variantId,
        sessionId: order.sessionId,
        type: "PAYMENT_SUCCEEDED",
        step: "paid",
        paymentMethod: order.paymentMethod,
        device: order.device,
        country: order.country,
      },
    });
  }
}

async function onPaymentFailed(tx: Tx, pi: Stripe.PaymentIntent) {
  const order = await orderForIntent(tx, pi.id);
  if (!order) return;
  // Failed attempts matter for "payment method performance by country".
  const pm = pi.last_payment_error?.payment_method;
  const method = pm?.card?.wallet?.type ?? pm?.type ?? null;
  const country = pm?.card?.country ?? pm?.billing_details?.address?.country ?? null;
  const { count } = await tx.order.updateMany({
    where: { id: order.id, status: { in: ["PENDING", "FAILED"] } },
    data: {
      status: "FAILED",
      failureMessage: pi.last_payment_error?.message?.slice(0, 300) ?? "Payment failed",
      ...(method ? { paymentMethod: method } : {}),
      ...(country ? { country } : {}),
    },
  });
  if (count && order.checkoutPageId && order.sessionId) {
    await tx.checkoutEvent.create({
      data: {
        merchantId: order.merchantId,
        checkoutPageId: order.checkoutPageId,
        variantId: order.variantId,
        sessionId: order.sessionId,
        type: "PAYMENT_FAILED",
        step: "payment",
        paymentMethod: method,
        country,
        device: order.device,
      },
    });
  }
}

/** Charges carry the details we report on: payment method type, wallet, card country. */
async function onChargeSucceeded(tx: Tx, charge: Stripe.Charge) {
  const order = await orderForIntent(tx, idOf(charge.payment_intent));
  if (!order) return;
  const details = charge.payment_method_details;
  const wallet = details?.card?.wallet?.type; // apple_pay, google_pay, link…
  const method = wallet ?? details?.type ?? null;
  const country = details?.card?.country ?? charge.billing_details?.address?.country ?? null;
  await tx.order.update({
    where: { id: order.id },
    data: {
      stripeChargeId: charge.id,
      paymentMethod: method,
      country,
      customerEmail: charge.billing_details?.email ?? charge.receipt_email ?? order.customerEmail,
    },
  });
  // Events can arrive in either order: backfill the analytics event if it already exists.
  if (order.sessionId) {
    await tx.checkoutEvent.updateMany({
      where: { sessionId: order.sessionId, type: "PAYMENT_SUCCEEDED", paymentMethod: null },
      data: { paymentMethod: method, country },
    });
  }
}

async function onChargeRefunded(tx: Tx, charge: Stripe.Charge) {
  const order = await orderForIntent(tx, idOf(charge.payment_intent));
  if (!order) return;
  const refunded = charge.amount_refunded;
  const status: OrderStatus =
    order.status === "DISPUTED" ? "DISPUTED" : refunded >= charge.amount ? "REFUNDED" : refunded > 0 ? "PARTIALLY_REFUNDED" : order.status;
  await tx.order.update({ where: { id: order.id }, data: { refundedCents: refunded, status } });
}

async function onDispute(tx: Tx, dispute: Stripe.Dispute, phase: "created" | "closed") {
  const order = await orderForIntent(tx, idOf(dispute.payment_intent));
  if (!order) return;
  if (phase === "created") {
    await tx.order.update({ where: { id: order.id }, data: { status: "DISPUTED" } });
    return;
  }
  if (dispute.status === "won") {
    await tx.order.update({
      where: { id: order.id },
      data: { status: order.refundedCents > 0 ? "PARTIALLY_REFUNDED" : "SUCCEEDED" },
    });
  } else if (dispute.status === "lost") {
    await tx.order.update({ where: { id: order.id }, data: { status: "REFUNDED", refundedCents: order.amountCents } });
  }
}
