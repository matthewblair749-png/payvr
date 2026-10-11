import { describe, expect, it } from "vitest";
import { resolveEntitlement, type SubscriptionState } from "@/features/billing/entitlements";

const NOW = new Date("2026-10-11T12:00:00Z");
const LATER = new Date("2026-10-18T12:00:00Z");
const EARLIER = new Date("2026-10-04T12:00:00Z");

function sub(overrides: Partial<SubscriptionState> = {}): SubscriptionState {
  return {
    plan: "plus",
    status: "active",
    seats: 1,
    currentPeriodEnd: LATER,
    cancelAtPeriodEnd: false,
    paymentFailedAt: null,
    graceEndsAt: null,
    ...overrides,
  };
}

describe("resolveEntitlement", () => {
  it("gives Free limits with no subscription", () => {
    const e = resolveEntitlement(null, NOW);
    expect(e.plan.id).toBe("free");
    expect(e.access.kind).toBe("free");
  });

  it("gives the paid plan when active, with the renewal date", () => {
    const e = resolveEntitlement(sub(), NOW);
    expect(e.plan.id).toBe("plus");
    expect(e.access).toEqual({ kind: "active", renewsAt: LATER });
  });

  it("keeps the plan until the period ends after cancelling", () => {
    const e = resolveEntitlement(sub({ cancelAtPeriodEnd: true }), NOW);
    expect(e.plan.id).toBe("plus");
    expect(e.access).toEqual({ kind: "ending", endsAt: LATER });
  });

  it("keeps the plan during the grace period after a failed payment", () => {
    const e = resolveEntitlement(sub({ status: "past_due", paymentFailedAt: EARLIER, graceEndsAt: LATER }), NOW);
    expect(e.plan.id).toBe("plus");
    expect(e.access).toEqual({ kind: "grace", graceEndsAt: LATER });
  });

  it("counts a recorded failure even while Stripe still says active", () => {
    const e = resolveEntitlement(sub({ paymentFailedAt: EARLIER, graceEndsAt: LATER }), NOW);
    expect(e.access.kind).toBe("grace");
  });

  it("drops to Free limits once the grace period is over", () => {
    const e = resolveEntitlement(sub({ status: "past_due", paymentFailedAt: EARLIER, graceEndsAt: EARLIER }), NOW);
    expect(e.plan.id).toBe("free");
    expect(e.subscribedPlan.id).toBe("plus");
    expect(e.access).toEqual({ kind: "lapsed", lapsedPlan: "plus" });
  });

  it("treats past_due with no grace recorded as lapsed, not free forever", () => {
    expect(resolveEntitlement(sub({ status: "unpaid" }), NOW).access.kind).toBe("lapsed");
  });

  it.each(["canceled", "incomplete", "incomplete_expired", "paused"])("gives Free limits when %s", (status) => {
    expect(resolveEntitlement(sub({ status }), NOW).plan.id).toBe("free");
  });

  it("ignores plans it doesn't know", () => {
    expect(resolveEntitlement(sub({ plan: "platinum" }), NOW).plan.id).toBe("free");
  });

  it("carries Teams seats through", () => {
    expect(resolveEntitlement(sub({ plan: "teams", seats: 7 }), NOW).seats).toBe(7);
  });
});
