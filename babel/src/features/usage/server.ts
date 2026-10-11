import "server-only";
import type { PlanLimits } from "@/config/plans";
import { resolveEntitlement, type Entitlement } from "@/features/billing/entitlements";
import type { Db } from "@/server/db";
import { dayWindow, monthWindow, withinLimit } from "./windows";

/**
 * Server-side plan enforcement. The client is never asked how much it has
 * used; every check counts UsageEvent rows in Postgres.
 */

export type UsageKind = "translation" | "live_minutes";

const KINDS: Record<UsageKind, { limit: keyof PlanLimits; window: (now: Date) => { start: Date; resetsAt: Date } }> = {
  translation: { limit: "translationsPerDay", window: dayWindow },
  live_minutes: { limit: "liveMinutesPerMonth", window: monthWindow },
};

export async function getEntitlement(db: Db, userId: string, now = new Date()): Promise<Entitlement> {
  const sub = await db.subscription.findUnique({ where: { userId } });
  return resolveEntitlement(sub, now);
}

export type Reservation =
  | { ok: true; eventId: string; used: number; limit: number; resetsAt: Date }
  | { ok: false; used: number; limit: number; resetsAt: Date };

/**
 * Atomically checks the limit and records the usage. A per-user advisory
 * lock serialises concurrent requests from the same person, so two parallel
 * requests can't both squeeze under the limit.
 */
export async function reserveUsage(
  db: Db,
  userId: string,
  kind: UsageKind,
  quantity = 1,
  now = new Date(),
): Promise<Reservation> {
  const { limit: limitKey, window } = KINDS[kind];
  const { start, resetsAt } = window(now);

  return db.$transaction(async (tx) => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`usage:${userId}`}))`;

    const sub = await tx.subscription.findUnique({ where: { userId } });
    const limit = resolveEntitlement(sub, now).plan.limits[limitKey];

    const total = await tx.usageEvent.aggregate({
      where: { userId, kind, createdAt: { gte: start } },
      _sum: { quantity: true },
    });
    const used = total._sum.quantity ?? 0;

    if (!withinLimit(used, limit, quantity)) return { ok: false, used, limit, resetsAt };

    const event = await tx.usageEvent.create({ data: { userId, kind, quantity, createdAt: now } });
    return { ok: true, eventId: event.id, used: used + quantity, limit, resetsAt };
  });
}

/** Gives a reservation back, e.g. when the translation provider failed. */
export async function releaseUsage(db: Db, eventId: string): Promise<void> {
  await db.usageEvent.deleteMany({ where: { id: eventId } });
}

export interface UsageSummary {
  entitlement: Entitlement;
  translations: { used: number; limit: number; resetsAt: Date };
  liveMinutes: { used: number; limit: number; resetsAt: Date };
}

/** Everything the dashboard needs to explain usage in plain words. */
export async function getUsageSummary(db: Db, userId: string, now = new Date()): Promise<UsageSummary> {
  const entitlement = await getEntitlement(db, userId, now);
  const day = dayWindow(now);
  const month = monthWindow(now);
  const [translations, minutes] = await Promise.all([
    db.usageEvent.aggregate({ where: { userId, kind: "translation", createdAt: { gte: day.start } }, _sum: { quantity: true } }),
    db.usageEvent.aggregate({ where: { userId, kind: "live_minutes", createdAt: { gte: month.start } }, _sum: { quantity: true } }),
  ]);
  return {
    entitlement,
    translations: { used: translations._sum.quantity ?? 0, limit: entitlement.plan.limits.translationsPerDay, resetsAt: day.resetsAt },
    liveMinutes: { used: minutes._sum.quantity ?? 0, limit: entitlement.plan.limits.liveMinutesPerMonth, resetsAt: month.resetsAt },
  };
}

/** Room size check for Phase 3: can a room hold one more person? */
export function roomHasSpace(entitlement: Entitlement, peopleInRoom: number): boolean {
  return withinLimit(peopleInRoom, entitlement.plan.limits.roomSize);
}
