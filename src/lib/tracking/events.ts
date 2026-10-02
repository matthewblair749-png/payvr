/**
 * Checkout analytics vocabulary, shared by the browser tracker, the ingest
 * endpoint and the dashboard queries.
 *
 * Funnel steps (a session's furthest step decides where it dropped off):
 *   view → engaged → details → payment → submitted → paid
 * Home's funnel groups them into five stages: Visit, Start, Details, Payment, Paid.
 * We record *which* block/field was touched, never what was typed.
 */
import { z } from "zod";

export const FUNNEL_STEPS = ["view", "engaged", "payment", "submitted", "paid"] as const;
export type FunnelStep = (typeof FUNNEL_STEPS)[number];

export const STEP_LABELS: Record<FunnelStep, string> = {
  view: "Viewed checkout",
  engaged: "Interacted",
  payment: "Started payment",
  submitted: "Pressed pay",
  paid: "Paid",
};

/** Home's five-stage funnel (see sessionsCte's `stage`). */
export const STAGES = [
  { key: "visit", label: "Visit", hint: "Opened checkout" },
  { key: "start", label: "Start", hint: "Interacted" },
  { key: "details", label: "Details", hint: "Contact, shipping" },
  { key: "payment", label: "Payment", hint: "Entered payment" },
  { key: "paid", label: "Paid", hint: "Payment went through" },
] as const;
export type StageKey = (typeof STAGES)[number]["key"];

/** What it means to be lost before each stage, in the merchant's words. */
export const LEAK_TITLES: Record<Exclude<StageKey, "visit">, string> = {
  start: "Left without starting",
  details: "Didn't finish their details",
  payment: "Didn't start paying",
  paid: "Didn't complete payment",
};

/** Fields a buyer can touch. Block types plus the payment sub-fields. */
export const FIELD_LABELS: Record<string, string> = {
  orderSummary: "Order summary",
  upsell: "Upsell",
  testimonial: "Testimonial",
  countdown: "Countdown",
  tipSlider: "Tip slider",
  payIn4: "Pay in 4",
  coupon: "Coupon field",
  trustBadges: "Trust badges",
  payment: "Payment block",
  email: "Email",
  shipping: "Shipping address",
  card: "Card details",
  none: "Left without touching anything",
};

export const clientEventSchema = z.object({
  type: z.enum(["VIEW", "FIELD_FOCUS", "STEP", "PAY_CLICK", "ABANDON"]),
  step: z.enum(["view", "engaged", "details", "payment", "submitted"]).optional(),
  field: z
    .string()
    .regex(/^[a-zA-Z_]{1,32}$/)
    .optional(),
  /** VIEW only: the referrer's hostname (never the full URL). */
  ref: z
    .string()
    .max(100)
    .regex(/^[a-z0-9.-]*$/i)
    .optional(),
  /** VIEW only: the utm_source tag. */
  utm: z
    .string()
    .max(40)
    .regex(/^[\w.-]*$/)
    .optional(),
});
export type ClientEvent = z.infer<typeof clientEventSchema>;

export const ingestSchema = z.object({
  pageId: z.string().min(1).max(40),
  variantId: z.string().min(1).max(40).nullable(),
  sessionId: z.string().uuid(),
  events: z.array(clientEventSchema).min(1).max(30),
});
export type IngestPayload = z.infer<typeof ingestSchema>;
