// POST { amount_cents } → { status: 'paid', balance_cents }. Debits the wallet, then Stripe Transfer.
import { adminClient, asStripeLike, cors, errorResponse, json, payvrDb, requireUser, stripeClient } from '../_shared/http.ts';
import { cashOut } from '../_shared/payvr-stripe.ts';

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  try {
    const admin = adminClient();
    const userId = await requireUser(req, admin);
    const deps = { stripe: asStripeLike(stripeClient()), db: payvrDb(admin) };
    return json(await cashOut(deps, userId, await req.json()));
  } catch (e) {
    return errorResponse(e);
  }
});
