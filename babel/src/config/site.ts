/** Site-wide constants. */
export const SITE = {
  name: "babel",
  tagline: "Everyone speaks your language.",
  description:
    "Paste a link or some text and read it in your own language. Or open a room and chat with someone who speaks another one.",
} as const;

/**
 * Where every "Try it free" button points. Phase 1 has no accounts yet, so it
 * goes to the live demo; Phase 2 switches it to the sign-up page.
 */
export const SIGNUP_HREF = "/#try";

/**
 * Stripe Checkout arrives in Phase 2. Until then, paid-plan buttons send
 * people to the free demo instead of pretending to take payment.
 */
export const CHECKOUT_ENABLED = false;
