import { isSupabaseConfigured } from '@/services/supabase';

const key = process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY;

if (key && !key.startsWith('pk_test_')) {
  console.warn('Payvr is a prototype and only accepts Stripe TEST keys (pk_test_…). Stripe is disabled.');
}

/** Only a TEST publishable key is ever used. */
export const stripePublishableKey = key?.startsWith('pk_test_') ? key : null;

/** Stripe handles Add money / Cash out when Supabase and a Stripe test key are both set. */
export const isStripeConfigured = isSupabaseConfigured && !!stripePublishableKey;
