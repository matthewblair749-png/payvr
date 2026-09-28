// Stripe → Payvr webhook. Verifies the signature, then credits top-ups / updates payouts.
// Deploy with --no-verify-jwt (Stripe signs requests itself; there is no Supabase token).
import Stripe from 'npm:stripe@22.6.2';

import { adminClient, asStripeLike, payvrDb, stripeClient } from '../_shared/http.ts';
import { handleEvent } from '../_shared/payvr-stripe.ts';

Deno.serve(async (req) => {
  const signature = req.headers.get('Stripe-Signature');
  const secret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!signature || !secret) return new Response('missing signature', { status: 400 });

  const stripe = stripeClient();
  const body = await req.text();
  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(body, signature, secret, undefined, Stripe.createSubtleCryptoProvider());
  } catch {
    return new Response('bad signature', { status: 400 });
  }
  try {
    const result = await handleEvent({ stripe: asStripeLike(stripe), db: payvrDb(adminClient()) }, event as never);
    console.log(event.id, result);
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } });
  } catch (e) {
    console.error(event.id, e);
    return new Response('retry later', { status: 500 }); // Stripe retries with backoff.
  }
});
