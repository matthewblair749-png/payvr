import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import type { Industry } from "@/lib/engine/types";
import { NORTHSTAR } from "@/lib/demo/northstar";
import type { Role } from "@/generated/prisma/client";
import { currentUser, requireUser, type SessionUser } from "./auth/session";
import { entitlementsFor, type Entitlements } from "./billing/entitlements";
import { db } from "./db";
import { UserError } from "./errors";

/**
 * The workspace a page or action runs in.
 *
 * - "app": a real company. The company always comes from a membership row
 *   for the signed-in user, never from anything the browser sends. This is
 *   the tenancy boundary: every data query below takes `company.id` from here.
 * - "demo": the public, read-only Northstar Commerce workspace at /demo.
 */
export interface WorkspaceCompany {
  id: string;
  name: string;
  currency: string;
  timezone: string;
  industry: Industry;
  marketSharePct: number | null;
  aiNarratives: boolean;
  dataVersion: number;
}

export type Workspace =
  | {
      mode: "app";
      basePath: "/app";
      user: SessionUser;
      role: Role;
      company: WorkspaceCompany;
      entitlements: Entitlements;
      companies: { id: string; name: string }[];
    }
  | {
      mode: "demo";
      basePath: "/demo";
      user: SessionUser | null;
      role: null;
      company: WorkspaceCompany;
      entitlements: Entitlements;
      companies: [];
    };

const INDUSTRIES: Industry[] = ["ecommerce", "retail", "saas", "services", "marketplace", "other"];
const asIndustry = (s: string | null): Industry => (INDUSTRIES.includes(s as Industry) ? (s as Industry) : "other");

async function load(userId: string, activeCompanyId: string | null) {
  const memberships = await db.companyMember.findMany({
    where: { userId },
    orderBy: { createdAt: "asc" },
    select: {
      role: true,
      company: {
        select: { id: true, name: true, currency: true, timezone: true, industry: true, marketSharePct: true, aiNarratives: true, dataVersion: true, plan: true, trialEndsAt: true },
      },
    },
  });
  if (!memberships.length) return null;
  const m = memberships.find((x) => x.company.id === activeCompanyId) ?? memberships[0];
  return { m, companies: memberships.map((x) => ({ id: x.company.id, name: x.company.name })) };
}

/** For app pages: the signed-in user's workspace, or a redirect (login / onboarding). */
export const requireWorkspace = cache(async (path = "/app"): Promise<Extract<Workspace, { mode: "app" }>> => {
  const user = await requireUser(path);
  const found = await load(user.id, user.activeCompanyId);
  if (!found) redirect("/onboarding");
  const { m, companies } = found;
  const c = m.company;
  return {
    mode: "app",
    basePath: "/app",
    user,
    role: m.role,
    company: { id: c.id, name: c.name, currency: c.currency, timezone: c.timezone, industry: asIndustry(c.industry), marketSharePct: c.marketSharePct, aiNarratives: c.aiNarratives, dataVersion: c.dataVersion },
    entitlements: entitlementsFor({ plan: c.plan, trialEndsAt: c.trialEndsAt }),
    companies,
  };
});

/**
 * For server actions: same, but throws instead of redirecting.
 *
 * Pass `expectedCompanyId` (the company the page was rendered for) from every
 * action that changes company-wide state. The active workspace lives on the
 * user, so switching in one tab changes it for every tab: without this check a
 * stale tab would save its form into the other company.
 */
export async function workspaceForAction(expectedCompanyId?: unknown): Promise<Extract<Workspace, { mode: "app" }>> {
  const user = await currentUser();
  if (!user) throw new UserError("Your session has ended. Log in again.");
  const found = await load(user.id, user.activeCompanyId);
  if (!found) throw new UserError("Create a workspace first.");
  const { m, companies } = found;
  const c = m.company;
  if (expectedCompanyId !== undefined && expectedCompanyId !== c.id) {
    throw new UserError(`You switched to ${c.name} in another tab. Reload this page and try again.`);
  }
  return {
    mode: "app",
    basePath: "/app",
    user,
    role: m.role,
    company: { id: c.id, name: c.name, currency: c.currency, timezone: c.timezone, industry: asIndustry(c.industry), marketSharePct: c.marketSharePct, aiNarratives: c.aiNarratives, dataVersion: c.dataVersion },
    entitlements: entitlementsFor({ plan: c.plan, trialEndsAt: c.trialEndsAt }),
    companies,
  };
}

export function requireRole(ws: { role: Role | null }, allowed: Role[], what: string) {
  if (!ws.role || !allowed.includes(ws.role)) throw new UserError(`Only workspace ${allowed.map((r) => r.toLowerCase()).join(" or ")}s can ${what}.`);
}

export const demoWorkspace = cache(async (): Promise<Extract<Workspace, { mode: "demo" }>> => ({
  mode: "demo",
  basePath: "/demo",
  user: await currentUser(),
  role: null,
  company: {
    id: "demo",
    name: NORTHSTAR.name,
    currency: NORTHSTAR.currency,
    timezone: "America/New_York",
    industry: NORTHSTAR.industry,
    marketSharePct: NORTHSTAR.marketSharePct,
    aiNarratives: true,
    dataVersion: 1,
  },
  entitlements: entitlementsFor({ plan: "BUSINESS", trialEndsAt: null }),
  companies: [],
}));
