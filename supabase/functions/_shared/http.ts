// Shared Edge Function plumbing: CORS, JSON responses, auth, and the real Stripe/DB clients.
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@22.6.2';

import { assertTestKey, HttpError, type PayvrDb, type StripeLike } from './payvr-stripe.ts';

export const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

export function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
}

export function errorResponse(e: unknown) {
  if (e instanceof HttpError) {
    const extra = e as HttpError & { balance_cents?: number };
    return json({ code: e.code, message: e.message, balance_cents: extra.balance_cents }, e.status);
  }
  console.error(e);
  return json({ code: 'server_error', message: 'Something went wrong.' }, 500);
}

export function stripeClient(): Stripe {
  // STRIPE_API_HOST/PORT/PROTOCOL are only for local tests against stripe-mock.
  const host = Deno.env.get('STRIPE_API_HOST');
  return new Stripe(assertTestKey(Deno.env.get('STRIPE_SECRET_KEY')), {
    httpClient: Stripe.createFetchHttpClient(),
    ...(host
      ? {
          host,
          port: Number(Deno.env.get('STRIPE_API_PORT') ?? 12111),
          protocol: (Deno.env.get('STRIPE_API_PROTOCOL') ?? 'http') as 'http' | 'https',
        }
      : {}),
  });
}

/** Service-role client: bypasses RLS, so only use it after checking who the caller is. */
export function adminClient(): SupabaseClient {
  return createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
}

/** The signed-in Payvr user making this request (from their Supabase JWT). */
export async function requireUser(req: Request, admin: SupabaseClient): Promise<string> {
  const token = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  if (!token) throw new HttpError(401, 'not_authenticated', 'Sign in first.');
  const { data, error } = await admin.auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'not_authenticated', 'Sign in first.');
  return data.user.id;
}

async function rpc<T>(admin: SupabaseClient, fn: string, args: Record<string, unknown>): Promise<T> {
  const { data, error } = await admin.rpc(fn, args);
  if (error) throw new Error(error.message);
  return data as T;
}

export function payvrDb(admin: SupabaseClient): PayvrDb {
  return {
    async getStripeAccount(userId) {
      const { data, error } = await admin
        .from('stripe_accounts')
        .select('customer_id, connect_account_id, payouts_enabled')
        .eq('user_id', userId)
        .maybeSingle();
      if (error) throw new Error(error.message);
      return data;
    },
    saveStripeAccount: (userId, patch) =>
      rpc(admin, 'stripe_save_account', {
        p_user: userId,
        p_customer_id: null,
        p_connect_account_id: patch.connectAccountId ?? null,
        p_payouts_enabled: patch.payoutsEnabled ?? null,
      }),
    setPayoutsEnabled: (acct, enabled) => rpc(admin, 'stripe_set_payouts_enabled', { p_connect_account_id: acct, p_enabled: enabled }),
    recordTopup: (userId, amount, pi) =>
      rpc(admin, 'stripe_record_topup', { p_user: userId, p_amount_cents: amount, p_payment_intent_id: pi }),
    creditTopup: (pi, amount) => rpc(admin, 'stripe_credit_topup', { p_payment_intent_id: pi, p_amount_received: amount }),
    failTopup: (pi) => rpc(admin, 'stripe_fail_topup', { p_payment_intent_id: pi }),
    beginCashout: (userId, amount) => rpc(admin, 'stripe_begin_cashout', { p_user: userId, p_amount_cents: amount }),
    completeCashout: (id, transferId) => rpc(admin, 'stripe_complete_cashout', { p_cashout_id: id, p_transfer_id: transferId }),
    failCashout: (id, reason) => rpc(admin, 'stripe_fail_cashout', { p_cashout_id: id, p_reason: reason }),
  };
}

export function asStripeLike(stripe: Stripe): StripeLike {
  return stripe;
}
