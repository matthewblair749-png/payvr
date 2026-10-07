"use client";

import Link from "next/link";
import { useEffect } from "react";
import { LogoMark } from "@/components/brand/logo";
import { Button } from "@/components/ui/button";

/** Never show raw errors: a friendly message, a retry, and a way home. */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <LogoMark size={44} className="mx-auto" />
        <h1 className="mt-6 text-3xl font-heavy tracking-tighter text-ink">Something went wrong</h1>
        <p className="mt-3 text-[15px] text-muted">We couldn&apos;t load this page. Please try again. If it keeps happening, we&apos;re already looking into it{error.digest ? ` (reference ${error.digest})` : ""}.</p>
        <div className="mt-8 flex justify-center gap-3">
          <Button variant="primary" onClick={reset}>
            Try again
          </Button>
          <Link href="/" className="inline-flex h-11 items-center rounded-full px-5 text-[15px] text-ink-2 hover:bg-sunken">
            Go home
          </Link>
        </div>
      </div>
    </main>
  );
}
