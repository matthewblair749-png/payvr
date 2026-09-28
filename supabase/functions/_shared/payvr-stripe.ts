/**
 * Payvr ⇄ Stripe (TEST MODE ONLY). Business logic shared by the Edge Functions.
 *
 * Everything takes its Stripe client and database as parameters, so it can be unit-tested
 * with fakes (payvr-stripe.test.ts). The Edge Function entry points wire in the real ones.
 *
 *  - createTopup:     Stripe PaymentIntent for "Add money"; the app shows Stripe PaymentSheet.
 *  - handleEvent:     webhook: credits the wallet once the charge succeeds.
 *  - connectStatus / connectOnboarding: Stripe Connect Express account for cashing out.
 *  - cashOut:         debit wallet → Stripe Transfer to the user's account; refund on failure.
 */

export const MIN_TOPUP_CENTS = 100;
export const MAX_TOPUP_CENTS = 100_000;
export const MIN_CASHOUT_CENTS = 100;

export class HttpError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

// ── the slices of Stripe and the database we use (real clients satisfy these) ──

export type StripeAccountInfo = {
  id: string;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  external_accounts?: { data?: { last4?: string | null; bank_name?: string | null }[] } | null;
};

export interface StripeLike {
  paymentIntents: {
    create(
      params: {
        amount: number;
        currency: string;
        automatic_payment_methods: { enabled: boolean };
        metadata: Record<string, string>;
        description?: string;
      },
      options?: { idempotencyKey?: string },
    ): Promise<{ id: string; client_secret: string | null }>;
  };
  accounts: {
    create(params: Record<string, unknown>): Promise<{ id: string }>;
    retrieve(id: string): Promise<StripeAccountInfo>;
  };
  accountLinks: {
    create(params: { account: string; refresh_url: string; return_url: string; type: 'account_onboarding' }): Promise<{ url: string }>;
  };
  transfers: {
    create(
      params: { amount: number; currency: string; destination: string; metadata: Record<string, string> },
      options?: { idempotencyKey?: string },
    ): Promise<{ id: string }>;
  };
}

export type StripeAccountRow = {
  customer_id: string | null;
  connect_account_id: string | null;
  payouts_enabled: boolean;
};

export interface PayvrDb {
  getStripeAccount(userId: string): Promise<StripeAccountRow | null>;
  saveStripeAccount(userId: string, patch: { connectAccountId?: string; payoutsEnabled?: boolean }): Promise<void>;
  setPayoutsEnabled(connectAccountId: string, enabled: boolean): Promise<void>;
  recordTopup(userId: string, amountCents: number, paymentIntentId: string): Promise<string>;
  creditTopup(paymentIntentId: string, amountReceived: number): Promise<number>;
  failTopup(paymentIntentId: string): Promise<void>;
  beginCashout(userId: string, amountCents: number): Promise<string>;
  completeCashout(cashoutId: string, transferId: string): Promise<number>;
  failCashout(cashoutId: string, reason: string): Promise<number>;
}

export type Deps = { stripe: StripeLike; db: PayvrDb };

/** Refuse to run with a live key: this prototype only ever moves test money. */
export function assertTestKey(secretKey: string | undefined): string {
  if (!secretKey) throw new HttpError(500, 'stripe_not_configured', 'STRIPE_SECRET_KEY is not set.');
  if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('rk_test_')) {
    throw new HttpError(500, 'live_key_refused', 'Payvr is a prototype: only Stripe TEST keys are allowed.');
  }
  return secretKey;
}

function wholeCents(value: unknown, min: number, max: number): number {
  const n = typeof value === 'number' ? value : NaN;
  if (!Number.isInteger(n) || n < min || n > max) {
    throw new HttpError(400, 'invalid_amount', `Amount must be between $${min / 100} and $${max / 100}.`);
  }
  return n;
}

// ── Add money ────────────────────────────────────────────────────────────────

export async function createTopup(deps: Deps, userId: string, body: { amount_cents?: unknown }) {
  const amount = wholeCents(body.amount_cents, MIN_TOPUP_CENTS, MAX_TOPUP_CENTS);
  const intent = await deps.stripe.paymentIntents.create({
    amount,
    currency: 'usd',
    automatic_payment_methods: { enabled: true },
    description: 'Payvr wallet top-up (test)',
    metadata: { purpose: 'wallet_topup', payvr_user_id: userId },
  });
  if (!intent.client_secret) throw new HttpError(502, 'stripe_error', 'Stripe did not return a client secret.');
  const topupId = await deps.db.recordTopup(userId, amount, intent.id);
  return { topup_id: topupId, payment_intent_client_secret: intent.client_secret };
}

// ── Webhook ──────────────────────────────────────────────────────────────────

type WebhookEvent = { id: string; type: string; data: { object: Record<string, unknown> } };

