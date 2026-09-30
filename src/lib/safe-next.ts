/** Only allow same-site relative redirects (blocks open redirects like //evil.com). */
export function safeNext(next: unknown, fallback = "/studio"): string {
  return typeof next === "string" && /^\/(?![/\\])/.test(next) ? next : fallback;
}
