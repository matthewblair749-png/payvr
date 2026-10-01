/** Cookie holding the browser's IANA timezone, so the server can greet in local time. */
export const TZ_COOKIE = "lumen_tz";

/** "Good morning" etc. in `timeZone`; plain "Hello" when we don't know it yet. */
export function greetingFor(timeZone: string | undefined, now = new Date()): string {
  if (!timeZone) return "Hello";
  let hour: number;
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  } catch {
    return "Hello"; // not a real timezone
  }
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
