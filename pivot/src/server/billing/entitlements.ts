import "server-only";
import { planById, type PlanId, type PlanLimits } from "@/lib/billing/plans";
import { UserError } from "../errors";

export interface Entitlements {
  plan: PlanId;
  /** The plan whose limits apply right now (Pro during the trial). */
  effective: PlanId;
  trialActive: boolean;
  trialDaysLeft: number;
  limits: PlanLimits;
}

export function entitlementsFor(company: { plan: PlanId; trialEndsAt: Date | null }, now = new Date()): Entitlements {
  const trialActive = company.plan === "FREE" && company.trialEndsAt !== null && company.trialEndsAt > now;
  const effective: PlanId = trialActive ? "PRO" : company.plan;
  return {
    plan: company.plan,
    effective,
    trialActive,
    trialDaysLeft: trialActive ? Math.ceil((company.trialEndsAt!.getTime() - now.getTime()) / 86_400_000) : 0,
    limits: planById(effective).limits,
  };
}

/** Server-side gate: throws a friendly error the UI can show. */
export function requireFeature(e: Entitlements, feature: "uploads" | "simulator" | "reports" | "compareScenarios", label: string) {
  if (!e.limits[feature]) throw new UserError(`${label} is part of the Pro plan. Upgrade in Settings → Billing to use it.`);
}
