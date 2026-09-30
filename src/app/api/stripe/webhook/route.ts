import Stripe from "stripe";
import { handleStripeEvent } from "@/server/payments/webhooks";

/**
 * POST /api/stripe/webhook
 *
 * Verifies the Stripe-Signature header against the raw body before touching
 * anything. Accepts two secrets: the platform endpoint (payments, refunds,
 * disputes) and, optionally, the Connect endpoint (account.updated).
 */
export const runtime = "nodejs";

// Signature verification is local HMAC; this instance never makes API calls.
const verifier = new Stripe("sk_test_signature_verification_only").webhooks;

export async function POST(req: Request) {
  const signature = req.headers.get("stripe-signature");
  const secrets = [process.env.STRIPE_WEBHOOK_SECRET, process.env.STRIPE_CONNECT_WEBHOOK_SECRET].filter(
    (s): s is string => Boolean(s),
  );
  if (!signature || secrets.length === 0) return Response.json({ error: "Webhook not configured" }, { status: 400 });

  // Must be the exact raw bytes Stripe signed.
  const body = await req.text();
  if (body.length > 512_000) return Response.json({ error: "Payload too large" }, { status: 413 });

  let event: Stripe.Event | null = null;
  for (const secret of secrets) {
    try {
      event = await verifier.constructEventAsync(body, signature, secret);
      break;
    } catch {
      /* try the next secret */
    }
  }
  if (!event) return Response.json({ error: "Invalid signature" }, { status: 400 });

  try {
    const outcome = await handleStripeEvent(event);
    return Response.json({ received: true, outcome });
  } catch (e) {
    console.error(`[stripe webhook] ${event.type} ${event.id} failed`, e);
    // 500 → Stripe retries with backoff.
    return Response.json({ error: "Processing failed" }, { status: 500 });
  }
}
