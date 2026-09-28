/** Stripe PaymentSheet: card details go straight from the phone to Stripe, never to Payvr. */
import { initPaymentSheet, initStripe, presentPaymentSheet } from '@stripe/stripe-react-native';

import { BRAND_BLUE } from '@/theme/colors';

import { stripePublishableKey } from './config';

let initialized = false;

export async function collectPayment(paymentIntentClientSecret: string): Promise<'paid' | 'canceled'> {
  if (!stripePublishableKey) throw new Error('Stripe is not configured.');
  if (!initialized) {
    await initStripe({ publishableKey: stripePublishableKey, urlScheme: 'payvr' });
    initialized = true;
  }
  const init = await initPaymentSheet({
    merchantDisplayName: 'Payvr (test mode)',
    paymentIntentClientSecret,
    returnURL: 'payvr://stripe-redirect',
    appearance: {
      colors: { primary: BRAND_BLUE },
      shapes: { borderRadius: 16 },
      primaryButton: { shapes: { borderRadius: 16 } },
    },
  });
  if (init.error) throw new Error(init.error.message);
  const result = await presentPaymentSheet();
  if (result.error) {
    if (result.error.code === 'Canceled') return 'canceled';
    throw new Error(result.error.message);
  }
  return 'paid';
}
