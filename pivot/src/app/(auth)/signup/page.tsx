import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { SignupForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Create your account" };

export default async function SignupPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = safeNext(next, "");
  if (await currentUser()) redirect(safe || "/app");
  return (
    <>
      <h1 className="text-3xl font-heavy tracking-tighter text-ink">Create your account</h1>
      <p className="mt-2 text-[15px] text-muted">Start your 14-day Pro trial. No credit card needed.</p>
      <div className="mt-8">
        <SignupForm next={safe || undefined} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Already have an account?{" "}
        <Link href={safe ? `/login?next=${encodeURIComponent(safe)}` : "/login"} className="text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
      <p className="mt-3 text-center text-sm text-muted">
        Just looking?{" "}
        <Link href="/demo" className="text-ink underline underline-offset-4">
          Explore the demo
        </Link>
      </p>
    </>
  );
}
