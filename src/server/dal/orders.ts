import "server-only";
import { db } from "../db";
import { UserError } from "../errors";
import { getStripe } from "../stripe";
import { NotFoundError } from "./checkout-pages";

/** Merchant-scoped order reads and actions. */

export async function listOrders(merchantId: string, take = 50) {
  return db.order.findMany({
    where: { merchantId, status: { not: "PENDING" } },
    orderBy: { createdAt: "desc" },
    take,
    include: { product: { select: { name: true } }, checkoutPage: { select: { name: true, slug: true } } },
  });
}

/**
 * Full refund of whatever hasn't been refunded yet. The webhook
 * (charge.refunded) is the source of truth; we also record Stripe's
 * immediate answer so the UI updates without waiting.
 */
export async function refundOrder(merchantId: string, orderId: string) {
  const order = await db.order.findFirst({ where: { id: orderId, merchantId } });
  if (!order) throw new NotFoundError("Order not found");
  if (!order.stripePaymentIntentId || !["SUCCEEDED", "PARTIALLY_REFUNDED"].includes(order.status)) {
    throw new UserError("Only paid orders can be refunded.");
  }
  const remaining = order.amountCents - order.refundedCents;
  if (remaining <= 0) throw new UserError("This order is already fully refunded.");

  const refund = await getStripe().refunds.create(
    {
      payment_intent: order.stripePaymentIntentId,
      amount: remaining,
      // Destination charge: pull the funds back from the merchant's account…
      reverse_transfer: true,
      // …and return lumen's fee too. Refunds shouldn't cost the buyer or merchant a platform fee.
      refund_application_fee: true,
      metadata: { lumen_order_id: order.id },
    },
    { idempotencyKey: `refund_${order.id}_${order.refundedCents}` },
  );
  if (refund.status === "succeeded" || refund.status === "pending") {
    await db.order.update({
      where: { id: order.id },
      data: { refundedCents: order.refundedCents + refund.amount, status: "REFUNDED" },
    });
  }
  return refund.status;
}

/** The merchant's first sale, if it hasn't been celebrated yet. */
export async function uncelebratedFirstSale(merchantId: string) {
  const merchant = await db.merchant.findUnique({
    where: { id: merchantId },
    select: { firstSaleAt: true, firstSaleCelebratedAt: true },
  });
  if (!merchant?.firstSaleAt || merchant.firstSaleCelebratedAt) return null;
  const order = await db.order.findFirst({
    where: { merchantId, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] } },
    orderBy: { paidAt: "asc" },
    include: { product: { select: { name: true } } },
  });
  if (!order) return null;
  return {
    amountCents: order.amountCents,
    currency: order.currency.toUpperCase(),
    productName: order.product?.name ?? "your product",
    country: order.country,
  };
}

export async function markFirstSaleCelebrated(merchantId: string) {
  await db.merchant.update({ where: { id: merchantId }, data: { firstSaleCelebratedAt: new Date() } });
}
