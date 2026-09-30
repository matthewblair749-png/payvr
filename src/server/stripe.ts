import "server-only";
import Stripe from "stripe";
import { UserError } from "./errors";

/**
 * Stripe client (platform account).
 *
 * lumen runs in TEST MODE ONLY: live keys are rejected at startup so a
 * misconfigured deploy can never move real money.
 */
let client: Stripe | null = null;

export function stripeConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
}

export function assertTestMode(secret: string | undefined, publishable: string | undefined) {
  if (secret && !secret.startsWith("sk_test_") && !secret.startsWith("rk_test_")) {
    throw new Error("lumen only runs with Stripe TEST keys (sk_test_…). Refusing to start with a live key.");
  }
  if (publishable && !publishable.startsWith("pk_test_")) {
    throw new Error("lumen only runs with Stripe TEST keys (pk_test_…). Refusing to start with a live key.");
  }
}

export function getStripe(): Stripe {
  if (client) return client;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new UserError("Payments aren't configured yet. Add your Stripe test keys.");
  assertTestMode(key, process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY);
  client = new Stripe(key, {
    // Pinned by the SDK (2026-08-26.dahlia); upgrading the SDK is how we upgrade the API.
    maxNetworkRetries: 2,
    appInfo: { name: "lumen", url: "https://lumen.app" },
  });
  return client;
}

/** Test hook: swap in a fake Stripe client. */
export function __setStripeForTests(fake: Stripe | null) {
  client = fake;
}

/** Platform fee in basis points (e.g. 100 = 1%). Defaults to 0. */
export function platformFeeCents(amountCents: number) {
  const bps = Math.max(0, Math.min(2_000, Number(process.env.LUMEN_PLATFORM_FEE_BPS ?? 0) || 0));
  return Math.floor((amountCents * bps) / 10_000);
}
