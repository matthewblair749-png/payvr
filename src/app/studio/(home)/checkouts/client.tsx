"use client";

import { useState, useSyncExternalStore, useTransition } from "react";
import { ArrowRight, Plus, X } from "lucide-react";
import { createPageAction } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { clearDraft } from "@/lib/checkout/draft";
import { loadDraft } from "@/lib/checkout/draft-read";

export function NewCheckoutButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        variant="primary"
        size="lg"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await createPageAction({ name: "New checkout" });
            if (res && !res.ok) setError(res.error);
          })
        }
      >
        <Plus size={18} aria-hidden="true" /> {pending ? "Creating…" : "New checkout"}
      </Button>
      {error && <p role="alert" className="text-sm text-orange-deep">{error}</p>}
    </div>
  );
}

const noop = () => () => {};

/** Offers to import the design a visitor made on the landing page. */
export function DraftImportBanner() {
  const draftJson = useSyncExternalStore(noop, () => JSON.stringify(loadDraft()), () => "null");
  const [dismissed, setDismissed] = useState(false);
  const [pending, start] = useTransition();
  const draft = JSON.parse(draftJson) as ReturnType<typeof loadDraft>;
  if (!draft || dismissed) return null;

  return (
    <div className="mt-8 flex flex-wrap items-center gap-4 rounded-[24px] bg-ink p-5 text-white sm:p-6">
      <span aria-hidden="true" className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-bold" style={{ background: draft.theme.accent, color: "#fff" }}>
        {draft.brand.name.charAt(0)}
      </span>
      <div className="min-w-0 flex-1">
        <p className="font-semibold">Pick up where you left off</p>
        <p className="text-sm text-white/75">Bring in the {draft.brand.name} checkout you designed on the homepage.</p>
      </div>
      <Button
        variant="primary"
        disabled={pending}
        onClick={() =>
          start(async () => {
            clearDraft();
            await createPageAction({ name: `${draft.brand.name} checkout`, config: draft });
          })
        }
      >
        {pending ? "Bringing it in…" : "Bring it in"} <ArrowRight size={16} aria-hidden="true" />
      </Button>
      <button
        type="button"
        onClick={() => {
          clearDraft();
          setDismissed(true);
        }}
        aria-label="Dismiss"
        className="grid h-10 w-10 place-items-center rounded-full hover:bg-white/10"
      >
        <X size={18} aria-hidden="true" />
      </button>
    </div>
  );
}
