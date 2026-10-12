import { describe, expect, it } from "vitest";
import { getPlan } from "@/config/plans";
import { resolveEntitlement } from "@/features/billing/entitlements";
import { getUsageSummary, releaseUsage, reserveUsage, roomHasSpace } from "@/features/usage/server";
import { dayWindow, monthWindow, withinLimit } from "@/features/usage/windows";
import { createUser, describeDb, testDb } from "./helpers/db";

const NOW = new Date("2026-10-11T15:30:00Z");

describe("usage windows", () => {
  it("days run midnight to midnight UTC", () => {
    expect(dayWindow(NOW)).toEqual({ start: new Date("2026-10-11T00:00:00Z"), resetsAt: new Date("2026-10-12T00:00:00Z") });
  });

  it("months run from the 1st, including across a year end", () => {
    expect(monthWindow(new Date("2026-12-31T23:59:00Z"))).toEqual({
      start: new Date("2026-12-01T00:00:00Z"),
      resetsAt: new Date("2027-01-01T00:00:00Z"),
    });
  });

  it("withinLimit allows reaching the limit exactly, not passing it", () => {
    expect(withinLimit(29, 30)).toBe(true);
    expect(withinLimit(30, 30)).toBe(false);
    expect(withinLimit(25, 30, 5)).toBe(true);
    expect(withinLimit(25, 30, 6)).toBe(false);
  });

  it("room size follows the plan", () => {
    const free = resolveEntitlement(null);
    expect(roomHasSpace(free, 1)).toBe(true);
    expect(roomHasSpace(free, free.plan.limits.roomSize)).toBe(false);
  });
});

async function subscribe(userId: string, overrides: Partial<{ plan: string; status: string; paymentFailedAt: Date; graceEndsAt: Date }> = {}) {
  await testDb.subscription.create({
    data: {
      userId,
      stripeSubscriptionId: `sub_${userId}`,
      stripeCustomerId: `cus_${userId}`,
      plan: "plus",
      interval: "monthly",
      status: "active",
      stripeEventAt: NOW,
      ...overrides,
    },
  });
}

describeDb("plan-limit enforcement (Postgres)", () => {
  const freeLimit = getPlan("free").limits.translationsPerDay;
  const plusLimit = getPlan("plus").limits.translationsPerDay;

  it("lets a Free user translate up to the daily limit, then stops them", async () => {
    const user = await createUser();
    for (let i = 0; i < freeLimit; i++) {
      expect((await reserveUsage(testDb, user.id, "translation", 1, NOW)).ok).toBe(true);
    }
    const refused = await reserveUsage(testDb, user.id, "translation", 1, NOW);
    expect(refused).toMatchObject({ ok: false, used: freeLimit, limit: freeLimit });
  });

  it("can't be beaten with parallel requests", async () => {
    const user = await createUser();
    const results = await Promise.all(
      Array.from({ length: freeLimit + 15 }, () => reserveUsage(testDb, user.id, "translation", 1, NOW)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(freeLimit);
    expect(await testDb.usageEvent.count({ where: { userId: user.id } })).toBe(freeLimit);
  });

  it("resets the next UTC day", async () => {
    const user = await createUser();
    for (let i = 0; i < freeLimit; i++) await reserveUsage(testDb, user.id, "translation", 1, NOW);
    expect((await reserveUsage(testDb, user.id, "translation", 1, NOW)).ok).toBe(false);
    const tomorrow = new Date("2026-10-12T00:00:01Z");
    expect((await reserveUsage(testDb, user.id, "translation", 1, tomorrow)).ok).toBe(true);
  });

  it("gives paid users their plan's limit", async () => {
    const user = await createUser();
    await subscribe(user.id);
    const reservation = await reserveUsage(testDb, user.id, "translation", 1, NOW);
    expect(reservation).toMatchObject({ ok: true, limit: plusLimit });
  });

  it("keeps paid limits during the grace period and drops them after", async () => {
    const graced = await createUser();
    await subscribe(graced.id, { status: "past_due", paymentFailedAt: NOW, graceEndsAt: new Date("2026-10-18T00:00:00Z") });
    expect(await reserveUsage(testDb, graced.id, "translation", 1, NOW)).toMatchObject({ limit: plusLimit });

    const lapsed = await createUser();
    await subscribe(lapsed.id, { status: "past_due", paymentFailedAt: NOW, graceEndsAt: new Date("2026-10-11T00:00:00Z") });
    expect(await reserveUsage(testDb, lapsed.id, "translation", 1, NOW)).toMatchObject({ limit: freeLimit });
  });

  it("gives a reservation back when the translation fails", async () => {
    const user = await createUser();
    const reservation = await reserveUsage(testDb, user.id, "translation", 1, NOW);
    if (!reservation.ok) throw new Error("expected a reservation");
    await releaseUsage(testDb, reservation.eventId);
    expect(await testDb.usageEvent.count({ where: { userId: user.id } })).toBe(0);
  });

  it("limits live minutes per month, counting quantity", async () => {
    const user = await createUser();
    const minutes = getPlan("free").limits.liveMinutesPerMonth;
    expect((await reserveUsage(testDb, user.id, "live_minutes", minutes - 5, NOW)).ok).toBe(true);
    expect((await reserveUsage(testDb, user.id, "live_minutes", 10, NOW)).ok).toBe(false);
    expect((await reserveUsage(testDb, user.id, "live_minutes", 5, NOW)).ok).toBe(true);
  });

  it("summarises usage for the dashboard", async () => {
    const user = await createUser();
    await reserveUsage(testDb, user.id, "translation", 1, NOW);
    await reserveUsage(testDb, user.id, "translation", 1, NOW);
    await reserveUsage(testDb, user.id, "live_minutes", 12, NOW);
    const summary = await getUsageSummary(testDb, user.id, NOW);
    expect(summary.translations).toEqual({ used: 2, limit: freeLimit, resetsAt: new Date("2026-10-12T00:00:00Z") });
    expect(summary.liveMinutes.used).toBe(12);
    expect(summary.entitlement.plan.id).toBe("free");
  });
});
