// deno-lint-ignore-file require-await -- fakes mirror async client APIs.
// deno test supabase/functions — fakes for Stripe and the database; real Stripe signature checks.
import { assert, assertEquals, assertRejects } from 'jsr:@std/assert@1';
import Stripe from 'npm:stripe@22.6.2';

import {
  assertTestKey,
  cashOut,
  connectOnboarding,
  connectStatus,
  createTopup,
  handleEvent,
  HttpError,
  type PayvrDb,
  type StripeAccountInfo,
  type StripeLike,
} from './payvr-stripe.ts';

/** In-memory stand-in for the SQL functions (same rules as supabase/migrations). */
function fakeDb(startBalance = 50_000) {
  const wallets = new Map<string, number>([['u1', startBalance]]);
  const accounts = new Map<string, { customer_id: string | null; connect_account_id: string | null; payouts_enabled: boolean }>();
  const topups = new Map<string, { user: string; amount: number; status: string }>();
  const cashouts = new Map<string, { user: string; amount: number; status: string; transfer?: string }>();
  let n = 0;
  const db: PayvrDb = {
    getStripeAccount: async (u) => accounts.get(u) ?? null,
    saveStripeAccount: async (u, p) => {
      const cur = accounts.get(u) ?? { customer_id: null, connect_account_id: null, payouts_enabled: false };
      accounts.set(u, {
        ...cur,
        connect_account_id: p.connectAccountId ?? cur.connect_account_id,
        payouts_enabled: p.payoutsEnabled ?? cur.payouts_enabled,
      });
    },
    setPayoutsEnabled: async (acct, on) => {
      for (const a of accounts.values()) if (a.connect_account_id === acct) a.payouts_enabled = on;
    },
    recordTopup: async (u, amount, pi) => {
      topups.set(pi, topups.get(pi) ?? { user: u, amount, status: 'pending' });
      return `topup_${pi}`;
    },
    creditTopup: async (pi, received) => {
      const t = topups.get(pi);
      if (!t) throw new Error('unknown_payment_intent');
      if (t.status === 'succeeded') return wallets.get(t.user)!;
      if (received !== t.amount) throw new Error('amount_mismatch');
      t.status = 'succeeded';
      wallets.set(t.user, wallets.get(t.user)! + t.amount);
      return wallets.get(t.user)!;
    },
    failTopup: async (pi) => {
      const t = topups.get(pi);
      if (t?.status === 'pending') t.status = 'failed';
    },
    beginCashout: async (u, amount) => {
      if (!accounts.get(u)?.payouts_enabled) throw new Error('payouts_not_ready');
      if (wallets.get(u)! < amount) throw new Error('insufficient_funds');
      wallets.set(u, wallets.get(u)! - amount);
      const id = `co_${++n}`;
      cashouts.set(id, { user: u, amount, status: 'pending' });
      return id;
    },
    completeCashout: async (id, transfer) => {
      const c = cashouts.get(id)!;
      if (c.status !== 'pending') throw new Error('not_pending');
      Object.assign(c, { status: 'paid', transfer });
      return wallets.get(c.user)!;
    },
    failCashout: async (id) => {
      const c = cashouts.get(id)!;
      if (c.status !== 'pending') throw new Error('not_pending');
      c.status = 'failed';
      wallets.set(c.user, wallets.get(c.user)! + c.amount);
      return wallets.get(c.user)!;
    },
  };
  return { db, wallets, accounts, topups, cashouts };
}

function fakeStripe(opts: { account?: Partial<StripeAccountInfo>; transferFails?: boolean } = {}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const stripe: StripeLike = {
    paymentIntents: {
      create: async (...args) => {
        calls.push({ method: 'paymentIntents.create', args });
        return { id: 'pi_1', client_secret: 'pi_1_secret_abc' };
      },
    },
    accounts: {
      create: async (...args) => {
        calls.push({ method: 'accounts.create', args });
        return { id: 'acct_1' };
      },
      retrieve: async (id) => ({ id, payouts_enabled: false, details_submitted: false, ...opts.account }),
    },
    accountLinks: {
      create: async (...args) => {
        calls.push({ method: 'accountLinks.create', args });
        return { url: 'https://connect.stripe.com/setup/e/acct_1/abc' };
      },
    },
    transfers: {
      create: async (...args) => {
        calls.push({ method: 'transfers.create', args });
        if (opts.transferFails) throw new Error('Insufficient funds in Stripe account (test)');
        return { id: 'tr_1' };
      },
    },
  };
  return { stripe, calls };
}

Deno.test('refuses live Stripe keys', () => {
  assertEquals(assertTestKey('sk_test_abc'), 'sk_test_abc');
  for (const bad of ['sk_live_abc', 'rk_live_x', '', undefined]) {
    try {
      assertTestKey(bad);
      throw new Error('should have thrown');
    } catch (e) {
      assert(e instanceof HttpError);
    }
  }
});

