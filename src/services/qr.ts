/**
 * Payvr QR codes. Two kinds, both plain deep links so the phone's own camera app can
 * open them too:
 *
 *   payvr://u/<handle>                               "My code": pay or request from me
 *   payvr://u/<handle>?amt=2000&note=Pizza&exp=…     A request: "pay me $20 for Pizza"
 *
 * Request codes carry an expiry (unix seconds) and the showing phone refreshes them,
 * so an old screenshot stops working. Nothing in a code is trusted: the scanner looks
 * the handle up on the server and shows that person's real name and photo, and
 * every payment still needs Face ID / PIN.
 *
 * Kept free of app imports so it can be unit-tested with plain Node.
 */
export const QR_SCHEME = 'payvr';
/** How long a request code stays valid, and how often the showing phone refreshes it. */
export const REQUEST_CODE_TTL_S = 120;
export const REQUEST_CODE_REFRESH_S = 60;
/** Tolerance for clocks that disagree between two phones. */
const CLOCK_SKEW_S = 30;
const MAX_AMOUNT_CENTS = 1_000_000;
const HANDLE_RE = /^[a-z0-9_.]{3,20}$/;

export type QrRequest = { amountCents: number; note: string; expiresAt: number };
export type PayvrCode = { handle: string; request?: QrRequest };

export type ParseResult =
  | { ok: true; code: PayvrCode }
  | { ok: false; reason: 'not_payvr' | 'expired' };

export function buildQr(handle: string, request?: Omit<QrRequest, 'expiresAt'>, nowMs = Date.now()): string {
  const base = `${QR_SCHEME}://u/${handle.toLowerCase()}`;
  if (!request) return base;
  const q = new URLSearchParams({
    amt: String(request.amountCents),
    exp: String(Math.floor(nowMs / 1000) + REQUEST_CODE_TTL_S),
  });
  if (request.note) q.set('note', request.note.slice(0, 60));
  return `${base}?${q.toString()}`;
}

/** Parses the scanned text. Accepts only well-formed Payvr codes. */
export function parseQr(raw: string, nowMs = Date.now()): ParseResult {
  const m = /^payvr:\/\/u\/([^/?#\s]+)(?:\?([^#\s]*))?$/i.exec(raw.trim());
  if (!m) return { ok: false, reason: 'not_payvr' };
  return fromParts(m[1], m[2] ? Object.fromEntries(new URLSearchParams(m[2])) : {}, nowMs);
}

/** Same checks for a code that arrived as a deep link (route params). */
export function fromParts(handleRaw: string, params: Record<string, string | undefined>, nowMs = Date.now()): ParseResult {
  let handle: string;
  try {
    handle = decodeURIComponent(handleRaw).toLowerCase();
  } catch {
    return { ok: false, reason: 'not_payvr' };
  }
  if (!HANDLE_RE.test(handle)) return { ok: false, reason: 'not_payvr' };
  if (params.amt === undefined) return { ok: true, code: { handle } };

  const amountCents = Number(params.amt);
  const expiresAt = Number(params.exp);
  const note = params.note ?? '';
  if (!/^\d+$/.test(params.amt) || amountCents <= 0 || amountCents > MAX_AMOUNT_CENTS) {
    return { ok: false, reason: 'not_payvr' };
  }
  if (!Number.isInteger(expiresAt) || note.length > 60) return { ok: false, reason: 'not_payvr' };
  if (expiresAt + CLOCK_SKEW_S < Math.floor(nowMs / 1000)) return { ok: false, reason: 'expired' };
  return { ok: true, code: { handle, request: { amountCents, note, expiresAt } } };
}
