import type { Tone } from "@/components/ui/badge";
import type { ImpactLevel, Level, Severity } from "@/lib/engine/types";

export const SEVERITY: Record<Severity, { label: string; tone: Tone }> = {
  ACTION: { label: "Action needed", tone: "negative" },
  OPPORTUNITY: { label: "Opportunity", tone: "positive" },
  WATCH: { label: "Watch", tone: "caution" },
};

/** Impact is good when high; risk and difficulty are good when low. */
export const impactTone = (l: ImpactLevel): Tone => (l === "Very high" || l === "High" ? "ink" : "neutral");
export const riskTone = (l: Level): Tone => (l === "High" ? "negative" : l === "Medium" ? "caution" : "neutral");

/** "Acme Inc." -> "Acme" for greetings. */
export function shortName(name: string) {
  return name.replace(/[,\s]+(inc\.?|llc|ltd\.?|limited|corp\.?|corporation|co\.?|gmbh|plc|s\.?a\.?)$/i, "").trim() || name;
}

export function greeting(timeZone: string, now = new Date()) {
  let hour = now.getUTCHours();
  try {
    hour = Number(new Intl.DateTimeFormat("en-US", { hour: "numeric", hourCycle: "h23", timeZone }).format(now));
  } catch {
    /* unknown zone: UTC */
  }
  return hour < 5 ? "Good evening" : hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}
