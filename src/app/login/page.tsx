import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/server/auth";
import { safeNext } from "@/lib/safe-next";
import { AuthShell } from "./auth-shell";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  Verification: "That link has expired or was already used. Request a new one.",
  Default: "Something went wrong signing you in. Please try again.",
};

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const next = safeNext(sp.next ?? sp.callbackUrl);
  if ((await auth())?.user) redirect(next);
  const error = typeof sp.error === "string" ? (ERRORS[sp.error] ?? ERRORS.Default) : null;

  return (
    <AuthShell>
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Sign in to lumen</h1>
      <p className="mb-8 mt-3 text-muted-strong">No passwords. We&apos;ll email you a link.</p>
      {error && (
        <p role="alert" className="mb-5 rounded-2xl bg-surface px-4 py-3 text-sm font-medium">
          {error}
        </p>
      )}
      <LoginForm next={next} />
    </AuthShell>
  );
}
