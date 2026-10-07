"use client";

import { Loader2, Trash2 } from "lucide-react";
import { useState, useTransition } from "react";
import { deleteDataset } from "@/server/data/upload-actions";

export function DeleteDataset({ id, name }: { id: string; name: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-xs text-negative-text">{error}</span>}
      <button
        type="button"
        disabled={pending}
        onClick={() => {
          if (!confirm(`Delete "${name}"? Its numbers will be removed from your analysis.`)) return;
          start(async () => {
            const res = await deleteDataset(id);
            if (res?.error) setError(res.error);
          });
        }}
        aria-label={`Delete ${name}`}
        className="grid size-9 place-items-center rounded-full text-muted hover:bg-sunken hover:text-negative-text disabled:opacity-50"
      >
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Trash2 size={16} aria-hidden="true" />}
      </button>
    </span>
  );
}
