// POST { action: 'status' }  → { state, bank }
// POST { action: 'onboard' } → { url } (Stripe-hosted onboarding; returns via stripe-return)
import { adminClient, asStripeLike, cors, errorResponse, json, payvrDb, requireUser, stripeClient } from '../_shared/http.ts';
import { connectOnboarding, connectStatus, HttpError } from '../_shared/payvr-stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = adminClient();
    const userId = await requireUser(req, admin);
    const deps = { stripe: asStripeLike(stripeClient()), db: payvrDb(admin) };
    const { action } = await req.json();
    if (action === 'status') return json(await connectStatus(deps, userId));
    if (action === 'onboard') {
      const returnUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/stripe-return`;
      return json(await connectOnboarding(deps, userId, returnUrl));
    }
    throw new HttpError(400, 'bad_request', 'Unknown action.');
  } catch (e) {
    return errorResponse(e);
  }
});
