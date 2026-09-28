import { isSupabaseConfigured } from '@/services/supabase';

import { liveBackend } from './live';
import { mockBackend } from './mock';

/** Supabase when EXPO_PUBLIC_SUPABASE_URL / _ANON_KEY are set, otherwise in-memory mock data. */
export const backend = isSupabaseConfigured ? liveBackend : mockBackend;

export * from './types';
