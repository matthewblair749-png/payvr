/**
 * Payvr payments service — THE ONLY place money moves.
 *
 * PROTOTYPE / TEST MONEY ONLY.
 *  - Between Payvr users (send, request, pay a request): Postgres functions in
 *    supabase/migrations lock wallets, check the balance and the $500 daily limit, and
 *    write the ledger in one transaction. The app cannot touch balances directly.
 *  - Add money / Cash out with Stripe (test mode) when EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY
 *    is set: Stripe PaymentSheet charges a card (card details go straight to Stripe, never
 *    to Payvr), a webhook credits the wallet; cash-outs are Stripe Connect transfers to
 *    the user's own Stripe account. Server side: supabase/functions/stripe-*.
 *  - Without Stripe: add/cash out use test-money shortcuts.
 *  - Mock mode (no Supabase): the same rules applied to the in-memory mockDb.
 */
import type { Transaction } from '@/data/types';
import { mockDb } from '@/services/backend/mock';
import { toTransaction, type TransactionRow } from '@/services/backend/live';
import { isStripeConfigured } from '@/services/stripe/config';
import { collectPayment } from '@/services/stripe/payment-sheet';
import { isSupabaseConfigured, supabase } from '@/services/supabase';
import * as WebBrowser from 'expo-web-browser';

export const DAILY_SEND_LIMIT_CENTS = 500_00;
export const STARTING_TEST_BALANCE_CENTS = 500_00;
export const MAX_ADD_MONEY_CENTS = 1_000_00;
export const TEST_MODE = true;

export type PaymentErrorCode =
  | 'cancelled'
  | 'topup_pending'
  | 'card_failed'
  | 'payouts_not_ready'
  | 'transfer_failed'
  | 'stripe_required'
  | 'insufficient_funds'
  | 'daily_limit'
  | 'invalid_amount'
  | 'invalid_recipient'
  | 'not_found'
  | 'not_pending'
  | 'network';

export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
  }
}

const fmt = (cents: number) => `$${(cents / 100).toFixed(2)}`;

function paymentError(code: string, hint?: string | null): PaymentError {
  switch (code) {
    case 'insufficient_funds':
      return new PaymentError(code, "You don't have enough test money for that.");
    case 'daily_limit': {
      const left = Math.max(0, Number(hint ?? 0));
      return new PaymentError(code, `That's over your $500 daily limit. You can send ${fmt(left)} more today.`);
    }
    case 'invalid_amount':
      return new PaymentError(code, hint || 'Enter an amount above $0.');
    case 'invalid_recipient':
    case 'recipient_missing':
      return new PaymentError('invalid_recipient', "You can't pay that person.");
    case 'not_found':
      return new PaymentError(code, 'That request no longer exists.');
    case 'not_pending':
      return new PaymentError(code, 'That request was already handled.');
    case 'stripe_required':
      return new PaymentError(code, 'Stripe is on for this project. Add EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY to the app.');
    default:
      return new PaymentError('network', 'Something went wrong. Nothing was sent.');
  }
}

export type MoneyResult = { transaction: Transaction; balanceCents: number };

export interface PaymentsProvider {
  send(input: { to: string; amountCents: number; note: string; ref?: string }): Promise<MoneyResult>;
  request(input: { from: string; amountCents: number; note: string }): Promise<MoneyResult>;
  payRequest(requestId: string): Promise<MoneyResult>;
  declineRequest(requestId: string): Promise<MoneyResult>;
  /** Returns the new balance. */
  addMoney(amountCents: number): Promise<number>;
  cashOut(amountCents: number): Promise<number>;
}

// ─────────────────────────────────────────────── live: Supabase RPC

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  if (!supabase) throw paymentError('network');
  const { data, error } = await supabase.rpc(fn, args);
  if (error) throw paymentError(error.message, error.hint);
  return data as T;
}

type RpcMoney = { transaction: TransactionRow; balance_cents: number };
const money = (r: RpcMoney): MoneyResult => ({
  transaction: toTransaction(r.transaction),
  balanceCents: Number(r.balance_cents),
});

