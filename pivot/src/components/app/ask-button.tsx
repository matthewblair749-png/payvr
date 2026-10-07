"use client";

import { Sparkles } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useState } from "react";

// The chat panel is only downloaded when someone opens it.
const AskPanel = dynamic(() => import("./ask-panel").then((m) => m.AskPanel), { ssr: false });

/** Opens Ask PIVOT. Other components can open it with a question via the "pivot:ask" event. */
export function AskButton({ mode, companyName }: { mode: "app" | "demo"; companyName: string }) {
  const [open, setOpen] = useState(false);
  const [seed, setSeed] = useState<string | null>(null);
  useEffect(() => {
    const onAsk = (e: Event) => {
      setSeed((e as CustomEvent<string>).detail ?? null);
      setOpen(true);
    };
    window.addEventListener("pivot:ask", onAsk);
    return () => window.removeEventListener("pivot:ask", onAsk);
  }, []);
  return (
    <>
      <button
        type="button"
        onClick={() => {
          setSeed(null);
          setOpen(true);
        }}
        className="inline-flex h-10 items-center gap-2 rounded-full border border-line-strong bg-surface px-4 text-sm font-heavy text-ink hover:border-ink/35 hover:bg-sunken"
      >
        <Sparkles size={16} aria-hidden="true" />
        Ask PIVOT
      </button>
      {open && <AskPanel mode={mode} companyName={companyName} seed={seed} onClose={() => setOpen(false)} />}
    </>
  );
}

/** Open Ask PIVOT pre-filled with a question. */
export function askPivot(question: string) {
  window.dispatchEvent(new CustomEvent("pivot:ask", { detail: question }));
}
