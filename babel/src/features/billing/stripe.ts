import "server-only";
import Stripe from "stripe";

let client: Stripe | null = null;

export class BillingNotConfiguredError extends Error {
  constructor() {
    super("Stripe isn't configured. Set STRIPE_SECRET_KEY.");
    this.name = "BillingNotConfiguredError";
  }
}

export function billingConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Shared Stripe client. Pinned to the API version this code was written for. */
export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new BillingNotConfiguredError();
  client = new Stripe(key, { apiVersion: "2026-08-26.dahlia", appInfo: { name: "babel" } });
  return client;
}
