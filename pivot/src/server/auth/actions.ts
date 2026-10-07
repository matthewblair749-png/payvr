"use server";

import { after } from "next/server";
import { redirect } from "next/navigation";
import { z } from "zod";
import { safeNext } from "@/lib/safe-next";
import { companyName, email, fieldErrors, industry, password, personName } from "@/lib/validation";
import { TRIAL_DAYS } from "@/lib/billing/plans";
import { db } from "../db";
import { appUrl, devMailEnabled, lastDevLink, sendEmail } from "../email";
import { GENERIC_ERROR } from "../errors";
import { checkLimit, clearLimit, LIMITS, rateLimit, RateLimitError, recordHit } from "../rate-limit";
import { clientIp, userAgent } from "../request-meta";
import { dummyHash, hashPassword, verifyPassword } from "./password";
import { createSession, currentUser, destroySession, requireUser } from "./session";
import { hashToken, newToken } from "./tokens";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; message?: string; devLink?: string | null; values?: Record<string, string> } | undefined;

const str = (f: FormData, k: string) => {
  const v = f.get(k);
  return typeof v === "string" ? v : "";
};

function limited(e: unknown): FormState | null {
  return e instanceof RateLimitError ? { error: e.message } : null;
}

// ---------------------------------------------------------------------------

const SignupSchema = z.object({ name: personName, email, password });

export async function signup(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { name: str(form, "name"), email: str(form, "email") };
  try {
    rateLimit(`signup:${await clientIp()}`, LIMITS.signup);
  } catch (e) {
    return limited(e) ?? { error: GENERIC_ERROR };
  }
  const parsed = SignupSchema.safeParse({ ...values, password: str(form, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };

  const existing = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true } });
  if (existing) return { fieldErrors: { email: "There's already an account with this email. Log in instead." }, values };

  const user = await db.user.create({
    data: { email: parsed.data.email, name: parsed.data.name, passwordHash: await hashPassword(parsed.data.password) },
  });
  await createSession(user.id, await userAgent());
  const next = safeNext(str(form, "next"), "");
  redirect(next.startsWith("/invite/") ? next : "/onboarding");
}

// ---------------------------------------------------------------------------

const LoginSchema = z.object({ email, password: z.string().min(1, { error: "Enter your password." }).max(200) });

export async function login(_prev: FormState, form: FormData): Promise<FormState> {
  const values = { email: str(form, "email") };
  const parsed = LoginSchema.safeParse({ email: values.email, password: str(form, "password") });
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  // Only failed attempts count, and a successful login clears this browser's count, so
  // someone who knows a user's email can't lock them out with a few junk passwords.
  const ip = await clientIp();
  const keys = [
    [`login:${parsed.data.email}:${ip}`, LIMITS.login],
    [`login:${parsed.data.email}`, LIMITS.loginAccount],
    [`login:ip:${ip}`, LIMITS.loginIp],
  ] as const;
  try {
    for (const [key, policy] of keys) checkLimit(key, policy);
  } catch (e) {
    return limited(e) ?? { error: GENERIC_ERROR };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data.email }, select: { id: true, passwordHash: true } });
  // Always run a full hash check so response time doesn't reveal whether the email exists.
  const ok = await verifyPassword(parsed.data.password, user?.passwordHash ?? (await dummyHash()));
  if (!user || !ok) {
    for (const [key, policy] of keys) recordHit(key, policy);
    return { error: "Email or password is incorrect.", values };
  }

  clearLimit(keys[0][0]);
  await createSession(user.id, await userAgent());
  redirect(safeNext(str(form, "next"), "/app"));
}

export async function logout() {
  await destroySession();
  redirect("/");
}

// ---------------------------------------------------------------------------

export async function requestPasswordReset(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = email.safeParse(str(form, "email"));
  if (!parsed.success) return { fieldErrors: { email: parsed.error.issues[0].message }, values: { email: str(form, "email") } };
  try {
    rateLimit(`reset:ip:${await clientIp()}`, { limit: 20, windowMs: LIMITS.passwordReset.windowMs });
    rateLimit(`reset:${parsed.data}`, LIMITS.passwordReset);
  } catch (e) {
    return limited(e) ?? { error: GENERIC_ERROR };
  }

  const user = await db.user.findUnique({ where: { email: parsed.data }, select: { id: true, name: true } });
  if (user) {
    const to = parsed.data;
    const issue = async () => {
      const token = newToken();
      await db.passwordResetToken.create({ data: { userId: user.id, tokenHash: hashToken(token), expiresAt: new Date(Date.now() + 60 * 60_000) } });
      await sendEmail({
        to,
        subject: "Reset your PIVOT password",
        heading: "Reset your password",
        body: `Hi ${user.name.split(" ")[0]}, use the button below to choose a new password. The link works once and expires in 1 hour.`,
        cta: { label: "Choose a new password", url: appUrl(`/reset-password?token=${token}`) },
      });
    };
    // Local development shows the link on screen, so it must exist before we answer.
    // Everywhere else the email goes out after the response, so neither the time it
    // takes nor a mail-server error reveals that the account exists.
    if (devMailEnabled()) await issue();
    else after(() => issue().catch((e) => console.error("[pivot] reset email failed", e)));
  }
  // Same answer either way: no account enumeration.
  return { message: "If there's an account for that email, we've sent a link to reset the password. It expires in 1 hour.", devLink: lastDevLink(parsed.data) };
}

