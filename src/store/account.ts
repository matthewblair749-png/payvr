import { useSyncExternalStore } from 'react';

import { DAILY_LIMIT_CENTS } from '@/config/compliance';
import { storage } from '@/services/storage';

/**
 * Account standing as the payments partner reports it: identity verification and whether a
 * bank or card is linked. In live mode this is read from the server (kyc_status, linked_accounts);
 * in the prototype it's kept on the phone. It never holds the personal details themselves.
 */
export type KycStatus = 'unverified' | 'pending' | 'verified' | 'rejected';
export type AccountState = { kyc: KycStatus; linked: 'bank' | 'card' | null; underReview: boolean };

const KEY = 'payvr.account';
// The demo account is already verified with a test bank linked.
const DEMO: AccountState = { kyc: 'verified', linked: 'bank', underReview: false };

let state: AccountState = DEMO;
const listeners = new Set<() => void>();

storage.get(KEY).then((raw) => {
  if (!raw) return;
  try {
    state = { ...DEMO, ...JSON.parse(raw) };
    listeners.forEach((l) => l());
  } catch {}
});

/** Current standing outside React (e.g. for the mock limit check). */
export function getAccount() {
  return state;
}

export function dailyLimitFor(kyc: KycStatus) {
  return kyc === 'verified' ? DAILY_LIMIT_CENTS.verified : DAILY_LIMIT_CENTS.new;
}

export function setAccount(patch: Partial<AccountState>) {
  state = { ...state, ...patch };
  storage.set(KEY, JSON.stringify(state));
  listeners.forEach((l) => l());
}

/** Starts a new sign-up from a clean slate. */
export function resetAccountForSignup() {
  setAccount({ kyc: 'unverified', linked: null, underReview: false });
}

export function useAccount() {
  const s = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  return { ...s, dailyLimitCents: dailyLimitFor(s.kyc) };
}
