import "server-only";
import Stripe from "stripe";
import type { PlanId } from "@/lib/billing/plans";

/**
 * Stripe billing. Off unless STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET and at
 * least one price ID are set, so no real payments can happen by accident.
 */
export const PRICE_IDS: Partial<Record<PlanId, string | undefined>> = {
  PRO: process.env.STRIPE_PRICE_PRO,
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS,
};

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.STRIPE_WEBHOOK_SECRET && (PRICE_IDS.PRO || PRICE_IDS.BUSINESS));
}

let client: Stripe | null = null;
export function getStripe(): Stripe {
  if (!process.env.STRIPE_SECRET_KEY) throw new Error("Stripe is not configured");
  return (client ??= new Stripe(process.env.STRIPE_SECRET_KEY, { maxNetworkRetries: 2 }));
}

export function planForPrice(priceId: string | null | undefined): PlanId | null {
  if (!priceId) return null;
  if (priceId === PRICE_IDS.PRO) return "PRO";
  if (priceId === PRICE_IDS.BUSINESS) return "BUSINESS";
  return null;
}
