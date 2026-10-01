/**
 * Checkout analytics vocabulary, shared by the browser tracker, the ingest
 * endpoint and the dashboard queries.
 *
 * Funnel steps (a session's furthest step decides where it dropped off):
 *   view → engaged → payment → submitted → paid
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
  card: "Card details",
  none: "Left without touching anything",
};

export const clientEventSchema = z.object({
  type: z.enum(["VIEW", "FIELD_FOCUS", "STEP", "PAY_CLICK", "ABANDON"]),
  step: z.enum(["view", "engaged", "payment", "submitted"]).optional(),
  field: z
    .string()
    .regex(/^[a-zA-Z_]{1,32}$/)
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
