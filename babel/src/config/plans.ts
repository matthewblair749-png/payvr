/**
 * Every plan, price and limit in one place. Change a number here and the
 * pricing page (and, from Phase 2, server-side enforcement) follows.
 *
 * PRICES ARE PLACEHOLDERS until you set final ones. The amounts shown here
 * are for display; what Stripe charges comes from the Stripe Price each plan
 * points at through its lookup key (see stripeLookupKey below).
 */

export type PlanId = "free" | "plus" | "pro" | "teams";
export type BillingInterval = "monthly" | "annual";

export interface PlanLimits {
  /** Text/page translations per day. */
  translationsPerDay: number;
  /** Minutes of live room time per month. */
  liveMinutesPerMonth: number;
  /** Most people allowed in one room, including the host. */
  roomSize: number;
}

export interface PlanFeatures {
  /** Speak instead of type in rooms (browser speech recognition, early version). */
  voiceInput: boolean;
  /** Choose a formal or casual tone for translations. */
  toneControl: boolean;
  /** One bill and seat management for a group. */
  sharedBilling: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  /** One line in the Babel voice. */
  blurb: string;
  /** USD per month, before any annual discount. Per seat when perSeat. */
  monthlyPrice: number;
  perSeat: boolean;
  limits: PlanLimits;
  features: PlanFeatures;
  /** Gets the "most people pick this" treatment on the pricing page. */
  highlighted?: boolean;
}

/** Placeholder flag: shows a small "prices not final" note on the pricing page. */
export const PRICES_ARE_PLACEHOLDERS = true;

/** Annual billing = this many months' price for twelve months. */
export const ANNUAL_MONTHS_CHARGED = 10;

/** Days a subscription keeps working after a failed payment (Phase 2). */
export const PAYMENT_GRACE_PERIOD_DAYS = 7;

/** Teams seat range accepted at checkout. */
export const TEAM_SEATS = { min: 1, max: 500, default: 3 } as const;

export type PaidPlanId = Exclude<PlanId, "free">;
export const PAID_PLAN_IDS: PaidPlanId[] = ["plus", "pro", "teams"];

/**
 * Each Stripe Price is found by its lookup key, e.g. "babel_plus_monthly".
 * Set the same key on the Price in the Stripe dashboard. Changing a price
 * then means creating a new Price and moving the key; no code change.
 */
export function stripeLookupKey(plan: PaidPlanId, interval: BillingInterval): string {
  return `babel_${plan}_${interval}`;
}

/** Reverse of stripeLookupKey. Returns null for keys that aren't ours. */
export function parseLookupKey(key: string | null | undefined): { plan: PaidPlanId; interval: BillingInterval } | null {
  const match = /^babel_(plus|pro|teams)_(monthly|annual)$/.exec(key ?? "");
  if (!match) return null;
  return { plan: match[1] as PaidPlanId, interval: match[2] as BillingInterval };
}

export function isPlanId(value: string): value is PlanId {
  return value === "free" || (PAID_PLAN_IDS as string[]).includes(value);
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    blurb: "For the odd menu, message or postcard.",
    monthlyPrice: 0,
    perSeat: false,
    limits: { translationsPerDay: 30, liveMinutesPerMonth: 30, roomSize: 2 },
    features: { voiceInput: false, toneControl: false, sharedBilling: false },
  },
  {
    id: "plus",
    name: "Plus",
    blurb: "For staying in touch with people you care about.",
    monthlyPrice: 9,
    perSeat: false,
    limits: { translationsPerDay: 500, liveMinutesPerMonth: 600, roomSize: 4 },
    features: { voiceInput: true, toneControl: true, sharedBilling: false },
    highlighted: true,
  },
  {
    id: "pro",
    name: "Pro",
    blurb: "For working across languages every day.",
    monthlyPrice: 20,
    perSeat: false,
    limits: { translationsPerDay: 3_000, liveMinutesPerMonth: 3_000, roomSize: 12 },
    features: { voiceInput: true, toneControl: true, sharedBilling: false },
  },
  {
    id: "teams",
    name: "Teams",
    blurb: "Pro for everyone on your team, on one bill.",
    monthlyPrice: 16,
    perSeat: true,
    limits: { translationsPerDay: 3_000, liveMinutesPerMonth: 3_000, roomSize: 25 },
    features: { voiceInput: true, toneControl: true, sharedBilling: true },
  },
];

export function getPlan(id: PlanId): Plan {
  const plan = PLANS.find((p) => p.id === id);
  if (!plan) throw new Error(`Unknown plan: ${id}`);
  return plan;
}

/** What one month costs on the chosen interval (annual is shown per month). */
export function effectiveMonthlyPrice(plan: Plan, interval: BillingInterval): number {
  if (interval === "monthly") return plan.monthlyPrice;
  return Math.round(((plan.monthlyPrice * ANNUAL_MONTHS_CHARGED) / 12) * 100) / 100;
}

/** Total charged once a year on annual billing. */
export function annualTotal(plan: Plan): number {
  return plan.monthlyPrice * ANNUAL_MONTHS_CHARGED;
}
