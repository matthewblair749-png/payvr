/**
 * One tap attempt against the real backend:
 *
 *  1. Check Bluetooth (and permissions).
 *  2. On UWB iPhones, start Nearby Interaction and get this phone's discovery token.
 *  3. Open a 60-second tap session on the server → random token.
 *  4. Advertise the token over Bluetooth, and scan for other phones' tokens.
 *  5. When one phone is clearly touching (signal strength), ask the server who it is.
 *     The server only answers while BOTH phones are on the Tap screen.
 *  6. If both phones have UWB, confirm the real distance (≤ 20 cm) before accepting.
 *
 * `stop()` tears everything down and ends the server session.
 */
import { tokenToUuid } from './ble-token.ts';
import { ProximityTracker, uwbVerdict } from './proximity.ts';

export type TapStatus = 'starting' | 'searching' | 'bluetooth_off' | 'unauthorized' | 'unsupported' | 'error';

type PeerUser = { id: string; name: string; handle: string; avatarUrl?: string | null };

/** The phone on the other side, as resolved by the server. */
export type TapPeer = {
  user: PeerUser;
  mode: 'send' | 'request';
  amountCents: number;
  niToken: string | null;
};

export type TapFound = TapPeer & { via: 'uwb' | 'bluetooth' | 'demo'; distanceCm: number | null };

/** Everything live tapping talks to. Injected so the logic can be tested without radios. */
export type TapDeps = {
  prepareRadio: () => Promise<'ready' | 'bluetooth_off' | 'unauthorized' | 'unsupported'>;
  scanForTokens: (onToken: (token: string, rssi: number | null) => void, onError: (message: string) => void) => () => void;
  nearby: {
    isNearbyInteractionSupported(): boolean;
    startAdvertising(uuid: string): Promise<unknown>;
    stopAdvertising(): Promise<void>;
    startNearbyInteraction(): Promise<string>;
    runNearbyInteraction(peerToken: string): Promise<void>;
    stopNearbyInteraction(): Promise<void>;
    addListener(event: 'onDistance', listener: (e: { distance: number | null }) => void): { remove(): void };
  } | null;
  backend: {
    startTapSession(input: { amountCents: number; mode: 'send' | 'request'; niToken: string | null }): Promise<{ bleToken: string }>;
    resolveTapToken(token: string): Promise<TapPeer | null>;
    endTapSession(): Promise<void>;
  };
  /** Milliseconds to wait for UWB readings before trusting Bluetooth alone. */
  uwbWaitMs?: number;
};

export type TapCallbacks = {
  onStatus: (status: TapStatus, message?: string) => void;
  onFound: (found: TapFound) => void;
};

const UWB_WAIT_MS = 2500;

function errorStatus(e: unknown): { status: TapStatus; message?: string } {
  const code = (e as { code?: string })?.code;
  if (code === 'ERR_BLUETOOTH_OFF') return { status: 'bluetooth_off' };
  if (code === 'ERR_UNAUTHORIZED') return { status: 'unauthorized' };
  if (code === 'ERR_UNSUPPORTED') return { status: 'unsupported' };
  return { status: 'error', message: e instanceof Error ? e.message : undefined };
}

export function startLiveTap(input: { amountCents: number; mode: 'send' | 'request' }, cb: TapCallbacks, deps: TapDeps) {
  const { nearby, backend, prepareRadio, scanForTokens } = deps;
  const uwbWaitMs = deps.uwbWaitMs ?? UWB_WAIT_MS;
  let stopped = false;
  let stopScan: (() => void) | null = null;
  let checking = false;
  let myToken = '';
  let niToken: string | null = null;
  const tracker = new ProximityTracker();

  /** Waits for UWB readings from the peer and decides. Falls back to Bluetooth on timeout. */
  const confirmWithUwb = (peerNiToken: string): Promise<{ verdict: 'accept' | 'reject'; distanceM: number | null }> =>
    new Promise((resolve) => {
      if (!nearby) return resolve({ verdict: 'accept', distanceM: null });
      const distances: number[] = [];
      let settled = false;
      const finish = (verdict: 'accept' | 'reject', distanceM: number | null) => {
        if (settled) return;
        settled = true;
        sub.remove();
        clearTimeout(timer);
        resolve({ verdict, distanceM });
      };
      const sub = nearby.addListener('onDistance', ({ distance }) => {
        if (distance === null) return;
        distances.push(distance);
        const v = uwbVerdict(distances);
        if (v !== 'wait') finish(v, distance);
      });
      // No UWB reading in time (e.g. the other phone isn't pointing our way): trust Bluetooth.
      const timer = setTimeout(() => finish('accept', null), uwbWaitMs);
      nearby.runNearbyInteraction(peerNiToken).catch(() => finish('accept', null));
    });

  const check = async () => {
    if (checking || stopped) return;
    const token = tracker.closest();
    if (!token) return;
    checking = true;
    try {
      const peer = await backend.resolveTapToken(token).catch((): TapPeer | null => null);
      if (stopped) return;
      if (!peer) {
        tracker.ignore(token); // Not on the Tap screen, or not a Payvr session any more.
        return;
      }
      let via: TapFound['via'] = 'bluetooth';
      let distanceCm: number | null = null;
      if (niToken && peer.niToken) {
        const { verdict, distanceM } = await confirmWithUwb(peer.niToken);
        if (stopped) return;
        if (verdict === 'reject') {
          tracker.ignore(token); // Strong signal, but UWB says they're not touching.
          return;
        }
        if (distanceM !== null) {
          via = 'uwb';
          distanceCm = Math.round(distanceM * 100);
        }
      }
      stopScan?.();
      stopScan = null;
      cb.onFound({ ...peer, via, distanceCm });
    } finally {
      checking = false;
    }
  };

  (async () => {
    cb.onStatus('starting');
    const radio = await prepareRadio();
    if (stopped) return;
    if (radio !== 'ready') return cb.onStatus(radio);

    if (nearby?.isNearbyInteractionSupported()) {
      niToken = await nearby.startNearbyInteraction().catch(() => null);
    }
    try {
      const session = await backend.startTapSession({ ...input, niToken });
      if (stopped) return;
      myToken = session.bleToken;
      if (!nearby) return cb.onStatus('unsupported');
      await nearby.startAdvertising(tokenToUuid(myToken));
    } catch (e) {
      if (stopped) return;
      const { status, message } = errorStatus(e);
      return cb.onStatus(status, message);
    }
    if (stopped) return;

    stopScan = scanForTokens(
      (token, rssi) => {
        if (token === myToken) return;
        tracker.add(token, rssi);
        void check();
      },
      (message) => cb.onStatus('error', message),
    );
    cb.onStatus('searching');
  })();

  return {
    stop() {
      if (stopped) return;
      stopped = true;
      stopScan?.();
      nearby?.stopAdvertising().catch(() => {});
      nearby?.stopNearbyInteraction().catch(() => {});
      backend.endTapSession().catch(() => {});
    },
  };
}
