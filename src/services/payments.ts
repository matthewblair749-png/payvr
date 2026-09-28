/**
 * Payvr payments service — THE ONLY place money moves.
 *
 * PROTOTYPE / TEST MONEY ONLY. This file currently runs an in-memory mock ledger
 * that behaves like Stripe test mode (latency, limits, declines). To go live with
 * Stripe Connect later, implement `PaymentsProvider` with calls to your backend
 * (Supabase Edge Functions that talk to Stripe) and swap `provider` below.
 * Never send card numbers through the app — only Stripe tokens / PaymentMethod IDs.
 */
import type { Transaction } from '@/data/types';

export const DAILY_SEND_LIMIT_CENTS = 500_00;
export const STARTING_TEST_BALANCE_CENTS = 500_00;
export const TEST_MODE = true;

export type PaymentErrorCode =
  | 'insufficient_funds'
  | 'daily_limit'
  | 'invalid_amount'
  | 'not_found'
  | 'network';

export class PaymentError extends Error {
  constructor(
    public code: PaymentErrorCode,
    message: string,
  ) {
    super(message);
  }
}

export type LedgerSnapshot = {
  balanceCents: number;
  /** Total already sent today, used for the daily limit. */
  sentTodayCents: number;
};

export type SendInput = { fromUser: string; toUser: string; amountCents: number; note: string };
export type RequestInput = { requester: string; payer: string; amountCents: number; note: string };

export interface PaymentsProvider {
  send(input: SendInput, ledger: LedgerSnapshot): Promise<Transaction>;
  request(input: RequestInput): Promise<Transaction>;
  payRequest(request: Transaction, ledger: LedgerSnapshot): Promise<Transaction>;
  declineRequest(request: Transaction): Promise<Transaction>;
  addMoney(amountCents: number): Promise<{ amountCents: number }>;
  cashOut(amountCents: number, ledger: LedgerSnapshot): Promise<{ amountCents: number }>;
}

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
const newId = () => `tx_${Math.random().toString(16).slice(2, 8)}${Date.now().toString(16).slice(-4)}`;

function checkSend(amountCents: number, ledger: LedgerSnapshot) {
  if (!Number.isInteger(amountCents) || amountCents <= 0) {
    throw new PaymentError('invalid_amount', 'Enter an amount above $0.');
  }
  if (amountCents > ledger.balanceCents) {
    throw new PaymentError('insufficient_funds', "You don't have enough test money for that.");
  }
  if (ledger.sentTodayCents + amountCents > DAILY_SEND_LIMIT_CENTS) {
    const left = Math.max(0, DAILY_SEND_LIMIT_CENTS - ledger.sentTodayCents);
    throw new PaymentError(
      'daily_limit',
      `That's over your $500 daily limit. You can send $${(left / 100).toFixed(2)} more today.`,
    );
  }
}

/** Mock provider that mimics Stripe test mode. */
const mockProvider: PaymentsProvider = {
  async send(input, ledger) {
    checkSend(input.amountCents, ledger);
    await wait(700);
    return {
      id: newId(),
      fromUser: input.fromUser,
      toUser: input.toUser,
      amountCents: input.amountCents,
      note: input.note,
      type: 'send',
      status: 'completed',
      createdAt: new Date().toISOString(),
    };
  },
  async request(input) {
    if (input.amountCents <= 0) throw new PaymentError('invalid_amount', 'Enter an amount above $0.');
    await wait(500);
    return {
      id: newId(),
      fromUser: input.payer,
      toUser: input.requester,
      amountCents: input.amountCents,
      note: input.note,
      type: 'request',
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
  },
  async payRequest(request, ledger) {
    checkSend(request.amountCents, ledger);
    await wait(700);
    return { ...request, status: 'completed' };
  },
  async declineRequest(request) {
    await wait(300);
    return { ...request, status: 'declined' };
  },
  async addMoney(amountCents) {
    if (amountCents <= 0) throw new PaymentError('invalid_amount', 'Enter an amount above $0.');
    await wait(700);
    return { amountCents };
  },
  async cashOut(amountCents, ledger) {
    if (amountCents <= 0) throw new PaymentError('invalid_amount', 'Enter an amount above $0.');
    if (amountCents > ledger.balanceCents) {
      throw new PaymentError('insufficient_funds', "You can't cash out more than your balance.");
    }
    await wait(700);
    return { amountCents };
  },
};

// Swap for a Stripe-backed provider in build step 6.
const provider: PaymentsProvider = mockProvider;

export const payments = provider;

/** Linked funding sources are Stripe test objects; only display metadata is kept. */
export const TEST_FUNDING_SOURCES = [
  { id: 'pm_test_visa', label: 'Visa •••• 4242', kind: 'card' as const },
  { id: 'ba_test_bank', label: 'Test Bank •••• 6789', kind: 'bank' as const },
];
