import type { Metadata } from "next";
import Link from "next/link";
import { ForgotForm } from "@/components/auth/forms";

export const metadata: Metadata = { title: "Reset your password" };

export default function ForgotPasswordPage() {
  return (
    <>
      <h1 className="text-3xl font-heavy tracking-tighter text-ink">Reset your password</h1>
      <p className="mt-2 text-[15px] text-muted">Enter your email and we&apos;ll send you a link to choose a new one.</p>
      <div className="mt-8">
        <ForgotForm />
      </div>
      <p className="mt-6 text-center text-sm text-muted">
        Remembered it?{" "}
        <Link href="/login" className="text-ink underline underline-offset-4">
          Log in
        </Link>
      </p>
    </>
  );
}
