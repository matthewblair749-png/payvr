import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/**
 * Small key/value wrapper. Uses expo-secure-store on iOS/Android (Keychain / Keystore)
 * and localStorage on web, where SecureStore is unavailable (web is for previews only).
 *
 * SecureStore values are limited to ~2KB, and a Supabase session is often bigger, so
 * long values are split across `<key>.0`, `<key>.1`… with the chunk count in `<key>.n`.
 */
const CHUNK = 1800;
const web = Platform.OS === 'web';

async function nativeGet(key: string) {
  const count = await SecureStore.getItemAsync(`${key}.n`);
  if (!count) return SecureStore.getItemAsync(key);
  const parts = await Promise.all(
    Array.from({ length: Number(count) }, (_, i) => SecureStore.getItemAsync(`${key}.${i}`)),
  );
  return parts.some((p) => p === null) ? null : parts.join('');
}

async function nativeRemove(key: string) {
  const count = Number((await SecureStore.getItemAsync(`${key}.n`)) ?? 0);
  await Promise.all([
    SecureStore.deleteItemAsync(key),
    SecureStore.deleteItemAsync(`${key}.n`),
    ...Array.from({ length: count }, (_, i) => SecureStore.deleteItemAsync(`${key}.${i}`)),
  ]);
}

async function nativeSet(key: string, value: string) {
  await nativeRemove(key);
  if (value.length <= CHUNK) return SecureStore.setItemAsync(key, value);
  const parts = value.match(new RegExp(`[\\s\\S]{1,${CHUNK}}`, 'g')) ?? [];
  await Promise.all(parts.map((p, i) => SecureStore.setItemAsync(`${key}.${i}`, p)));
  await SecureStore.setItemAsync(`${key}.n`, String(parts.length));
}

export const storage = {
  async get(key: string): Promise<string | null> {
    try {
      return web ? (globalThis.localStorage?.getItem(key) ?? null) : await nativeGet(key);
    } catch {
      return null;
    }
  },
  async set(key: string, value: string): Promise<void> {
    try {
      if (web) globalThis.localStorage?.setItem(key, value);
      else await nativeSet(key, value);
    } catch {
      // Storage is best-effort in the prototype.
    }
  },
  async remove(key: string): Promise<void> {
    try {
      if (web) globalThis.localStorage?.removeItem(key);
      else await nativeRemove(key);
    } catch {
      // ignore
    }
  },
};

export const StorageKeys = {
  theme: 'payvr.theme',
  /** Mock-mode session flag. Live mode keeps the Supabase session under its own key. */
  session: 'payvr.session',
  pin: 'payvr.pin',
  biometrics: 'payvr.biometrics',
} as const;
