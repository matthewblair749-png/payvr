const fmt = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

/** 124050 -> "$1,240.50" */
export function formatCents(cents: number): string {
  return fmt.format(cents / 100);
}

/** Short form for sentences: 2000 -> "$20", 2050 -> "$20.50". */
export function formatShort(cents: number): string {
  const s = formatCents(cents);
  return s.endsWith('.00') ? s.slice(0, -3) : s;
}

export const MAX_AMOUNT_CENTS = 10_000_00;

/**
 * Applies a keypad press to the typed amount string ("12.5" etc).
 * Keeps at most 2 decimals and caps at MAX_AMOUNT_CENTS.
 */
export function applyKey(current: string, key: string): string {
  if (key === 'back') return current.length <= 1 ? '0' : current.slice(0, -1);
  if (key === '.') return current.includes('.') ? current : `${current}.`;
  const [, decimals] = current.split('.');
  if (decimals !== undefined && decimals.length >= 2) return current;
  const next = current === '0' ? key : current + key;
  return toCents(next) > MAX_AMOUNT_CENTS ? current : next;
}

export function toCents(amount: string): number {
  const n = Number.parseFloat(amount);
  return Number.isFinite(n) ? Math.round(n * 100) : 0;
}

/** Display form of the typed string: "1240.5" -> "$1,240.5" (keeps what the user typed). */
export function displayTyped(amount: string): string {
  const [whole, decimals] = amount.split('.');
  const w = Number(whole || '0').toLocaleString('en-US');
  return decimals === undefined ? `$${w}` : `$${w}.${decimals}`;
}
