import "server-only";
import { headers } from "next/headers";

/**
 * Client IP for rate limiting.
 *
 * Proxies append the address they saw to x-forwarded-for, so everything to the
 * left of your own proxies' entries is whatever the client sent and can't be
 * trusted. TRUSTED_PROXY_HOPS is how many proxies in front of the app append to
 * it (default 1: one load balancer or platform edge). The entry the outermost of
 * them added is the real client.
 */
export async function clientIp(): Promise<string> {
  return clientIpFrom(await headers(), process.env.TRUSTED_PROXY_HOPS);
}

export function clientIpFrom(h: { get(name: string): string | null }, trustedHops?: string): string {
  const hops = Math.max(1, Number.parseInt(trustedHops ?? "1", 10) || 1);
  const chain = (h.get("x-forwarded-for") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
  return chain[Math.max(0, chain.length - hops)] || h.get("x-real-ip")?.trim() || "local";
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