Deno.test('add money: creates a USD PaymentIntent tagged as a Payvr top-up and records it', async () => {
  const { db, topups } = fakeDb();
  const { stripe, calls } = fakeStripe();
  const res = await createTopup({ stripe, db }, 'u1', { amount_cents: 2500 });
  assertEquals(res.payment_intent_client_secret, 'pi_1_secret_abc');
  const [params] = calls[0].args as [{ amount: number; currency: string; metadata: Record<string, string> }];
  assertEquals(params.amount, 2500);
  assertEquals(params.currency, 'usd');
  assertEquals(params.metadata, { purpose: 'wallet_topup', payvr_user_id: 'u1' });
  assertEquals(topups.get('pi_1')?.status, 'pending');
});

Deno.test('add money: rejects bad amounts before calling Stripe', async () => {
  const { db } = fakeDb();
  const { stripe, calls } = fakeStripe();
  for (const amount of [0, 99, 100_001, 12.5, '5000', null]) {
    await assertRejects(() => createTopup({ stripe, db }, 'u1', { amount_cents: amount }), HttpError);
  }
  assertEquals(calls.length, 0);
});

Deno.test('webhook: a succeeded top-up credits the wallet exactly once', async () => {
  const { db, wallets } = fakeDb();
  const { stripe } = fakeStripe();
  await createTopup({ stripe, db }, 'u1', { amount_cents: 2500 });
  const event = {
    id: 'evt_1',
    type: 'payment_intent.succeeded',
    data: { object: { id: 'pi_1', amount_received: 2500, metadata: { purpose: 'wallet_topup' } } },
  };
  await handleEvent({ stripe, db }, event);
  await handleEvent({ stripe, db }, event); // Stripe can deliver twice.
  assertEquals(wallets.get('u1'), 52_500);
});

Deno.test('webhook: ignores PaymentIntents that are not Payvr top-ups, and marks failures', async () => {
  const { db, wallets, topups } = fakeDb();
  const { stripe } = fakeStripe();
  const other = { id: 'e', type: 'payment_intent.succeeded', data: { object: { id: 'pi_x', amount_received: 9999, metadata: {} } } };
  assertEquals(await handleEvent({ stripe, db }, other), 'ignored: not a top-up');
  await createTopup({ stripe, db }, 'u1', { amount_cents: 1000 });
  await handleEvent({ stripe, db }, {
    id: 'e2',
    type: 'payment_intent.payment_failed',
    data: { object: { id: 'pi_1', metadata: { purpose: 'wallet_topup' } } },
  });
  assertEquals(topups.get('pi_1')?.status, 'failed');
  assertEquals(wallets.get('u1'), 50_000);
});

Deno.test('webhook: account.updated turns payouts on only when onboarding is complete', async () => {
  const { db, accounts } = fakeDb();
  const { stripe } = fakeStripe();
  await db.saveStripeAccount('u1', { connectAccountId: 'acct_1', payoutsEnabled: false });
  const ev = (payouts: boolean, details: boolean) => ({
    id: 'e',
    type: 'account.updated',
    data: { object: { id: 'acct_1', payouts_enabled: payouts, details_submitted: details } },
  });
  await handleEvent({ stripe, db }, ev(true, false));
  assertEquals(accounts.get('u1')?.payouts_enabled, false);
  await handleEvent({ stripe, db }, ev(true, true));
  assertEquals(accounts.get('u1')?.payouts_enabled, true);
});

Deno.test('webhook signatures: real Stripe verification accepts good and rejects forged events', async () => {
  const stripe = new Stripe('sk_test_123', { httpClient: Stripe.createFetchHttpClient() });
  const crypto = Stripe.createSubtleCryptoProvider();
  const payload = JSON.stringify({ id: 'evt_1', object: 'event', type: 'payment_intent.succeeded', data: { object: { id: 'pi_1' } } });
  const header = await stripe.webhooks.generateTestHeaderStringAsync({ payload, secret: 'whsec_real' });
  const ev = await stripe.webhooks.constructEventAsync(payload, header, 'whsec_real', undefined, crypto);
  assertEquals(ev.type, 'payment_intent.succeeded');
  await assertRejects(() => stripe.webhooks.constructEventAsync(payload, header, 'whsec_other', undefined, crypto));
  const tampered = payload.replace('pi_1', 'pi_2');
  await assertRejects(() => stripe.webhooks.constructEventAsync(tampered, header, 'whsec_real', undefined, crypto));
});