const supabaseProvider: PaymentsProvider = {
  send: async ({ to, amountCents, note, ref }) =>
    money(await rpc('send_payment', { p_to: to, p_amount_cents: amountCents, p_note: note, p_ref: ref ?? null })),
  request: async ({ from, amountCents, note }) =>
    money(await rpc('create_request', { p_from: from, p_amount_cents: amountCents, p_note: note })),
  payRequest: async (id) => money(await rpc('pay_request', { p_request_id: id })),
  declineRequest: async (id) => money(await rpc('decline_request', { p_request_id: id })),
  addMoney: async (cents) => Number(await rpc('add_test_money', { p_amount_cents: cents })),
  cashOut: async (cents) => Number(await rpc('cash_out', { p_amount_cents: cents })),
};

// ─────────────────────────────────────────────── mock: same rules, in memory

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function sentLast24h() {
  const since = Date.now() - 24 * 60 * 60 * 1000;
  return mockDb.transactions
    .filter((t) => t.fromUser === mockDb.me.id && t.status === 'completed')
    .filter((t) => new Date(t.completedAt ?? t.createdAt).getTime() > since)
    .reduce((s, t) => s + t.amountCents, 0);
}

/** Mirrors public._move_money in the SQL migration. */
function moveOut(amountCents: number) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) throw paymentError('invalid_amount');
  if (amountCents > mockDb.balanceCents) throw paymentError('insufficient_funds');
  const sent = sentLast24h();
  if (sent + amountCents > DAILY_SEND_LIMIT_CENTS) {
    throw paymentError('daily_limit', String(DAILY_SEND_LIMIT_CENTS - sent));
  }
  mockDb.balanceCents -= amountCents;
}

function saveTx(tx: Transaction) {
  mockDb.transactions = [tx, ...mockDb.transactions.filter((t) => t.id !== tx.id)];
  return { transaction: tx, balanceCents: mockDb.balanceCents };
}

const mockProvider: PaymentsProvider = {
  async send({ to, amountCents, note, ref }) {
    await wait(700);
    if (to === mockDb.me.id) throw paymentError('invalid_recipient');
    moveOut(amountCents);
    const now = new Date().toISOString();
    mockDb.remember(to);
    return saveTx({
      id: mockDb.newId(),
      fromUser: mockDb.me.id,
      toUser: to,
      amountCents,
      note,
      type: 'send',
      status: 'completed',
      createdAt: now,
      completedAt: now,
      ref: ref ?? null,
    });
  },
  async request({ from, amountCents, note }) {
    await wait(500);
    if (from === mockDb.me.id) throw paymentError('invalid_recipient');
    if (amountCents <= 0) throw paymentError('invalid_amount');
    mockDb.remember(from);
    return saveTx({
      id: mockDb.newId(),
      fromUser: from,
      toUser: mockDb.me.id,
      amountCents,
      note,
      type: 'request',
      status: 'pending',
      createdAt: new Date().toISOString(),
    });
  },
  async payRequest(id) {
    await wait(700);
    const req = mockDb.transactions.find((t) => t.id === id && t.type === 'request' && t.fromUser === mockDb.me.id);
    if (!req) throw paymentError('not_found');
    if (req.status !== 'pending') throw paymentError('not_pending');
    moveOut(req.amountCents);
    mockDb.remember(req.toUser);
    return saveTx({ ...req, status: 'completed', completedAt: new Date().toISOString() });
  },
  async declineRequest(id) {
    await wait(300);
    const req = mockDb.transactions.find((t) => t.id === id && t.type === 'request' && t.fromUser === mockDb.me.id);
    if (!req || req.status !== 'pending') throw paymentError('not_found');
    return saveTx({ ...req, status: 'declined' });
  },
  async addMoney(cents) {
    await wait(700);
    if (cents <= 0 || cents > MAX_ADD_MONEY_CENTS) throw paymentError('invalid_amount', 'Up to $1,000 at a time.');
    mockDb.balanceCents += cents;
    return mockDb.balanceCents;
  },
  async cashOut(cents) {
    await wait(700);
    if (cents <= 0) throw paymentError('invalid_amount');
    if (cents > mockDb.balanceCents) throw paymentError('insufficient_funds');
    mockDb.balanceCents -= cents;
    return mockDb.balanceCents;
  },
};

