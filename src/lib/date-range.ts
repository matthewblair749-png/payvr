/** Global date range, shared by every app page through the `range` query param. */
export const RANGES = [
  { value: "7", label: "7d", long: "Last 7 days", days: 7 },
  { value: "30", label: "30d", long: "Last 30 days", days: 30 },
  { value: "90", label: "90d", long: "Last 90 days", days: 90 },
] as const;
export type RangeValue = (typeof RANGES)[number]["value"];
export const DEFAULT_RANGE: RangeValue = "30";

export function parseRange(v: unknown): RangeValue {
  return RANGES.some((r) => r.value === v) ? (v as RangeValue) : DEFAULT_RANGE;
}
export function rangeDays(v: RangeValue): number {
  return RANGES.find((r) => r.value === v)!.days;
}

/**
 * Like-for-like windows: the current period is the last `days` UTC days up to
 * now (today is partial), and the previous period ends at the same time of
 * day, `days` earlier. So a half-finished today is never compared with full days.
 */
export function periodWindows(days: number, now = new Date()) {
  const DAY = 86_400_000;
  const todayStart = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const from = new Date(todayStart - (days - 1) * DAY);
  const to = now;
  return {
    current: { from, to },
    previous: { from: new Date(from.getTime() - days * DAY), to: new Date(to.getTime() - days * DAY) },
  };
}
