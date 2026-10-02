/**
 * Eligibility and limits. These mirror server-side settings (the server is the source of truth;
 * the app only uses them to explain things before a request is sent).
 */

/** The payments partner's minimum age. */
export const MIN_AGE = 18;

/** Countries the partner supports for sending and receiving. */
export const SUPPORTED_COUNTRIES = ['US'] as const;

/** Rolling 24-hour send limits, in cents, by verification tier. */
export const DAILY_LIMIT_CENTS = {
  /** Signed up, identity check not finished yet. */
  new: 250_00,
  /** Identity verified by the partner. */
  verified: 2_000_00,
} as const;

export const US_STATES = [
  'AL', 'AK', 'AZ', 'AR', 'CA', 'CO', 'CT', 'DE', 'DC', 'FL', 'GA', 'HI', 'ID', 'IL', 'IN', 'IA', 'KS', 'KY', 'LA', 'ME',
  'MD', 'MA', 'MI', 'MN', 'MS', 'MO', 'MT', 'NE', 'NV', 'NH', 'NJ', 'NM', 'NY', 'NC', 'ND', 'OH', 'OK', 'OR', 'PA', 'RI',
  'SC', 'SD', 'TN', 'TX', 'UT', 'VT', 'VA', 'WA', 'WV', 'WI', 'WY',
] as const;

/** Whole years between a birth date and today. */
export function ageOn(birth: Date, today = new Date()) {
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

/** Parses MM/DD/YYYY into a real calendar date, or null. */
export function parseDob(text: string): Date | null {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(text);
  if (!m) return null;
  const [mm, dd, yyyy] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const d = new Date(yyyy, mm - 1, dd);
  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) return null;
  if (yyyy < 1900 || d > new Date()) return null;
  return d;
}
