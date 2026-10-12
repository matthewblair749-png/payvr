import { getPlan, isPlanId, type Plan, type PlanId } from "@/config/plans";

/** The bits of a Subscription row that decide what someone can use. */
export interface SubscriptionState {
  plan: string;
  status: string;
  seats: number;
  currentPeriodEnd: Date | null;
  cancelAtPeriodEnd: boolean;
  paymentFailedAt: Date | null;
  graceEndsAt: Date | null;
}

export type AccessState =
  /** No paid subscription. */
  | { kind: "free" }
  /** Paid and in good standing. */
  | { kind: "active"; renewsAt: Date | null }
  /** Paid, cancelled, still running until the period ends. */
  | { kind: "ending"; endsAt: Date | null }
  /** A payment failed; the plan keeps working until graceEndsAt. */
  | { kind: "grace"; graceEndsAt: Date }
  /** A payment failed and the grace period ran out; back on Free limits. */
  | { kind: "lapsed"; lapsedPlan: PlanId };

export interface Entitlement {
  /** The plan whose limits apply right now. */
  plan: Plan;
  /** The plan they pay for (differs from `plan` only when lapsed). */
  subscribedPlan: Plan;
  access: AccessState;
  seats: number;
}

const GOOD_STANDING = new Set(["active", "trialing"]);
const PAYMENT_TROUBLE = new Set(["past_due", "unpaid"]);

/**
 * Works out which plan's limits apply. Pure, so it's easy to test and the
 * same answer is used by the dashboard and by server-side enforcement.
 */
export function resolveEntitlement(sub: SubscriptionState | null, now: Date = new Date()): Entitlement {
  const free = getPlan("free");
  if (!sub || !isPlanId(sub.plan) || sub.plan === "free") {
    return { plan: free, subscribedPlan: free, access: { kind: "free" }, seats: 1 };
  }
  const paid = getPlan(sub.plan);

  // canceled, incomplete, incomplete_expired, paused: nothing paid is running.
  if (!GOOD_STANDING.has(sub.status) && !PAYMENT_TROUBLE.has(sub.status)) {
    return { plan: free, subscribedPlan: free, access: { kind: "free" }, seats: 1 };
  }

  // A recorded failed payment counts even while Stripe still says "active":
  // depending on retry settings, the status only changes after several tries.
  if (sub.paymentFailedAt || PAYMENT_TROUBLE.has(sub.status)) {
    if (sub.graceEndsAt && now < sub.graceEndsAt) {
      return { plan: paid, subscribedPlan: paid, access: { kind: "grace", graceEndsAt: sub.graceEndsAt }, seats: sub.seats };
    }
    return { plan: free, subscribedPlan: paid, access: { kind: "lapsed", lapsedPlan: paid.id }, seats: 1 };
  }

  const access: AccessState = sub.cancelAtPeriodEnd
    ? { kind: "ending", endsAt: sub.currentPeriodEnd }
    : { kind: "active", renewsAt: sub.currentPeriodEnd };
  return { plan: paid, subscribedPlan: paid, access, seats: sub.seats };
}
