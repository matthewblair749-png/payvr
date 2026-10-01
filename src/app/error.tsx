"use client";

import { LogoMark } from "@/components/brand/logo";

/** Branded error boundary. Never shows stack traces or internal messages. */
export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <LogoMark size={64} title="" />
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Something went wrong</h1>
      <p className="max-w-sm text-muted-strong">It&apos;s not you. Please try again; if it keeps happening, we&apos;re on it.</p>
      <button type="button" onClick={reset} className="rounded-full bg-ink px-6 py-3 font-semibold text-white">
        Try again
      </button>
    </main>
  );
}
