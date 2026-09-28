/**
 * A tap session's 96-bit token travels over Bluetooth LE as a 128-bit service UUID:
 *
 *   50415956-xxxx-xxxx-xxxx-xxxxxxxxxxxx
 *   └ "PAYV" ┘└──── 24 hex chars = the token ────┘
 *
 * iOS can only advertise service UUIDs (no custom data) in the foreground, so the token
 * lives in the UUID itself. It changes with every 60-second session and means nothing
 * without the server, which only resolves it while both phones are on the Tap screen.
 * Kept free of app imports so it can be unit-tested with plain Node.
 */
const PREFIX = '50415956';
const TOKEN_RE = /^[0-9a-f]{24}$/;
const UUID_RE = /^50415956-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{4})-([0-9a-f]{12})$/;

export function tokenToUuid(token: string): string {
  const t = token.toLowerCase();
  if (!TOKEN_RE.test(t)) throw new Error('Invalid tap token');
  return `${PREFIX}-${t.slice(0, 4)}-${t.slice(4, 8)}-${t.slice(8, 12)}-${t.slice(12)}`;
}

/** Returns the token if this advertised UUID is a Payvr tap token, otherwise null. */
export function uuidToToken(uuid: string): string | null {
  const m = UUID_RE.exec(uuid.trim().toLowerCase());
  return m ? m.slice(1).join('') : null;
}

/** First Payvr token among a device's advertised service UUIDs. */
export function findToken(serviceUUIDs: readonly string[] | null | undefined): string | null {
  for (const u of serviceUUIDs ?? []) {
    const t = uuidToToken(u);
    if (t) return t;
  }
  return null;
}
