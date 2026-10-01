/**
 * Checkout configuration schema.
 *
 * This is the single source of truth for what a checkout page looks like.
 * The landing-page demo, the Studio editor and the hosted /pay/[slug] page all
 * render from a `CheckoutConfig`, and it is what we persist as JSON in
 * `CheckoutPage.config`. Everything is validated with zod on the server
 * before it is saved, so the renderer can trust its input.
 */
import { z } from "zod";

// Zod's JIT compiler probes `new Function()`, which our CSP (no 'unsafe-eval')
// forbids. Jitless mode avoids the probe with negligible cost for our sizes.
z.config({ jitless: true });

import { SURVEY_QUESTION_KEYS } from "@/lib/survey/questions";
import { BLOCK_META, BLOCK_TYPES, FONT_KEYS, FONTS, type BlockType, type FontKey } from "./meta";
export { BLOCK_META, BLOCK_TYPES, FONT_KEYS, FONTS, type BlockType, type FontKey };

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Expected a 6-digit hex color like #F04A1A");

const shortText = (max: number) => z.string().trim().max(max);

// ---------------------------------------------------------------------------
// Blocks
// ---------------------------------------------------------------------------

const base = { id: z.string().min(1).max(40), hidden: z.boolean().default(false) };

export const blockSchema = z.discriminatedUnion("type", [
  z.object({ ...base, type: z.literal("orderSummary"), props: z.object({ showImage: z.boolean().default(true) }) }),
  z.object({
    ...base,
    type: z.literal("upsell"),
    props: z.object({
      title: shortText(60),
      description: shortText(140),
      priceCents: z.number().int().min(0).max(1_000_000),
    }),
  }),
  z.object({
    ...base,
    type: z.literal("testimonial"),
    props: z.object({
      quote: shortText(240),
      author: shortText(60),
      detail: shortText(60),
      rating: z.number().int().min(0).max(5),
    }),
  }),
  z.object({
    ...base,
    type: z.literal("countdown"),
    props: z.object({ label: shortText(60), minutes: z.number().int().min(1).max(24 * 60) }),
  }),
  z.object({
    ...base,
    type: z.literal("tipSlider"),
    props: z.object({ label: shortText(60), maxPercent: z.number().int().min(5).max(50) }),
  }),
  z.object({ ...base, type: z.literal("payIn4"), props: z.object({ label: shortText(60) }) }),
  z.object({
    ...base,
    type: z.literal("coupon"),
    props: z.object({
      placeholder: shortText(40),
      /** Codes this checkout accepts. Validated server-side at payment time. */
      codes: z
        .array(
          z.object({
            code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{2,24}$/, "Codes use letters, numbers, - and _"),
            percentOff: z.number().int().min(1).max(100),
          }),
        )
        .max(20)
        .default([]),
    }),
  }),
  z.object({
    ...base,
    type: z.literal("trustBadges"),
    props: z.object({ items: z.array(z.enum(["secure", "refund", "support", "shipping"])).max(4) }),
  }),
  z.object({
    ...base,
    type: z.literal("payment"),
    props: z.object({
      buttonLabel: shortText(30),
      /** Success celebration: a short vibration on supporting phones. */
      haptics: z.boolean().default(true),
      /** Success celebration: a soft two-note chime (off by default; sound should be opt-in). */
      sound: z.boolean().default(false),
    }),
  }),
]);

export type Block = z.infer<typeof blockSchema>;
export type BlockOf<T extends BlockType> = Extract<Block, { type: T }>;

// ---------------------------------------------------------------------------
// Theme + page
// ---------------------------------------------------------------------------

export const themeSchema = z.object({
  mode: z.enum(["light", "dark"]),
  accent: hex,
  /** Page background behind the checkout card. */
  background: hex,
  font: z.enum(FONT_KEYS),
  /** Corner radius in px for cards, inputs and buttons. */
  radius: z.number().int().min(0).max(28),
  layout: z.enum(["page", "modal"]),
});
export type Theme = z.infer<typeof themeSchema>;

export const checkoutConfigSchema = z.object({
  schemaVersion: z.literal(1),
  brand: z.object({
    name: shortText(48).min(1),
    /** Optional https logo URL (set by brand import or upload). */
    logoUrl: z.string().url().startsWith("https://").max(500).optional(),
  }),
  theme: themeSchema,
  /** One-tap question shown on the success screen after payment. */
  survey: z
    .object({
      enabled: z.boolean(),
      question: z.enum(SURVEY_QUESTION_KEYS),
    })
    .default({ enabled: true, question: "nearly_stopped" }),
  blocks: z
    .array(blockSchema)
    .max(20)
    .refine((b) => b.filter((x) => x.type === "payment").length === 1, "A checkout needs exactly one payment block")
    .refine((b) => new Set(b.map((x) => x.id)).size === b.length, "Block ids must be unique"),
});
export type CheckoutConfig = z.infer<typeof checkoutConfigSchema>;

/**
 * The product a checkout is selling. Comes from the Product/Price tables at
 * render time — deliberately NOT part of the design config.
 */
export type CheckoutProduct = {
  name: string;
  description: string;
  priceCents: number;
  currency: string;
  /** Optional https image; the demo uses a built-in illustration instead. */
  imageUrl?: string;
};