Deno.test('connect: onboarding creates one Express account and a Stripe-hosted link', async () => {
  const { db, accounts } = fakeDb();
  const { stripe, calls } = fakeStripe();
  const { url } = await connectOnboarding({ stripe, db }, 'u1', 'https://x.supabase.co/functions/v1/stripe-return');
  assert(url.startsWith('https://connect.stripe.com/'));
  assertEquals(accounts.get('u1')?.connect_account_id, 'acct_1');
  await connectOnboarding({ stripe, db }, 'u1', 'https://x.supabase.co/functions/v1/stripe-return');
  assertEquals(calls.filter((c) => c.method === 'accounts.create').length, 1, 'account is reused');
  const link = calls.find((c) => c.method === 'accountLinks.create')!.args[0] as { return_url: string };
  assertEquals(link.return_url, 'https://x.supabase.co/functions/v1/stripe-return?status=done');
});

Deno.test('connect: status reflects Stripe and syncs payouts_enabled', async () => {
  const { db, accounts } = fakeDb();
  assertEquals((await connectStatus({ stripe: fakeStripe().stripe, db }, 'u1')).state, 'not_started');
  await db.saveStripeAccount('u1', { connectAccountId: 'acct_1', payoutsEnabled: false });
  assertEquals((await connectStatus({ stripe: fakeStripe().stripe, db }, 'u1')).state, 'incomplete');
  const ready = fakeStripe({
    account: { payouts_enabled: true, details_submitted: true, external_accounts: { data: [{ last4: '6789', bank_name: 'STRIPE TEST BANK' }] } },
  });
  assertEquals(await connectStatus({ stripe: ready.stripe, db }, 'u1'), { state: 'ready', bank: 'STRIPE TEST BANK •••• 6789' });
  assertEquals(accounts.get('u1')?.payouts_enabled, true);
});

Deno.test('cash out: blocked until the Stripe account can receive payouts', async () => {
  const { db, wallets } = fakeDb();
  const { stripe, calls } = fakeStripe();
  const err = await assertRejects(() => cashOut({ stripe, db }, 'u1', { amount_cents: 1000 }), HttpError);
  assertEquals(err.code, 'payouts_not_ready');
  assertEquals(wallets.get('u1'), 50_000);
  assertEquals(calls.length, 0);
});

Deno.test('cash out: debits the wallet and transfers to the user\'s Stripe account (idempotent key)', async () => {
  const { db, wallets, cashouts } = fakeDb();
  const { stripe, calls } = fakeStripe();
  await db.saveStripeAccount('u1', { connectAccountId: 'acct_1', payoutsEnabled: true });
  const res = await cashOut({ stripe, db }, 'u1', { amount_cents: 2000 });
  assertEquals(res.balance_cents, 48_000);
  assertEquals(wallets.get('u1'), 48_000);
  const [params, options] = calls[0].args as [{ destination: string; amount: number }, { idempotencyKey: string }];
  assertEquals(params.destination, 'acct_1');
  assertEquals(params.amount, 2000);
  assertEquals(options.idempotencyKey, 'payvr-cashout-co_1');
  assertEquals(cashouts.get('co_1')?.status, 'paid');
});

Deno.test('cash out: if Stripe refuses the transfer, the money goes back', async () => {
  const { db, wallets, cashouts } = fakeDb();
  const { stripe } = fakeStripe({ transferFails: true });
  await db.saveStripeAccount('u1', { connectAccountId: 'acct_1', payoutsEnabled: true });
  const err = await assertRejects(() => cashOut({ stripe, db }, 'u1', { amount_cents: 2000 }), HttpError);
  assertEquals(err.code, 'transfer_failed');
  assertEquals((err as HttpError & { balance_cents: number }).balance_cents, 50_000);
  assertEquals(wallets.get('u1'), 50_000);
  assertEquals(cashouts.get('co_1')?.status, 'failed');
});

Deno.test('cash out: more than the balance is refused without calling Stripe', async () => {
  const { db } = fakeDb(1000);
  const { stripe, calls } = fakeStripe();
  await db.saveStripeAccount('u1', { connectAccountId: 'acct_1', payoutsEnabled: true });
  const err = await assertRejects(() => cashOut({ stripe, db }, 'u1', { amount_cents: 2000 }), HttpError);
  assertEquals(err.code, 'insufficient_funds');
  assertEquals(calls.length, 0);
});

Deno.test('cash out: re-checks Stripe when onboarding just finished but the webhook has not arrived', async () => {
  const { db } = fakeDb();
  const { stripe } = fakeStripe({ account: { payouts_enabled: true, details_submitted: true } });
  await db.saveStripeAccount('u1', { connectAccountId: 'acct_1', payoutsEnabled: false });
  const res = await cashOut({ stripe, db }, 'u1', { amount_cents: 500 });
  assertEquals(res.status, 'paid');
});
