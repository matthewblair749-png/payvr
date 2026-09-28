/**
 * Decides which nearby Payvr phone is actually being tapped, from Bluetooth signal
 * strength (RSSI). Readings are noisy, so we use the median of the latest few and only
 * accept a phone that is clearly very close and clearly the closest.
 *
 * On supported iPhones, Nearby Interaction (UWB) then confirms the real distance.
 * Kept free of app imports so it can be unit-tested with plain Node.
 */
export const PROXIMITY = {
  /** Median RSSI (dBm) that counts as "phones touching". Tune per device family. */
  closeRssi: -52,
  /** How many recent readings the median uses, and the minimum needed. */
  window: 5,
  minReadings: 3,
  /** Readings older than this are dropped. */
  staleMs: 1500,
  /** The winner must beat the runner-up by this many dB, so two phones can't both "win". */
  marginDb: 6,
  /** After a phone is rejected (unknown token, too far by UWB), ignore it this long. */
  ignoreMs: 3000,
  /** UWB: accept at or under this distance; reject over the far limit. */
  uwbAcceptM: 0.2,
  uwbRejectM: 0.35,
} as const;

type Reading = { rssi: number; at: number };

function median(values: number[]) {
  const s = [...values].sort((a, b) => a - b);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

export class ProximityTracker {
  private readings = new Map<string, Reading[]>();
  private ignored = new Map<string, number>();

  private cfg: typeof PROXIMITY;

  constructor(cfg: typeof PROXIMITY = PROXIMITY) {
    this.cfg = cfg;
  }

  add(token: string, rssi: number | null | undefined, now = Date.now()) {
    // 127 is the "unknown" RSSI value some stacks report.
    if (rssi === null || rssi === undefined || rssi >= 0 || rssi === 127) return;
    const list = (this.readings.get(token) ?? []).filter((r) => now - r.at <= this.cfg.staleMs);
    list.push({ rssi, at: now });
    this.readings.set(token, list.slice(-this.cfg.window));
  }

  ignore(token: string, now = Date.now()) {
    this.ignored.set(token, now + this.cfg.ignoreMs);
    this.readings.delete(token);
  }

  /** Current smoothed signal for a token, if it has enough fresh readings. */
  signal(token: string, now = Date.now()): number | null {
    const fresh = (this.readings.get(token) ?? []).filter((r) => now - r.at <= this.cfg.staleMs);
    return fresh.length >= this.cfg.minReadings ? median(fresh.map((r) => r.rssi)) : null;
  }

  /** The phone being tapped, or null while it's not clear yet. */
  closest(now = Date.now()): string | null {
    const ranked: { token: string; rssi: number }[] = [];
    for (const token of this.readings.keys()) {
      if ((this.ignored.get(token) ?? 0) > now) continue;
      const rssi = this.signal(token, now);
      if (rssi !== null) ranked.push({ token, rssi });
    }
    ranked.sort((a, b) => b.rssi - a.rssi);
    const [best, next] = ranked;
    if (!best || best.rssi < this.cfg.closeRssi) return null;
    if (next && best.rssi - next.rssi < this.cfg.marginDb) return null;
    return best.token;
  }

  reset() {
    this.readings.clear();
    this.ignored.clear();
  }
}

export type UwbVerdict = 'accept' | 'reject' | 'wait';

/** Decision from UWB distance readings (metres), latest last. */
export function uwbVerdict(distances: number[], cfg: typeof PROXIMITY = PROXIMITY): UwbVerdict {
  const recent = distances.slice(-2);
  if (recent.some((d) => d <= cfg.uwbAcceptM)) return 'accept';
  if (recent.length === 2 && recent.every((d) => d > cfg.uwbRejectM)) return 'reject';
  return 'wait';
}
