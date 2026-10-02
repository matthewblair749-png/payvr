import { backend } from './backend';

/** People can be nudged about an open request at most once a day. */
export const REMIND_EVERY_MS = 24 * 60 * 60 * 1000;
const lastReminded = new Map<string, number>();

export function canRemind(requestId: string, now = Date.now()) {
  const at = lastReminded.get(requestId);
  return !at || now - at >= REMIND_EVERY_MS;
}

/**
 * Sends a gentle push reminder to the person asked to pay.
 * Live mode: the server sends the push and enforces the once-a-day limit (build step 6).
 * Mock mode: recorded on the phone.
 */
export async function remindRequest(requestId: string): Promise<void> {
  if (!canRemind(requestId)) throw new Error('remind_too_soon');
  if (backend.mode === 'live') throw new Error('remind_not_configured');
  await new Promise((r) => setTimeout(r, 500));
  lastReminded.set(requestId, Date.now());
}