// ─────────────────────────────────────────────── Stripe (test mode): add money + cash out

/** Calls a Payvr Edge Function and turns its { code, message } errors into PaymentErrors. */
async function edge<T>(fn: string, body: Record<string, unknown>): Promise<T> {
  if (!supabase) throw paymentError('network');
  const { data, error } = await supabase.functions.invoke(fn, { body });
  if (error) {
    const res = (error as { context?: Response }).context;
    const payload = res && typeof res.json === 'function' ? await res.json().catch(() => null) : null;
    const code = payload?.code as PaymentErrorCode | undefined;
    if (code === 'payouts_not_ready') throw new PaymentError(code, 'Set up where your money goes first.');
    if (code === 'transfer_failed' || code === 'insufficient_funds' || code === 'stripe_required') {
      throw new PaymentError(code, payload.message);
    }
    if (payload?.code === 'invalid_amount') throw new PaymentError('invalid_amount', payload.message);
    throw paymentError('network');
  }
  return data as T;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** The webhook credits the wallet a moment after Stripe charges the card; wait for it. */
async function waitForTopup(topupId: string): Promise<number> {
  for (let i = 0; i < 20; i++) {
    const { data } = await supabase!.from('wallet_topups').select('status').eq('id', topupId).maybeSingle();
    if (data?.status === 'succeeded') {
      const { data: w } = await supabase!.from('wallets').select('balance_cents').single();
      return Number(w?.balance_cents ?? 0);
    }
    if (data?.status === 'failed') throw new PaymentError('card_failed', 'Your card was declined. Nothing was added.');
    await sleep(1000);
  }
  throw new PaymentError('topup_pending', 'Payment received. Your balance will update in a moment.');
}

const stripeProvider: Pick<PaymentsProvider, 'addMoney' | 'cashOut'> = {
  async addMoney(cents) {
    const { topup_id, payment_intent_client_secret } = await edge<{ topup_id: string; payment_intent_client_secret: string }>(
      'stripe-topup',
      { amount_cents: cents },
    );
    let outcome: 'paid' | 'canceled';
    try {
      outcome = await collectPayment(payment_intent_client_secret);
    } catch (e) {
      throw new PaymentError('card_failed', e instanceof Error ? e.message : 'The card payment failed.');
    }
    if (outcome === 'canceled') throw new PaymentError('cancelled', 'Cancelled.');
    return waitForTopup(topup_id);
  },
  async cashOut(cents) {
    const res = await edge<{ balance_cents: number }>('stripe-cashout', { amount_cents: cents });
    return Number(res.balance_cents);
  },
};

export const payments: PaymentsProvider = isSupabaseConfigured
  ? isStripeConfigured
    ? { ...supabaseProvider, ...stripeProvider }
    : supabaseProvider
  : mockProvider;

/** Whether Add money / Cash out go through Stripe (test mode). */
export const STRIPE_MODE = isStripeConfigured;

export type PayoutAccount = { state: 'not_started' | 'incomplete' | 'ready'; bank: string | null };

/** Where cash-outs go: the user's Stripe Connect account. */
export async function getPayoutAccount(): Promise<PayoutAccount> {
  return edge<PayoutAccount>('stripe-connect', { action: 'status' });
}

/** Opens Stripe's hosted onboarding, then returns the updated status. */
export async function setupPayoutAccount(): Promise<PayoutAccount> {
  const { url } = await edge<{ url: string }>('stripe-connect', { action: 'onboard' });
  await WebBrowser.openAuthSessionAsync(url, 'payvr://stripe-return');
  return getPayoutAccount();
}

/** Linked funding sources are Stripe test objects; only display metadata is kept. */
export const TEST_FUNDING_SOURCES = [
  { id: 'pm_test_visa', label: 'Visa •••• 4242', kind: 'card' as const },
  { id: 'ba_test_bank', label: 'Test Bank •••• 6789', kind: 'bank' as const },
];
