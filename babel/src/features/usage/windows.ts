/**
 * Usage windows, in UTC so every server agrees on when a day or month ends.
 * Daily limits reset at midnight UTC; monthly limits on the 1st (UTC).
 */
export function dayWindow(now: Date): { start: Date; resetsAt: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
  return { start, resetsAt: new Date(start.getTime() + 24 * 60 * 60 * 1000) };
}

export function monthWindow(now: Date): { start: Date; resetsAt: Date } {
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  return { start, resetsAt: new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1)) };
}

/** Pure limit check: may `amount` more be used on top of `used`? */
export function withinLimit(used: number, limit: number, amount = 1): boolean {
  return used + amount <= limit;
}
