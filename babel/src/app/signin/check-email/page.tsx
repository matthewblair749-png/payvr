import type { Metadata } from "next";
import Link from "next/link";
import { lastDevMagicLink } from "@/features/auth/email";
import { Mascot } from "@/features/brand/mascot";
import { SiteHeader } from "@/features/landing/site-header";

export const metadata: Metadata = { title: "Check your inbox" };
export const dynamic = "force-dynamic";

export default function CheckEmailPage() {
  // Local development without an email server only. Always null in production.
  const devLink = lastDevMagicLink();
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap flex flex-col items-center py-12 text-center sm:py-16">
        <div className="w-[110px]">
          <Mascot mood="happy" label="The Babel mascot, cheering" />
        </div>
        <h1 className="mt-6 text-4xl sm:text-5xl">Check your inbox.</h1>
        <p className="mt-4 max-w-md text-lg text-muted">
          We sent you a sign-in link. It works once and expires in 24 hours. Nothing there? Check spam, or{" "}
          <Link href="/signin" className="font-bold text-ink underline decoration-coral decoration-2 underline-offset-4">
            ask for another
          </Link>
          .
        </p>
        {devLink && (
          <div className="mt-8 max-w-lg rounded-[var(--radius)] border-2 border-dashed border-line-strong bg-paper p-4 text-left text-sm">
            <p className="font-bold">Development only: no email server is set up, so here&rsquo;s the link for {devLink.email}.</p>
            <a href={devLink.url} className="mt-2 block break-all font-semibold text-coral-text underline">
              {devLink.url}
            </a>
          </div>
        )}
      </main>
    </>
  );
}
