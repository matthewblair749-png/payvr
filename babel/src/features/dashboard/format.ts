/** Dates are shown in UTC because limits and billing run on UTC. */
export function formatDay(date: Date): string {
  return date.toLocaleDateString("en-US", { month: "long", day: "numeric", timeZone: "UTC" });
}

export function untilPhrase(target: Date, now = new Date()): string {
  const hours = Math.round((target.getTime() - now.getTime()) / 3_600_000);
  if (hours <= 1) return "in under an hour";
  if (hours < 48) return `in about ${hours} hours`;
  return `in ${Math.round(hours / 24)} days`;
}

export function formatMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes} ${minutes === 1 ? "minute" : "minutes"}`;
  const hours = Math.round((minutes / 60) * 10) / 10;
  return `${hours.toLocaleString("en-US")} hours`;
}

/**
 * A starting display name from an email address: the part before the @,
 * without any "+tag" (sam+work@example.com → "sam").
 */
export function nameFromEmail(email: string): string {
  const local = email.split("@")[0] ?? "";
  return local.split("+")[0] || local;
}
