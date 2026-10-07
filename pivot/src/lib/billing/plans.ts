/**
 * Plans and what each one includes. Shared by the pricing page, Settings ->
 * Billing and server-side entitlement checks (src/server/billing/entitlements.ts).
 */
export type PlanId = "FREE" | "PRO" | "BUSINESS" | "ENTERPRISE";

export interface PlanLimits {
  /** Datasets a workspace can hold (null = unlimited). */
  datasets: number | null;
  /** Rows per uploaded file. */
  rowsPerFile: number;
  members: number | null;
  /** Ask PIVOT questions per day. */
  askPerDay: number | null;
  /** Insights shown in full (the rest are summarized). */
  insights: number | null;
  uploads: boolean;
  simulator: boolean;
  reports: boolean;
  compareScenarios: boolean;
}

export interface Plan {
  id: PlanId;
  name: string;
  price: number | null;
  tagline: string;
  features: string[];
  limits: PlanLimits;
  cta: string;
}

export const TRIAL_DAYS = 14;

export const PLANS: Plan[] = [
  {
    id: "FREE",
    name: "Free",
    price: 0,
    tagline: "See what PIVOT finds.",
    features: ["Basic analytics", "Demo and sample data", "Limited AI insights", "5 Ask PIVOT questions a day"],
    limits: { datasets: 1, rowsPerFile: 5_000, members: 1, askPerDay: 5, insights: 3, uploads: false, simulator: false, reports: false, compareScenarios: false },
    cta: "Start free",
  },
  {
    id: "PRO",
    name: "Pro",
    price: 99,
    tagline: "For founders and operators.",
    features: ["Unlimited analysis", "AI insights and recommendations", "What-If simulator", "Monthly reports", "CSV data uploads"],
    limits: { datasets: 10, rowsPerFile: 200_000, members: 1, askPerDay: 200, insights: null, uploads: true, simulator: true, reports: true, compareScenarios: true },
    cta: `Start ${TRIAL_DAYS}-day trial`,
  },
  {
    id: "BUSINESS",
    name: "Business",
    price: 499,
    tagline: "For leadership teams.",
    features: ["Everything in Pro", "Advanced analytics", "Team access (up to 10)", "Multiple data sources", "Advanced reports"],
    limits: { datasets: null, rowsPerFile: 200_000, members: 10, askPerDay: 1_000, insights: null, uploads: true, simulator: true, reports: true, compareScenarios: true },
    cta: `Start ${TRIAL_DAYS}-day trial`,
  },
  {
    id: "ENTERPRISE",
    name: "Enterprise",
    price: null,
    tagline: "For larger organizations.",
    features: ["Everything in Business", "Unlimited team members", "SSO and audit logs", "Custom data connections", "Dedicated support"],
    limits: { datasets: null, rowsPerFile: 200_000, members: null, askPerDay: null, insights: null, uploads: true, simulator: true, reports: true, compareScenarios: true },
    cta: "Talk to sales",
  },
];

export const planById = (id: PlanId) => PLANS.find((p) => p.id === id)!;
