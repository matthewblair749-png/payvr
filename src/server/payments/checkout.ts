import "server-only";
import type Stripe from "stripe";
import { z } from "zod";
import { computeTotals, MIN_CHARGE_CENTS } from "@/lib/checkout/pricing";
import { db } from "../db";
import { resolveCheckout } from "../dal/public-checkout";
import { UserError } from "../errors";
import { getStripe, platformFeeCents, stripeConfigured } from "../stripe";

/**
 * Buyer-side payment preparation for hosted checkouts.
 *
 * The browser sends only the buyer's *choices*. We re-resolve the published
 * config (and the visitor's A/B variant) on the server, recompute the price
 * with the shared pricing module, and create/update the PaymentIntent.
 * Card details go straight from Stripe's iframe to Stripe — never here.
 */

export const selectionsSchema = z.object({
  upsellAdded: z.boolean(),
  tipPercent: z.number().min(0).max(100),
  couponCode: z.string().trim().max(24).nullable(),
  payIn4: z.boolean(),
});

export const prepareInputSchema = z.object({
  slug: z.string().min(1).max(64),
  sessionId: z.string().uuid(),
  selections: selectionsSchema,
  /** Present when the buyer retries after a decline or changes their cart. */
  orderId: z.string().max(40).nullable(),
  device: z.enum(["mobile", "tablet", "desktop"]).nullable(),
});

export type PreparedPayment = { orderId: string; clientSecret: string; amountCents: number; currency: string };

const REUSABLE: Stripe.PaymentIntent.Status[] = ["requires_payment_method", "requires_confirmation", "requires_action"];

export async function preparePayment(input: z.infer<typeof prepareInputSchema>, visitorId: string): Promise<PreparedPayment> {
  if (!stripeConfigured()) throw new UserError("This checkout isn't taking payments yet.");
  const checkout = await resolveCheckout(input.slug, visitorId);
  if (!checkout) throw new UserError("This checkout isn't available.");
  if (!checkout.acceptsPayments || !checkout.stripeAccountId) throw new UserError("This checkout isn't taking payments yet.");

  const totals = computeTotals(checkout.config, checkout.product, input.selections);
  if (totals.totalCents < MIN_CHARGE_CENTS) throw new UserError("The total is below the minimum charge.");
  const currency = checkout.product.currency.toLowerCase();
  const fee = platformFeeCents(totals.totalCents);
  const stripe = getStripe();

  const metadata = {
    lumen_order_id: "",
    lumen_merchant_id: checkout.merchantId,
    lumen_page_id: checkout.pageId,
    lumen_variant_id: checkout.variantId ?? "",
    lumen_session_id: input.sessionId,
  };
  const orderFields = {
    amountCents: totals.totalCents,
    subtotalCents: totals.subtotalCents,
    tipCents: totals.tipCents,
    discountCents: totals.discountCents,
    applicationFeeCents: fee,
    currency,
    variantId: checkout.variantId,
    device: input.device,
  };

  // Reuse the buyer's existing intent when possible (declined card, changed tip…).
  if (input.orderId) {
    const existing = await db.order.findFirst({
      where: { id: input.orderId, checkoutPageId: checkout.pageId, sessionId: input.sessionId, status: { in: ["PENDING", "FAILED"] } },
    });
    if (existing?.stripePaymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(existing.stripePaymentIntentId);
      if (REUSABLE.includes(pi.status) && pi.currency === currency) {
        const updated =
          pi.amount === totals.totalCents
            ? pi
            : await stripe.paymentIntents.update(pi.id, {
                amount: totals.totalCents,
                ...(fee ? { application_fee_amount: fee } : {}),
              });
        await db.order.update({ where: { id: existing.id }, data: { ...orderFields, status: "PENDING", failureMessage: null } });
        return { orderId: existing.id, clientSecret: updated.client_secret!, amountCents: totals.totalCents, currency };
      }
    }
  }

  const order = await db.order.create({
    data: {
      merchantId: checkout.merchantId,
      checkoutPageId: checkout.pageId,
      productId: await productIdFor(checkout.pageId),
      sessionId: input.sessionId,
      status: "PENDING",
      ...orderFields,
    },
  });

  const pi = await stripe.paymentIntents.create(
    {
      amount: totals.totalCents,
      currency,
      automatic_payment_methods: { enabled: true },
      on_behalf_of: checkout.stripeAccountId,
      transfer_data: { destination: checkout.stripeAccountId },
      ...(fee ? { application_fee_amount: fee } : {}),
      description: `${checkout.config.brand.name}: ${checkout.product.name}`.slice(0, 200),
      metadata: { ...metadata, lumen_order_id: order.id },
    },
    { idempotencyKey: `pi_create_${order.id}` },
  );
  await db.order.update({ where: { id: order.id }, data: { stripePaymentIntentId: pi.id } });
  return { orderId: order.id, clientSecret: pi.client_secret!, amountCents: totals.totalCents, currency };
}

async function productIdFor(pageId: string) {
  const page = await db.checkoutPage.findUnique({ where: { id: pageId }, select: { productId: true } });
  return page?.productId ?? null;
}

/** For the redirect-return page: what happened to this PaymentIntent? */
export async function paymentResult(slug: string, paymentIntentId: string) {
  if (!stripeConfigured() || !/^pi_[A-Za-z0-9]+$/.test(paymentIntentId)) return null;
  const page = await db.checkoutPage.findUnique({ where: { slug }, select: { id: true } });
  if (!page) return null;
  const pi = await getStripe().paymentIntents.retrieve(paymentIntentId);
  // Only reveal intents that belong to this checkout.
  if (pi.metadata?.lumen_page_id !== page.id) return null;
  return { status: pi.status, amountCents: pi.amount, currency: pi.currency };
}
