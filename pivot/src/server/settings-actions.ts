"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { CURRENCIES, companyName, email, fieldErrors, industry, password, personName } from "@/lib/validation";
import { refreshAnalysis } from "./analysis/refresh";
import { hashPassword, verifyPassword } from "./auth/password";
import { createSession, currentUser } from "./auth/session";
import { hashToken, newToken } from "./auth/tokens";
import { db } from "./db";
import { appUrl, lastDevLink, sendEmail } from "./email";
import { GENERIC_ERROR, UserError } from "./errors";
import { LIMITS, rateLimit, RateLimitError } from "./rate-limit";
import { userAgent } from "./request-meta";
import { requireRole, workspaceForAction } from "./workspace";

export type SettingsState = { ok?: boolean; message?: string; error?: string; fieldErrors?: Record<string, string>; devLink?: string | null } | undefined;

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};

function fail(e: unknown): SettingsState {
  if (e instanceof UserError || e instanceof RateLimitError) return { error: e.message };
  if (e instanceof z.ZodError) return { fieldErrors: fieldErrors(e) };
  console.error("[pivot] settings", e);
  return { error: GENERIC_ERROR };
}

// ---- Profile -----------------------------------------------------------------

export async function updateProfile(_p: SettingsState, form: FormData): Promise<SettingsState> {
  try {
    const user = await currentUser();
    if (!user) throw new UserError("Your session has ended. Log in again.");
    rateLimit(`mutate:${user.id}`, LIMITS.mutate);
    const name = personName.parse(str(form, "name"));
    await db.user.update({ where: { id: user.id }, data: { name } });
    revalidatePath("/app", "layout");
    return { ok: true, message: "Profile saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function changePassword(_p: SettingsState, form: FormData): Promise<SettingsState> {
  try {
    const user = await currentUser();
    if (!user) throw new UserError("Your session has ended. Log in again.");
    rateLimit(`password:${user.id}`, { limit: 5, windowMs: 15 * 60_000 });
    const next = password.safeParse(str(form, "new"));
    if (!next.success) return { fieldErrors: { new: next.error.issues[0].message } };
    const row = await db.user.findUniqueOrThrow({ where: { id: user.id }, select: { passwordHash: true } });
    if (!(await verifyPassword(str(form, "current"), row.passwordHash))) return { fieldErrors: { current: "That's not your current password." } };
    await db.$transaction([db.user.update({ where: { id: user.id }, data: { passwordHash: await hashPassword(next.data) } }), db.session.deleteMany({ where: { userId: user.id } })]);
    // Every other device is signed out; this one gets a fresh session.
    await createSession(user.id, await userAgent());
    return { ok: true, message: "Password changed. Other devices have been signed out." };
  } catch (e) {
    return fail(e);
  }
}

// ---- Company -----------------------------------------------------------------

const CompanySchema = z.object({
  name: companyName,
  industry,
  currency: z.enum(CURRENCIES),
  timezone: z.string().max(64).refine((tz) => {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: tz });
      return true;
    } catch {
      return false;
    }
  }, "Pick a time zone from the list."),
  marketSharePct: z
    .string()
    .trim()
    .transform((v) => (v === "" ? null : Number(v)))
    .refine((v) => v === null || (Number.isFinite(v) && v > 0 && v <= 100), "Enter a percentage between 0 and 100, or leave it blank."),
});

export async function updateCompany(_p: SettingsState, form: FormData): Promise<SettingsState> {
  try {
    const ws = await workspaceForAction();
    requireRole(ws, ["OWNER", "ADMIN"], "edit company settings");
    rateLimit(`mutate:${ws.user.id}`, LIMITS.mutate);
    const v = CompanySchema.parse({ name: str(form, "name"), industry: str(form, "industry"), currency: str(form, "currency"), timezone: str(form, "timezone"), marketSharePct: str(form, "marketSharePct") });
    const affectsAnalysis = v.industry !== ws.company.industry || v.marketSharePct !== ws.company.marketSharePct || v.currency !== ws.company.currency || v.name !== ws.company.name;
    await db.company.update({
      where: { id: ws.company.id },
      data: { ...v, ...(affectsAnalysis ? { dataVersion: { increment: 1 } } : {}) },
    });
    if (affectsAnalysis) await refreshAnalysis(ws.company.id);
    revalidatePath("/app", "layout");
    return { ok: true, message: "Company settings saved." };
  } catch (e) {
    return fail(e);
  }
}

