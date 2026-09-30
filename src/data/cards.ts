/**
 * Cards linked to Payvr. Only display details are ever kept on the phone: brand, last 4 digits,
 * expiry. Never a full card number or security code. In test mode you pick one of Stripe's public
 * test cards; with Stripe connected the card is entered in Stripe's own secure sheet.
 */
export type CardBrand = 'visa' | 'mastercard' | 'amex' | 'discover';

export type LinkedCard = {
  id: string;
  brand: CardBrand;
  last4: string;
  expMonth: number;
  expYear: number;
  /** Where it came from, e.g. "Chase" (display only). */
  issuer: string;
  addedAt: string;
};

export const BRAND_NAME: Record<CardBrand, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
  discover: 'Discover',
};

/**
 * Flat, muted card faces so Payvr blue stays the one accent. (No gradients; no network logos.)
 */
export const CARD_FACE: Record<CardBrand, string> = {
  visa: '#1F2A44',
  mastercard: '#2A2A2F',
  amex: '#23465A',
  discover: '#3D3530',
};

/** Stripe's published test cards (they can't move real money). Only brand and last 4 are used. */
export const TEST_CARDS: Omit<LinkedCard, 'id' | 'addedAt'>[] = [
  { brand: 'visa', last4: '4242', expMonth: 12, expYear: 2030, issuer: 'Test Bank' },
  { brand: 'mastercard', last4: '4444', expMonth: 8, expYear: 2029, issuer: 'Test Credit Union' },
  { brand: 'amex', last4: '0005', expMonth: 3, expYear: 2031, issuer: 'Test Amex' },
  { brand: 'discover', last4: '1117', expMonth: 5, expYear: 2028, issuer: 'Test Discover' },
];

export const cardLabel = (c: Pick<LinkedCard, 'brand' | 'last4'>) => `${BRAND_NAME[c.brand]} •• ${c.last4}`;
