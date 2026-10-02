"use client";

import { FlaskRound } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setShowSampleAction } from "@/app/studio/home-actions";

/** Says plainly that Home is showing sample data, with the way out. */
export function SampleBanner({ kind, sampleName }: { kind: "sample" | "demo"; sampleName: string | null }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <div role="note" className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 rounded-card border border-dashed border-app-muted/60 bg-app-sunken px-4 py-3 text-ui">
      <FlaskRound size={18} aria-hidden="true" className="shrink-0 text-app-muted" />
      <p className="min-w-0 flex-1">
        <strong className="font-semibold">Sample data.</strong>{" "}
        {kind === "demo"
          ? "This is lumen's demo shop: every sale, shopper and test here is made up."
          : `Until your first sale, Home shows ${sampleName ?? "a demo shop"}'s made-up numbers so you can see how it works. Nothing here is yours.`}
      </p>
      {kind === "sample" && (
        <button
          type="button"
          disabled={pending}
          onClick={() =>
            start(async () => {
              await setShowSampleAction({ show: false });
              router.refresh();
            })
          }
          className="h-9 shrink-0 rounded-control border border-app-hairline bg-app-card px-3 font-semibold hover:bg-app-page disabled:opacity-60"
        >
          {pending ? "Turning off…" : "Turn off sample data"}
        </button>
      )}
    </div>
  );
}

export function ShowSampleButton() {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() =>
        start(async () => {
          await setShowSampleAction({ show: true });
          router.refresh();
        })
      }
      className="font-semibold text-app-fg underline underline-offset-4 disabled:opacity-60"
    >
      {pending ? "Loading sample data…" : "See Home with sample data"}
    </button>
  );
}

/** Settings switch for sample data on Home. */
export function SampleToggle({ show, hasSales }: { show: boolean; hasSales: boolean }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [on, setOn] = useState(show);
  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        role="switch"
        checked={on}
        disabled={pending || hasSales}
        onChange={(e) => {
          const next = e.target.checked;
          setOn(next);
          start(async () => {
            await setShowSampleAction({ show: next });
            router.refresh();
          });
        }}
        className="mt-1 size-4 accent-app-fg"
      />
      <span>
        <span className="block text-ui font-semibold">Show sample data on Home before my first sale</span>
        <span className="block text-ui text-app-muted">
          {hasSales ? "You have real sales, so Home always shows your own numbers." : "A demo shop's made-up numbers, clearly labelled. Turns off by itself at your first sale."}
        </span>
      </span>
    </label>
  );
}
