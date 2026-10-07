/**
 * An error whose message is safe and useful to show the user. Anything else
 * is logged on the server and replaced with a friendly, generic message, so
 * raw backend errors never reach the browser.
 */
export class UserError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UserError";
  }
}

export type ActionResult<T = undefined> = { ok: true; data: T } | { ok: false; error: string; fieldErrors?: Record<string, string> };

export const GENERIC_ERROR = "Something went wrong on our side. Please try again.";

/** Turn any thrown value into a safe ActionResult error. */
export function toActionError(e: unknown, fallback = GENERIC_ERROR): { ok: false; error: string } {
  if (e instanceof UserError) return { ok: false, error: e.message };
  // Next.js control-flow errors (redirect, notFound) must propagate.
  if (e && typeof e === "object" && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_")) throw e;
  console.error("[pivot]", e);
  return { ok: false, error: fallback };
}
