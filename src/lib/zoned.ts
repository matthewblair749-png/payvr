/**
 * Local calendar days in an IANA time zone, as UTC instants. "Yesterday" in
 * the brief is the merchant's yesterday, not UTC's.
 */

export function safeTimeZone(tz: string | null | undefined): string {
  if (!tz) return "UTC";
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return "UTC";
  }
}

/** Minutes the zone is ahead of UTC at `at`. */
function offsetMinutes(tz: string, at: Date): number {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    })
      .formatToParts(at)
      .map((p) => [p.type, p.value]),
  );
  const asUtc = Date.UTC(+parts.year, +parts.month - 1, +parts.day, +parts.hour, +parts.minute, +parts.second);
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The local date (YYYY-MM-DD) of `at` in `tz`. */
export function localDate(tz: string, at = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(at);
}

/** UTC instant of local midnight starting `ymd` in `tz` (DST-safe). */
export function localMidnight(tz: string, ymd: string): Date {
  const [y, m, d] = ymd.split("-").map(Number);
  const guess = Date.UTC(y, m - 1, d);
  // Two passes settle the offset even across a DST change.
  let t = guess - offsetMinutes(tz, new Date(guess)) * 60_000;
  t = guess - offsetMinutes(tz, new Date(t)) * 60_000;
  return new Date(t);
}

/** Shift a YYYY-MM-DD date by whole days. */
export function addDays(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}

/** [start, end) of a local day as UTC instants. */
export function localDayRange(tz: string, ymd: string) {
  return { from: localMidnight(tz, ymd), to: localMidnight(tz, addDays(ymd, 1)) };
}
