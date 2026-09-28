import { requireOptionalNativeModule, type NativeModule } from 'expo';

type Events = {
  /** Nearby Interaction distance to the peer in metres, or null when it's lost. */
  onDistance: (event: { distance: number | null }) => void;
  onNearbyError: (event: { message: string }) => void;
};

declare class PayvrNearbyNative extends NativeModule<Events> {
  /** True on iPhones with ultra-wideband (iPhone 11 and later). Always false on Android. */
  isNearbyInteractionSupported(): boolean;
  /** Starts advertising this 128-bit service UUID over Bluetooth LE (foreground only). */
  startAdvertising(serviceUuid: string): Promise<boolean>;
  stopAdvertising(): Promise<void>;
  /** Starts a Nearby Interaction session; resolves to this phone's discovery token (base64). */
  startNearbyInteraction(): Promise<string>;
  /** Points the session at the other phone's discovery token; distances arrive as onDistance. */
  runNearbyInteraction(peerToken: string): Promise<void>;
  stopNearbyInteraction(): Promise<void>;
}

/**
 * Payvr's native nearby module (modules/payvr-nearby). Null in Expo Go and on web,
 * where the app falls back to QR codes.
 */
export default requireOptionalNativeModule<PayvrNearbyNative>('PayvrNearby');