/** Returns a short description of what happened (for logs). Throwing makes Stripe retry. */
export async function handleEvent(deps: Deps, event: WebhookEvent): Promise<string> {
  const obj = event.data.object;
  switch (event.type) {
    case 'payment_intent.succeeded': {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      if (meta.purpose !== 'wallet_topup') return 'ignored: not a top-up';
      const balance = await deps.db.creditTopup(String(obj.id), Number(obj.amount_received));
      return `credited ${obj.id}; balance ${balance}`;
    }
    case 'payment_intent.payment_failed':
    case 'payment_intent.canceled': {
      const meta = (obj.metadata ?? {}) as Record<string, string>;
      if (meta.purpose !== 'wallet_topup') return 'ignored: not a top-up';
      await deps.db.failTopup(String(obj.id));
      return `failed ${obj.id}`;
    }
    case 'account.updated': {
      const ready = !!obj.payouts_enabled && !!obj.details_submitted;
      await deps.db.setPayoutsEnabled(String(obj.id), ready);
      return `account ${obj.id} payouts ${ready ? 'on' : 'off'}`;
    }
    default:
      return `ignored: ${event.type}`;
  }
}

// ── Cash-out account (Stripe Connect Express) ───────────────────────────────

export type ConnectStatus = {
  state: 'not_started' | 'incomplete' | 'ready';
  bank: string | null;
};

function bankLabel(account: StripeAccountInfo): string | null {
  const ext = account.external_accounts?.data?.[0];
  if (!ext?.last4) return null;
  return `${ext.bank_name ?? 'Bank'} •••• ${ext.last4}`;
}

export async function connectStatus(deps: Deps, userId: string): Promise<ConnectStatus> {
  const row = await deps.db.getStripeAccount(userId);
  if (!row?.connect_account_id) return { state: 'not_started', bank: null };
  const account = await deps.stripe.accounts.retrieve(row.connect_account_id);
  const ready = !!account.payouts_enabled && !!account.details_submitted;
  if (ready !== row.payouts_enabled) await deps.db.saveStripeAccount(userId, { payoutsEnabled: ready });
  return { state: ready ? 'ready' : 'incomplete', bank: bankLabel(account) };
}

export async function connectOnboarding(deps: Deps, userId: string, returnUrl: string): Promise<{ url: string }> {
  const row = await deps.db.getStripeAccount(userId);
  let accountId = row?.connect_account_id ?? null;
  if (!accountId) {
    const account = await deps.stripe.accounts.create({
      type: 'express',
      country: 'US',
      business_type: 'individual',
      capabilities: { transfers: { requested: true } },
      metadata: { payvr_user_id: userId },
    });
    accountId = account.id;
    await deps.db.saveStripeAccount(userId, { connectAccountId: accountId, payoutsEnabled: false });
  }
  const link = await deps.stripe.accountLinks.create({
    account: accountId,
    refresh_url: `${returnUrl}?status=refresh`,
    return_url: `${returnUrl}?status=done`,
    type: 'account_onboarding',
  });
  return { url: link.url };
}

// ── Cash out ─────────────────────────────────────────────────────────────────

export async function cashOut(deps: Deps, userId: string, body: { amount_cents?: unknown }) {
  const amount = wholeCents(body.amount_cents, MIN_CASHOUT_CENTS, 10_000_000);
  let row = await deps.db.getStripeAccount(userId);
  if (row?.connect_account_id && !row.payouts_enabled) {
    // Onboarding may have just finished and the webhook not arrived yet.
    await connectStatus(deps, userId);
    row = await deps.db.getStripeAccount(userId);
  }
  if (!row?.connect_account_id || !row.payouts_enabled) {
    throw new HttpError(409, 'payouts_not_ready', 'Set up your cash-out account first.');
  }

  let cashoutId: string;
  try {
    cashoutId = await deps.db.beginCashout(userId, amount);
  } catch (e) {
    const msg = (e as Error).message ?? '';
    if (msg.includes('insufficient_funds')) throw new HttpError(409, 'insufficient_funds', "You can't cash out more than your balance.");
    if (msg.includes('payouts_not_ready')) throw new HttpError(409, 'payouts_not_ready', 'Set up your cash-out account first.');
    throw e;
  }

  try {
    const transfer = await deps.stripe.transfers.create(
      { amount, currency: 'usd', destination: row.connect_account_id, metadata: { payvr_cashout_id: cashoutId, payvr_user_id: userId } },
      { idempotencyKey: `payvr-cashout-${cashoutId}` },
    );
    const balance = await deps.db.completeCashout(cashoutId, transfer.id);
    return { cashout_id: cashoutId, status: 'paid' as const, balance_cents: balance };
  } catch (e) {
    const balance = await deps.db.failCashout(cashoutId, (e as Error).message ?? 'Stripe transfer failed');
    throw Object.assign(new HttpError(502, 'transfer_failed', 'Stripe could not send the money. Nothing left your wallet.'), {
      balance_cents: balance,
    });
  }
}
