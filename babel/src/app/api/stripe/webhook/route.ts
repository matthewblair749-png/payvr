import Stripe from "stripe";
import { getStripe } from "@/features/billing/stripe";
import { handleStripeEvent } from "@/features/billing/webhooks";
import { db } from "@/server/db";

export const runtime = "nodejs";

// Signature checks are local HMAC, so this instance never calls the API.
const verifier = new Stripe("sk_test_signature_verification_only").webhooks;

/**
 * POST /api/stripe/webhook
 *
 * Verifies the Stripe-Signature header against the raw body before doing
 * anything else. Returns 500 on processing errors so Stripe retries; the
 * handler is idempotent, so retries are safe.
 */
export async function POST(request: Request) {
  const signature = request.headers.get("stripe-signature");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!signature || !secret) return Response.json({ error: "Webhook not configured" }, { status: 400 });

  // Must be the exact bytes Stripe signed.
  const body = await request.text();
  if (body.length > 512_000) return Response.json({ error: "Payload too large" }, { status: 413 });

  let event: Stripe.Event;
  try {
    event = await verifier.constructEventAsync(body, signature, secret);
  } catch {
    return Response.json({ error: "Invalid signature" }, { status: 400 });
  }

  try {
    const outcome = await handleStripeEvent(event, {
      db,
      retrieveSubscription: (id) => getStripe().subscriptions.retrieve(id),
    });
    return Response.json({ received: true, outcome });
  } catch (error) {
    // Event id and type only: never the payload, which holds customer details.
    console.error(`stripe webhook ${event.type} ${event.id} failed:`, error instanceof Error ? error.message : "unknown error");
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