// ---- Team --------------------------------------------------------------------

const InviteSchema = z.object({ email, role: z.enum(["ADMIN", "MEMBER"]) });

export async function inviteMember(_p: SettingsState, form: FormData): Promise<SettingsState> {
  try {
    const ws = await workspaceForAction();
    requireRole(ws, ["OWNER", "ADMIN"], "invite people");
    rateLimit(`invite:${ws.company.id}`, { limit: 20, windowMs: 60 * 60_000 });
    const v = InviteSchema.parse({ email: str(form, "email"), role: str(form, "role") });
    const limit = ws.entitlements.limits.members;
    const [members, pending] = await Promise.all([
      db.companyMember.count({ where: { companyId: ws.company.id } }),
      db.invitation.count({ where: { companyId: ws.company.id, acceptedAt: null, expiresAt: { gt: new Date() } } }),
    ]);
    if (limit !== null && members + pending >= limit) throw new UserError(limit === 1 ? "Team access is part of the Business plan. Upgrade in Billing to invite people." : `Your plan includes ${limit} people. Upgrade to add more.`);
    const already = await db.companyMember.findFirst({ where: { companyId: ws.company.id, user: { email: v.email } }, select: { id: true } });
    if (already) throw new UserError("That person is already in this workspace.");

    const token = newToken();
    await db.invitation.create({
      data: { companyId: ws.company.id, email: v.email, role: v.role, tokenHash: hashToken(token), invitedById: ws.user.id, expiresAt: new Date(Date.now() + 7 * 86_400_000) },
    });
    await sendEmail({
      to: v.email,
      subject: `${ws.user.name} invited you to ${ws.company.name} on PIVOT`,
      heading: `Join ${ws.company.name} on PIVOT`,
      body: `${ws.user.name} invited you to see what's changing in ${ws.company.name}'s business, and what to do next. The invitation expires in 7 days.`,
      cta: { label: "Accept invitation", url: appUrl(`/invite/${token}`) },
    });
    revalidatePath("/app/settings/team");
    return { ok: true, message: `Invitation sent to ${v.email}.`, devLink: lastDevLink(v.email) };
  } catch (e) {
    return fail(e);
  }
}

export async function revokeInvite(id: string): Promise<SettingsState> {
  try {
    const ws = await workspaceForAction();
    requireRole(ws, ["OWNER", "ADMIN"], "manage invitations");
    if (typeof id !== "string" || id.length > 40) throw new UserError("That invitation doesn't exist.");
    await db.invitation.deleteMany({ where: { id, companyId: ws.company.id, acceptedAt: null } });
    revalidatePath("/app/settings/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

export async function removeMember(memberId: string): Promise<SettingsState> {
  try {
    const ws = await workspaceForAction();
    requireRole(ws, ["OWNER"], "remove people");
    if (typeof memberId !== "string" || memberId.length > 40) throw new UserError("That person isn't in this workspace.");
    const m = await db.companyMember.findFirst({ where: { id: memberId, companyId: ws.company.id } });
    if (!m) throw new UserError("That person isn't in this workspace.");
    if (m.userId === ws.user.id) throw new UserError("You can't remove yourself. Transfer ownership first.");
    await db.companyMember.delete({ where: { id: m.id } });
    revalidatePath("/app/settings/team");
    return { ok: true };
  } catch (e) {
    return fail(e);
  }
}

// ---- AI & notifications ------------------------------------------------------------

export async function updateAiSettings(aiNarratives: boolean): Promise<SettingsState> {
  try {
    const ws = await workspaceForAction();
    requireRole(ws, ["OWNER", "ADMIN"], "change AI settings");
    await db.company.update({ where: { id: ws.company.id }, data: { aiNarratives: Boolean(aiNarratives) } });
    revalidatePath("/app", "layout");
    return { ok: true, message: "AI settings saved." };
  } catch (e) {
    return fail(e);
  }
}

export async function updateNotifications(key: "notifyDigest" | "notifyAlerts", value: boolean): Promise<SettingsState> {
  try {
    const user = await currentUser();
    if (!user) throw new UserError("Your session has ended. Log in again.");
    if (key !== "notifyDigest" && key !== "notifyAlerts") throw new UserError("Unknown setting.");
    await db.user.update({ where: { id: user.id }, data: { [key]: Boolean(value) } });
    revalidatePath("/app/settings/notifications");
    return { ok: true, message: "Saved." };
  } catch (e) {
    return fail(e);
  }
}
