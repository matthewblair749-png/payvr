// KPI formulas from docs/KPI_DASHBOARD.md, computed over analytics events sent by game servers.
export interface GameEvent {
  name: string;
  userId: number;
  at: number; // unix seconds
  props?: Record<string, unknown>;
}

const DAY = 86400;
const day = (t: number) => Math.floor(t / DAY);

export interface Kpis {
  dailyPlayers: number; // average distinct players per day
  day1Retention: number; // players seen again on day+1 / players whose first day is d (cohorts with day+1 in range)
  day7Retention: number;
  payerShare: number; // distinct payers / distinct players
  grossRobux: number;
  arpdauRobux: number; // gross Robux / sum of daily players over the period
  subscriptionConversion: number; // players who started Harbor Club / distinct players
  refundRate: number; // refunded Robux / gross Robux
}

export function computeKpis(events: GameEvent[], from: number, to: number): Kpis {
  const inRange = events.filter((e) => e.at >= from && e.at < to);
  const firstSeen = new Map<number, number>();
  const activeDays = new Map<number, Set<number>>();
  for (const e of events) {
    if (e.name !== "session_started" && e.name !== "session_length") continue;
    const d = day(e.at);
    if (!firstSeen.has(e.userId) || d < firstSeen.get(e.userId)!) firstSeen.set(e.userId, d);
    if (!activeDays.has(e.userId)) activeDays.set(e.userId, new Set());
    activeDays.get(e.userId)!.add(d);
  }
  const lastDay = day(to - 1);
  const retention = (offset: number) => {
    let cohort = 0;
    let back = 0;
    for (const [user, first] of firstSeen) {
      if (first < day(from) || first + offset > lastDay) continue;
      cohort++;
      if (activeDays.get(user)!.has(first + offset)) back++;
    }
    return cohort ? back / cohort : 0;
  };
  const dailyCounts = new Map<number, Set<number>>();
  for (const e of inRange) {
    if (e.name === "session_started") {
      const d = day(e.at);
      if (!dailyCounts.has(d)) dailyCounts.set(d, new Set());
      dailyCounts.get(d)!.add(e.userId);
    }
  }
  const players = new Set(inRange.filter((e) => e.name === "session_started").map((e) => e.userId));
  const playerDays = [...dailyCounts.values()].reduce((s, set) => s + set.size, 0);
  const days = Math.max(1, Math.ceil((to - from) / DAY));
  const purchases = inRange.filter((e) => e.name === "purchase_completed");
  const gross = purchases.reduce((s, e) => s + Number(e.props?.robux ?? 0), 0);
  const refunded = inRange.filter((e) => e.name === "purchase_refunded").reduce((s, e) => s + Number(e.props?.robux ?? 0), 0);
  const payers = new Set(purchases.map((e) => e.userId));
  const subscribers = new Set(inRange.filter((e) => e.name === "subscription_started").map((e) => e.userId));
  return {
    dailyPlayers: playerDays / days,
    day1Retention: retention(1),
    day7Retention: retention(7),
    payerShare: players.size ? payers.size / players.size : 0,
    grossRobux: gross,
    arpdauRobux: playerDays ? gross / playerDays : 0,
    subscriptionConversion: players.size ? subscribers.size / players.size : 0,
    refundRate: gross ? refunded / gross : 0,
  };
}
