// Same rules as src/Shared/Rules/Notifications.luau: at most maxPerDay per local day, quiet hours,
// per-type switches, highest priority first. Night and season events are dropped in quiet hours.
export interface NotificationRules {
  maxPerDay: number;
  quietStartHour: number;
  quietEndHour: number;
  types: { id: string; priority: number }[];
}
export interface Candidate {
  type: string;
  at: number; // unix seconds
}

export function plan(rules: NotificationRules, candidates: Candidate[], settings: Record<string, boolean>, alreadySent: Record<string, number>, utcOffsetHours: number): Candidate[] {
  const priority = new Map(rules.types.map((t) => [t.id, t.priority]));
  const sorted = [...candidates].sort((a, b) => (priority.get(a.type) ?? 99) - (priority.get(b.type) ?? 99) || a.at - b.at);
  const sent = { ...alreadySent };
  const accepted: Candidate[] = [];
  for (const c of sorted) {
    if (!settings[c.type]) continue;
    const local = c.at + utcOffsetHours * 3600;
    const hour = Math.floor((((local % 86400) + 86400) % 86400) / 3600);
    const quiet = rules.quietStartHour > rules.quietEndHour ? hour >= rules.quietStartHour || hour < rules.quietEndHour : hour >= rules.quietStartHour && hour < rules.quietEndHour;
    let at: number | undefined = c.at;
    if (quiet) {
      if (c.type === "night_starting" || c.type === "season_changed") {
        at = undefined;
      } else {
        const dayStart = local - (((local % 86400) + 86400) % 86400);
        let end = dayStart + rules.quietEndHour * 3600;
        if (end <= local) end += 86400;
        at = end - utcOffsetHours * 3600;
      }
    }
    if (at === undefined) continue;
    const dayKey = String(Math.floor((at + utcOffsetHours * 3600) / 86400));
    if ((sent[dayKey] ?? 0) < rules.maxPerDay) {
      sent[dayKey] = (sent[dayKey] ?? 0) + 1;
      accepted.push({ type: c.type, at });
    }
  }
  return accepted.sort((a, b) => a.at - b.at);
}

// Global events every opted-in player may hear about, from the same config the game uses.
export function nextNightStart(cycle: { daySeconds: number; duskSeconds: number; nightSeconds: number; dawnSeconds: number; cycleEpochUtc: string }, now: number): number {
  const len = cycle.daySeconds + cycle.duskSeconds + cycle.nightSeconds + cycle.dawnSeconds;
  const epoch = Date.parse(cycle.cycleEpochUtc) / 1000;
  const index = Math.floor((now - epoch) / len);
  let start = epoch + index * len + cycle.daySeconds + cycle.duskSeconds;
  if (start <= now) start += len;
  return start;
}

export function nextSeasonStart(seasons: { anchorUtcDate: string; lengthDays: number }, now: number): number {
  const anchor = Date.parse(`${seasons.anchorUtcDate}T00:00:00Z`) / 1000;
  const length = seasons.lengthDays * 86400;
  return anchor + (Math.floor((now - anchor) / length) + 1) * length;
}
