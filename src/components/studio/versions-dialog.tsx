"use client";

import { useState, useTransition } from "react";
import { History, RotateCcw } from "lucide-react";
import { restoreVersionAction, saveVersionAction } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import type { CheckoutConfig } from "@/lib/checkout/schema";

export type VersionRow = { id: string; number: number; note: string; createdAt: string };

const fmt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

export function VersionsDialog({
  open,
  onClose,
  pageId,
  versions,
  publishedVersionId,
  onSaved,
  onRestored,
}: {
  open: boolean;
  onClose: () => void;
  pageId: string;
  versions: VersionRow[];
  publishedVersionId: string | null;
  onSaved: (v: VersionRow) => void;
  onRestored: (config: CheckoutConfig) => void;
}) {
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  return (
    <Dialog open={open} onClose={onClose} side title="Versions" description="Snapshots of your original (A) design.">
      <form
        className="mb-6 flex gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          start(async () => {
            const res = await saveVersionAction({ pageId, note });
            if (!res.ok) return setError(res.error);
            setError(null);
            setNote("");
            onSaved(res.data);
          });
        }}
      >
        <label htmlFor="version-note" className="sr-only">
          Version note
        </label>
        <input
          id="version-note"
          value={note}
          maxLength={120}
          onChange={(e) => setNote(e.target.value)}
          placeholder="What changed? (optional)"
          className="min-w-0 flex-1 rounded-full border border-black/12 px-4 focus:border-ink focus:outline-none"
        />
        <Button type="submit" disabled={pending}>
          Save
        </Button>
      </form>
      {error && (
        <p role="alert" className="mb-4 text-sm text-orange-deep">
          {error}
        </p>
      )}

      {versions.length === 0 ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-muted-strong">
          <History size={28} aria-hidden="true" />
          <p>No versions yet. Save one, or publish to create one automatically.</p>
        </div>
      ) : (
        <ol className="space-y-2">
          {versions.map((v) => (
            <li key={v.id} className="flex items-center gap-3 rounded-2xl border border-black/8 px-4 py-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-surface text-sm font-bold">
                v{v.number}
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {v.note || "Untitled"}
                  {v.id === publishedVersionId && (
                    <span className="ml-2 rounded-full bg-spark px-2 py-0.5 text-[11px] font-bold text-ink">Live</span>
                  )}
                </p>
                <p className="text-xs text-muted-strong">{fmt.format(new Date(v.createdAt))}</p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                disabled={pending}
                aria-label={`Restore version ${v.number} into the editor`}
                onClick={() =>
                  start(async () => {
                    const res = await restoreVersionAction({ pageId, versionId: v.id });
                    if (!res.ok) return setError(res.error);
                    onRestored(res.data);
                    onClose();
                  })
                }
              >
                <RotateCcw size={14} aria-hidden="true" /> Restore
              </Button>
            </li>
          ))}
        </ol>
      )}
    </Dialog>
  );
}
