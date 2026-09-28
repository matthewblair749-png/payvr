import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small key/value wrapper. Uses expo-secure-store on iOS/Android (Keychain / Keystore)
 * and localStorage on web, where SecureStore is unavailable (web is for previews only).
 */
export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      if (Platform.OS === 'web') return globalThis.localStorage?.getItem(key) ?? null;
      return await SecureStore.getItemAsync(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.setItem(key, value);
      else await SecureStore.setItemAsync(key, value);
    } catch {
      // Storage is best-effort in the prototype.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (Platform.OS === 'web') globalThis.localStorage?.removeItem(key);
      else await SecureStore.deleteItemAsync(key);
    } catch {
      // ignore
    }
  },
};

export const StorageKeys = {
  theme: 'payvr.theme',
  session: 'payvr.session',
  pin: 'payvr.pin',
  biometrics: 'payvr.biometrics',
} as const;
