import type { KycStatus } from '@/store/account';

import { backend } from './backend';

export type IdentityInput = {
  firstName: string;
  lastName: string;
  /** MM/DD/YYYY */
  dob: string;
  address: { street: string; unit: string; city: string; state: string; zip: string; country: 'US' };
  ssnLast4?: string;
  /** Set when the person scanned an ID document instead of giving SSN digits. */
  idDocument?: boolean;
};

/**
 * Sends identity details to the payments partner's KYC check and returns the outcome.
 * Live mode: the `payments` Edge Function forwards them to the partner (never stored by Payvr).
 * Mock mode: a short pause, then approved (last 4 "0000" is rejected so the error path can be tried).
 */
export async function submitIdentity(input: IdentityInput): Promise<Exclude<KycStatus, 'unverified'>> {
  if (backend.mode === 'live') {
    // Wired up in build step 4 (payments partner integration).
    throw new Error('kyc_not_configured');
  }
  await new Promise((r) => setTimeout(r, 1200));
  return input.ssnLast4 === '0000' ? 'rejected' : 'verified';
}

/**
 * Opens the partner's secure flow to link a bank account or debit card.
 * Live mode: the partner's hosted screen (wired up in build step 4). Mock mode: a short pause.
 */
export async function linkFundingSource(kind: 'bank' | 'card'): Promise<void> {
  if (backend.mode === 'live') throw new Error('link_not_configured');
  void kind;
  await new Promise((r) => setTimeout(r, 900));
}
