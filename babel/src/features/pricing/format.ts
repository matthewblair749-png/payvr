import type { Plan } from "@/config/plans";

export function formatPrice(amount: number): string {
  return Number.isInteger(amount) ? `$${amount}` : `$${amount.toFixed(2)}`;
}

function formatMinutes(minutes: number): string {
  if (minutes < 120) return `${minutes} minutes`;
  return `${Math.round(minutes / 60).toLocaleString("en-US")} hours`;
}

/** Plain-language list of what a plan includes, built from the config. */
export function describePlan(plan: Plan): string[] {
  const { limits, features } = plan;
  const lines = [
    `${limits.translationsPerDay.toLocaleString("en-US")} translations a day`,
    `${formatMinutes(limits.liveMinutesPerMonth)} of live rooms a month`,
    limits.roomSize === 2 ? "Rooms for two people" : `Rooms for up to ${limits.roomSize} people`,
  ];
  if (features.toneControl) lines.push("Choose a formal or casual tone");
  if (features.voiceInput) lines.push("Voice input (early version)");
  if (features.sharedBilling) lines.push("One bill, add or remove people anytime");
  return lines;
}
