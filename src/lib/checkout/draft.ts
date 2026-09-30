/**
 * Hand-off of an unsaved checkout design between the landing page and the
 * Studio. Lives in localStorage (per-browser, never sent anywhere) until the
 * merchant signs in and the Studio imports it into their account.
 *
 * Writing needs no validation, so this module stays zod-free to keep the
 * landing bundle small. Reading (and validating) lives in ./draft-read.ts.
 */
import type { CheckoutConfig } from "./schema";

export const DRAFT_KEY = "lumen:draft:v1";

export function saveDraft(config: CheckoutConfig) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(config));
  } catch {
    // Private mode / storage full: the Studio falls back to the demo config.
  }
}

export function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    /* ignore */
  }
}
