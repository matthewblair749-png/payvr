import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/forms";
import { safeNext } from "@/lib/safe-next";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Log in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const safe = safeNext(next, "");
  if (await currentUser()) redirect(safe || "/app");
  return (
    <>
      <h1 className="text-3xl font-heavy tracking-tighter text-ink">Welcome back</h1>
      <p className="mt-2 text-[15px] text-muted">Log in to see what changed in your business.</p>
      <div className="mt-8">
        <LoginForm next={safe || undefined} />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        New to PIVOT?{" "}
        <Link href={safe ? `/signup?next=${encodeURIComponent(safe)}` : "/signup"} className="text-ink underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </>
  );
}
