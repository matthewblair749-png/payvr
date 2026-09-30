"use server";

import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { z } from "zod";
import { signIn } from "@/server/auth";
import { safeNext } from "@/lib/safe-next";
import { RateLimitError } from "@/server/rate-limit";

export type LoginState = { error?: string; email?: string };

export async function requestMagicLink(_prev: LoginState, form: FormData): Promise<LoginState> {
  const email = z.string().trim().toLowerCase().email().max(254).safeParse(form.get("email"));
  if (!email.success) return { error: "Enter a valid email address.", email: String(form.get("email") ?? "") };
  try {
    // redirect:false so we navigate to our own page directly instead of bouncing
    // through Auth.js's /api/auth/verify-request route.
    await signIn("nodemailer", { email: email.data, redirectTo: safeNext(form.get("next")), redirect: false });
  } catch (e) {
    if (e instanceof RateLimitError || (e instanceof AuthError && e.cause?.err instanceof RateLimitError)) {
      return { error: "Too many sign-in emails. Try again in a few minutes.", email: email.data };
    }
    if (e instanceof AuthError) return { error: "We couldn't send your link. Please try again.", email: email.data };
    throw e;
  }
  redirect("/login/check-email");
}
