import "server-only";
import { headers } from "next/headers";

/** Best-effort client IP for rate limiting (set by the platform's proxy). */
export async function clientIp(): Promise<string> {
  const h = await headers();
  return h.get("x-forwarded-for")?.split(",")[0]?.trim() || h.get("x-real-ip") || "local";
}

export async function userAgent(): Promise<string | null> {
  return (await headers()).get("user-agent")?.slice(0, 200) ?? null;
}

/**
 * Same-origin check for route handlers that accept POSTs (server actions get
 * this from Next.js automatically). SameSite=Lax cookies already block most
 * cross-site requests; this closes the rest.
 */
export function isSameOrigin(request: Request): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}
