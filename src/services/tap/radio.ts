/**
 * The phone's radios for tapping: Bluetooth LE scanning (react-native-ble-plx),
 * advertising and Nearby Interaction (our native module, modules/payvr-nearby).
 * Web has its own stub in radio.web.ts.
 */
import { PermissionsAndroid, Platform } from 'react-native';
import { BleManager, ScanMode, State } from 'react-native-ble-plx';

import PayvrNearby from '../../../modules/payvr-nearby';

import { findToken } from './ble-token';

export type RadioStatus = 'ready' | 'bluetooth_off' | 'unauthorized' | 'unsupported';

let manager: BleManager | null = null;

function bleManager(): BleManager | null {
  if (!manager) {
    try {
      manager = new BleManager();
    } catch {
      return null; // No native BLE module (e.g. Expo Go).
    }
  }
  return manager;
}

async function androidPermissions(): Promise<boolean> {
  if (Platform.OS !== 'android') return true;
  const P = PermissionsAndroid.PERMISSIONS;
  const wanted =
    Number(Platform.Version) >= 31
      ? [P.BLUETOOTH_SCAN, P.BLUETOOTH_CONNECT, P.BLUETOOTH_ADVERTISE]
      : [P.ACCESS_FINE_LOCATION];
  const result = await PermissionsAndroid.requestMultiple(wanted);
  return wanted.every((p) => result[p] === PermissionsAndroid.RESULTS.GRANTED);
}

/** Waits for Bluetooth to settle (iOS shows its permission prompt on first use). */
function settledState(m: BleManager, timeoutMs = 10_000): Promise<State> {
  return new Promise((resolve) => {
    let done = false;
    const finish = (s: State) => {
      if (done) return;
      done = true;
      sub.remove();
      clearTimeout(timer);
      resolve(s);
    };
    const sub = m.onStateChange((s) => {
      if (s !== State.Unknown && s !== State.Resetting) finish(s);
    }, true);
    const timer = setTimeout(() => finish(State.Unknown), timeoutMs);
  });
}

/** Checks everything tapping needs. Only call this from the Tap screen. */
export async function prepareRadio(): Promise<RadioStatus> {
  if (!PayvrNearby) return 'unsupported';
  const m = bleManager();
  if (!m) return 'unsupported';
  if (!(await androidPermissions())) return 'unauthorized';
  switch (await settledState(m)) {
    case State.PoweredOn:
      return 'ready';
    case State.PoweredOff:
      return 'bluetooth_off';
    case State.Unauthorized:
      return 'unauthorized';
    default:
      return 'unsupported';
  }
}

/** Scans for Payvr tap tokens; reports each sighting with its signal strength. */
export function scanForTokens(
  onToken: (token: string, rssi: number | null) => void,
  onError: (message: string) => void,
): () => void {
  const m = bleManager();
  if (!m) {
    onError('Bluetooth is not available.');
    return () => {};
  }
  m.startDeviceScan(null, { allowDuplicates: true, scanMode: ScanMode.LowLatency }, (error, device) => {
    if (error) {
      onError(error.message);
      return;
    }
    const token = findToken(device?.serviceUUIDs);
    if (token) onToken(token, device?.rssi ?? null);
  }).catch((e: Error) => onError(e.message));
  return () => {
    m.stopDeviceScan().catch(() => {});
  };
}

export const nearbyNative = PayvrNearby;
