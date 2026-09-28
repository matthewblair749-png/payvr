/**
 * Nearby discovery for tap-to-pay.
 *
 * Build step 5 replaces the mock with:
 *  - Bluetooth LE (react-native-ble-plx): advertise a short-lived `ble_token` from the
 *    tap_sessions row while the Tap screen is open, scan for other Payvr tokens, and
 *    accept only very strong RSSI (phones touching).
 *  - Apple Nearby Interaction (UWB) on supported iPhones for precise distance.
 * Only phones actively on the Tap screen are discoverable, and sessions expire after 60s.
 */
export const TAP_SESSION_MS = 60_000;

/** How long the mock waits before "finding" a phone. */
export const MOCK_DISCOVERY_MS = 3_500;

export type NearbyPeer = { userId: string; distanceCm: number };

export type DiscoveryHandle = { stop: () => void };

export function startDiscovery(opts: {
  candidates: string[];
  onFound: (peer: NearbyPeer) => void;
}): DiscoveryHandle {
  const pick = opts.candidates[Math.floor(Math.random() * opts.candidates.length)];
  const t = setTimeout(() => {
    if (pick) opts.onFound({ userId: pick, distanceCm: 3 });
  }, MOCK_DISCOVERY_MS);
  return { stop: () => clearTimeout(t) };
}

/** QR payloads: payvr://u/<handle> */
export function qrPayloadFor(handle: string) {
  return `payvr://u/${handle}`;
}

export function parseQrPayload(data: string): string | null {
  const m = /^payvr:\/\/u\/([a-z0-9_.]{2,20})$/i.exec(data.trim());
  return m ? m[1].toLowerCase() : null;
}
