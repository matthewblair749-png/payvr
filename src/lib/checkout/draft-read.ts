import { DRAFT_KEY } from "./draft";
import { checkoutConfigSchema, type CheckoutConfig } from "./schema";

/** Returns the saved draft only if it still validates against the schema. */
export function loadDraft(): CheckoutConfig | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    if (!raw) return null;
    const parsed = checkoutConfigSchema.safeParse(JSON.parse(raw));
    return parsed.success ? parsed.data : null;
  } catch {
    return null;
  }
}
