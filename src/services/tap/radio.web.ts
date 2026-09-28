/** Web preview: no Bluetooth or UWB, so tapping always falls back to QR. */
import type PayvrNearbyType from '../../../modules/payvr-nearby';

export type RadioStatus = 'ready' | 'bluetooth_off' | 'unauthorized' | 'unsupported';

export async function prepareRadio(): Promise<RadioStatus> {
  return 'unsupported';
}

export function scanForTokens(_onToken: (token: string, rssi: number | null) => void, onError: (message: string) => void) {
  onError('Bluetooth is not available on the web.');
  return () => {};
}

export const nearbyNative: typeof PayvrNearbyType = null;
