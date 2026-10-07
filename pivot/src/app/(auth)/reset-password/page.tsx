import type { Metadata } from "next";
import Link from "next/link";
import { ResetForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Choose a new password" };

export default async function ResetPasswordPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <>
      <h1 className="text-3xl font-heavy tracking-tighter text-ink">Choose a new password</h1>
      {typeof token === "string" && token.length >= 20 && token.length <= 100 ? (
        <>
          <p className="mt-2 text-[15px] text-muted">You&apos;ll be signed out of other devices.</p>
          <div className="mt-8">
            <ResetForm token={token} />
          </div>
        </>
      ) : (
        <p className="mt-4 text-[15px] text-muted">
          This link isn&apos;t complete.{" "}
          <Link href="/forgot-password" className="text-ink underline underline-offset-4">
            Request a new one
          </Link>
          .
        </p>
      )}
    </>
  );
}