const ResetSchema = z
  .object({ token: z.string().min(20).max(100), password, confirm: z.string() })
  .refine((v) => v.password === v.confirm, { error: "Passwords don't match.", path: ["confirm"] });

export async function resetPassword(_prev: FormState, form: FormData): Promise<FormState> {
  const parsed = ResetSchema.safeParse({ token: str(form, "token"), password: str(form, "password"), confirm: str(form, "confirm") });
  if (!parsed.success) {
    const errs = fieldErrors(parsed.error);
    return errs.token ? { error: "This reset link isn't valid. Request a new one." } : { fieldErrors: errs };
  }
  try {
    rateLimit(`reset-submit:${await clientIp()}`, { limit: 20, windowMs: 15 * 60_000 });
  } catch (e) {
    return limited(e) ?? { error: GENERIC_ERROR };
  }
  const record = await db.passwordResetToken.findUnique({ where: { tokenHash: hashToken(parsed.data.token) } });
  if (!record || record.usedAt || record.expiresAt < new Date()) return { error: "This reset link has expired or was already used. Request a new one." };

  const passwordHash = await hashPassword(parsed.data.password);
  await db.$transaction([
    db.user.update({ where: { id: record.userId }, data: { passwordHash } }),
    db.passwordResetToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    db.passwordResetToken.deleteMany({ where: { userId: record.userId, usedAt: null } }),
    // Changing the password signs out every other device.
    db.session.deleteMany({ where: { userId: record.userId } }),
  ]);
  await createSession(record.userId, await userAgent());
  redirect("/app");
}

// ---------------------------------------------------------------------------

const CompanySchema = z.object({ name: companyName, industry });

export async function createCompany(_prev: FormState, form: FormData): Promise<FormState> {
  const user = await requireUser("/onboarding");
  const values = { name: str(form, "name"), industry: str(form, "industry") };
  const parsed = CompanySchema.safeParse(values);
  if (!parsed.success) return { fieldErrors: fieldErrors(parsed.error), values };
  try {
    rateLimit(`company:${user.id}`, { limit: 10, windowMs: 60 * 60_000 });
  } catch (e) {
    return limited(e) ?? { error: GENERIC_ERROR };
  }
  const company = await db.company.create({
    data: {
      name: parsed.data.name,
      industry: parsed.data.industry,
      trialEndsAt: new Date(Date.now() + TRIAL_DAYS * 86_400_000),
      members: { create: { userId: user.id, role: "OWNER" } },
    },
  });
  await db.user.update({ where: { id: user.id }, data: { activeCompanyId: company.id } });
  redirect("/app?welcome=1");
}

// ---------------------------------------------------------------------------

export async function acceptInvite(token: string): Promise<FormState> {
  const user = await currentUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);
  if (typeof token !== "string" || token.length > 100) return { error: "This invitation isn't valid." };
  const invite = await db.invitation.findUnique({ where: { tokenHash: hashToken(token) } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return { error: "This invitation has expired or was already used. Ask for a new one." };
  if (invite.email !== user.email) return { error: `This invitation was sent to ${invite.email}. Log in with that email to accept it.` };
  await db.$transaction([
    db.companyMember.upsert({
      where: { companyId_userId: { companyId: invite.companyId, userId: user.id } },
      update: {},
      create: { companyId: invite.companyId, userId: user.id, role: invite.role },
    }),
    db.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } }),
    // Any duplicate invite ("resend") is used up too, so it can't bring someone back after they're removed.
    db.invitation.deleteMany({ where: { companyId: invite.companyId, email: invite.email, acceptedAt: null, id: { not: invite.id } } }),
    db.user.update({ where: { id: user.id }, data: { activeCompanyId: invite.companyId } }),
  ]);
  redirect("/app");
}
