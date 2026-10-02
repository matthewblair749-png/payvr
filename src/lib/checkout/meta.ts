/**
 * Zod-free constants for checkout configs. Client bundles (landing page,
 * editor) import from here so they don't pull in the validator.
 */

export const FONT_KEYS = ["dmSans", "sora", "spaceGrotesk", "fraunces", "plexMono"] as const;
export type FontKey = (typeof FONT_KEYS)[number];

/** Human labels + CSS stacks for each selectable checkout font. */
export const FONTS: Record<FontKey, { label: string; stack: string; family: string }> = {
  dmSans: { label: "DM Sans", stack: "var(--font-dm-sans), ui-sans-serif, system-ui, sans-serif", family: "DM Sans" },
  sora: { label: "Sora", stack: "var(--font-sora), ui-sans-serif, system-ui, sans-serif", family: "Sora" },
  spaceGrotesk: { label: "Grotesk", stack: "var(--font-space-grotesk), ui-sans-serif, system-ui, sans-serif", family: "Space Grotesk" },
  fraunces: { label: "Fraunces", stack: "var(--font-fraunces), ui-serif, Georgia, serif", family: "Fraunces" },
  plexMono: { label: "Mono", stack: "var(--font-plex-mono), ui-monospace, monospace", family: "IBM Plex Mono" },
};

export const BLOCK_TYPES = [
  "orderSummary",
  "upsell",
  "testimonial",
  "countdown",
  "tipSlider",
  "payIn4",
  "coupon",
  "trustBadges",
  "payment",
] as const;
export type BlockType = (typeof BLOCK_TYPES)[number];

/** Display metadata for the block palette / layers list. */
export const BLOCK_META: Record<BlockType, { label: string; hint: string; removable: boolean }> = {
  orderSummary: { label: "Order summary", hint: "What they're buying", removable: true },
  upsell: { label: "Upsell", hint: "One-tap add-on", removable: true },
  testimonial: { label: "Testimonial", hint: "Social proof", removable: true },
  countdown: { label: "Countdown", hint: "Honest urgency", removable: true },
  tipSlider: { label: "Tip slider", hint: "Let fans say thanks", removable: true },
  payIn4: { label: "Pay in 4", hint: "Split into 4 payments", removable: true },
  coupon: { label: "Coupon field", hint: "Discount codes", removable: true },
  trustBadges: { label: "Trust badges", hint: "Reassurance", removable: true },
  payment: { label: "Payment", hint: "Stripe secure fields", removable: false },
};

