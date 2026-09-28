/**
 * Tap-to-pay discovery. Only phones actively on the Tap screen are discoverable, and each
 * tap session expires after 60 seconds.
 *
 *  - Live (Supabase configured): Bluetooth LE + Nearby Interaction, see services/tap/live-tap.ts
 *  - Mock (no backend): "finds" one of your contacts after a few seconds.
 */
import type { User } from '@/data/types';
import { backend } from '@/services/backend';

import { startLiveTap, type TapCallbacks, type TapFound } from './tap/live-tap';
import { liveTapDeps } from './tap/live-tap-deps';

export type { TapFound, TapStatus } from './tap/live-tap';

export const TAP_SESSION_MS = 60_000;

/** How long the mock waits before "finding" a phone. */
export const MOCK_DISCOVERY_MS = 3_500;

export type TapHandle = { stop: () => void };

/** A found phone from a list of people, for mock mode and the single-phone prototype button. */
export function demoFound(user: User, mode: 'send' | 'request'): TapFound {
  return { user, mode: mode === 'send' ? 'request' : 'send', amountCents: 0, niToken: null, via: 'demo', distanceCm: null };
}

export function startTap(
  input: { amountCents: number; mode: 'send' | 'request'; mockCandidates: () => Promise<User[]> },
  cb: TapCallbacks,
): TapHandle {
  if (backend.mode === 'live') return startLiveTap(input, cb, liveTapDeps);

  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;
  cb.onStatus('searching');
  input
    .mockCandidates()
    .catch(() => [])
    .then((people) => {
      if (stopped || !people.length) return;
      const pick = people[Math.floor(Math.random() * people.length)];
      timer = setTimeout(() => !stopped && cb.onFound(demoFound(pick, input.mode)), MOCK_DISCOVERY_MS);
    });
  return {
    stop() {
      stopped = true;
      clearTimeout(timer);
    },
  };
}
