const BASE = "http://pivot.invalid";

/**
 * Only allow same-site relative redirects. Blocks `//evil.com`, `/\evil.com`
 * and `/<tab>/evil.com` (browsers strip tabs and newlines from URLs, which
 * turns the last one into `//evil.com`).
 */
export function safeNext(next: unknown, fallback = "/app"): string {
  if (typeof next !== "string" || !next.startsWith("/") || /[\u0000- \u007f\\]/.test(next)) return fallback;
  try {
    const url = new URL(next, BASE);
    return url.origin === BASE ? `${url.pathname}${url.search}${url.hash}` : fallback;
  } catch {
    return fallback;
  }
}
