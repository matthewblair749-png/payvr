import 'react-native-url-polyfill/auto';

import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import { storage } from './storage';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const key = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True when .env has Supabase keys. Without them the app runs on in-memory mock data. */
export const isSupabaseConfigured = !!(url && key);

/**
 * The Supabase client, or null in mock mode. Auth tokens are stored with
 * expo-secure-store (Keychain / Keystore) via the storage wrapper.
 */
export const supabase: SupabaseClient | null = isSupabaseConfigured
  ? createClient(url!, key!, {
      auth: {
        storage: {
          getItem: (k) => storage.get(k),
          setItem: (k, v) => storage.set(k, v),
          removeItem: (k) => storage.remove(k),
        },
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: false,
      },
    })
  : null;

// Only refresh tokens while the app is in the foreground (recommended for React Native).
if (supabase && Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
