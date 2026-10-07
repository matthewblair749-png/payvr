"use client";

import { Check, RotateCcw, X } from "lucide-react";
import { useTransition } from "react";
import { setItemStatus } from "@/server/data/item-actions";

type Kind = "insight" | "opportunity" | "recommendation";

/** Mark an item done / dismissed (or reopen it). Hidden in the demo. */
export function StatusActions({ kind, itemKey, status, demo }: { kind: Kind; itemKey: string; status: "OPEN" | "DONE" | "DISMISSED"; demo: boolean }) {
  const [pending, start] = useTransition();
  if (demo) return null;
  const set = (s: "OPEN" | "DONE" | "DISMISSED") => start(() => void setItemStatus(kind, itemKey, s));
  const btn = "inline-flex h-9 items-center gap-1.5 rounded-full px-3 text-[13px] text-ink-2 hover:bg-sunken hover:text-ink disabled:opacity-50";
  if (status !== "OPEN") {
    return (
      <button type="button" disabled={pending} onClick={() => set("OPEN")} className={btn}>
        <RotateCcw size={14} aria-hidden="true" /> Reopen
      </button>
    );
  }
  return (
    <span className="inline-flex gap-1">
      <button type="button" disabled={pending} onClick={() => set("DONE")} className={btn}>
        <Check size={14} aria-hidden="true" /> {kind === "insight" ? "Resolved" : "Done"}
      </button>
      <button type="button" disabled={pending} onClick={() => set("DISMISSED")} className={btn}>
        <X size={14} aria-hidden="true" /> Dismiss
      </button>
    </span>
  );
}
