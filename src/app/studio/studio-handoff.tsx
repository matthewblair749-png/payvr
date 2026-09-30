"use client";

import Link from "next/link";
import { useSyncExternalStore } from "react";
import { Logo } from "@/components/brand/logo";
import { CheckoutView } from "@/components/checkout/checkout-view";
import { DEMO_CONFIG, DEMO_PRODUCT } from "@/lib/checkout/defaults";
import { loadDraft } from "@/lib/checkout/draft-read";

const subscribe = () => () => {};

export function StudioHandoff() {
  // Read the draft only on the client (localStorage), with a stable server snapshot.
  const draftJson = useSyncExternalStore(
    subscribe,
    () => JSON.stringify(loadDraft()),
    () => "null",
  );
  const draft = JSON.parse(draftJson) as ReturnType<typeof loadDraft>;
  const config = draft ?? DEMO_CONFIG;

  return (
    <div className="min-h-dvh bg-surface">
      <header className="flex items-center justify-between px-5 py-4 sm:px-8">
        <Link href="/" aria-label="lumen home">
          <Logo size={32} />
        </Link>
      </header>
      <main id="main" className="mx-auto grid max-w-6xl gap-10 px-5 pb-16 sm:px-8 lg:grid-cols-[1fr_420px] lg:items-center">
        <div>
          <h1 className="font-display text-5xl font-bold tracking-[-0.05em]">
            {draft ? "It's yours." : "Welcome to the studio."}
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted-strong">
            {draft
              ? "Your design is saved in this browser. The full studio (versions, publishing, brand import) arrives next."
              : "The full studio (versions, publishing, brand import) arrives next."}
          </p>
        </div>
        <div className="h-[680px] overflow-y-auto rounded-[32px] shadow-lift">
          <CheckoutView config={config} product={DEMO_PRODUCT} mode="preview" />
        </div>
      </main>
    </div>
  );
}
