/**
 * Only allow redirects to paths on this site. Stops "?callbackUrl=" from
 * being used to bounce people to another domain after signing in.
 */
export function safePath(value: unknown, fallback = "/dashboard"): string {
  if (typeof value !== "string") return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  return value;
}
