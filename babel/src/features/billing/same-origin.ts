/**
 * Rejects cross-site form posts. Session cookies are SameSite=Lax already;
 * this is a second, explicit check on the endpoints that start payments.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const expected = process.env.APP_URL?.replace(/\/$/, "") ?? new URL(request.url).origin;
  return origin === expected;
}
