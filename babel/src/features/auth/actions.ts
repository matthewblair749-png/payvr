"use server";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";
import { z } from "zod";
import { signIn, signOut } from "./auth";
import { safePath } from "./safe-path";

const emailSchema = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email()).pipe(z.string().max(254)),
  callbackUrl: z.string().optional(),
  mode: z.enum(["signin", "signup"]).default("signin"),
});

export async function signInWithEmail(formData: FormData) {
  const parsed = emailSchema.safeParse(Object.fromEntries(formData));
  const mode = formData.get("mode") === "signup" ? "signup" : "signin";
  const callbackUrl = safePath(formData.get("callbackUrl"));
  if (!parsed.success) {
    redirect(`/${mode}?error=InvalidEmail&callbackUrl=${encodeURIComponent(callbackUrl)}`);
  }
  try {
    // redirect: false sends the email without bouncing through Auth.js's own
    // /api/auth/verify-request page; we redirect to ours below.
    await signIn("nodemailer", { email: parsed.data.email, redirectTo: callbackUrl, redirect: false });
  } catch (error) {
    if (error instanceof AuthError) {
      redirect(`/${mode}?error=EmailSignin&callbackUrl=${encodeURIComponent(callbackUrl)}`);
    }
    throw error;
  }
  redirect("/signin/check-email");
}

export async function signInWithGoogle(formData: FormData) {
  await signIn("google", { redirectTo: safePath(formData.get("callbackUrl")) });
}

export async function signOutAction() {
  await signOut({ redirectTo: "/" });
}
