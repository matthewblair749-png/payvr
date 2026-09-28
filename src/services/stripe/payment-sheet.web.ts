/** The web preview can't show Stripe's native PaymentSheet. */
export async function collectPayment(_clientSecret: string): Promise<'paid' | 'canceled'> {
  throw new Error('Adding money with a card works in the Payvr app, not the web preview.');
}
