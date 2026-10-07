"use client";

import { FileUp, Loader2 } from "lucide-react";
import { useActionState, useRef, useState } from "react";
import { FormMessage } from "@/components/ui/field";
import { cn } from "@/lib/utils";
import { uploadDataset, type UploadState } from "@/server/data/upload-actions";

const MAX = 10 * 1024 * 1024;

/** "Drop your business data here." Checks the file in the browser first for instant feedback; the server checks again. */
export function Dropzone({ disabled, disabledReason }: { disabled?: boolean; disabledReason?: string }) {
  const [state, action, pending] = useActionState<UploadState, FormData>(uploadDataset, undefined);
  const [drag, setDrag] = useState(false);
  const [local, setLocal] = useState<string | null>(null);
  const form = useRef<HTMLFormElement>(null);
  const input = useRef<HTMLInputElement>(null);

  function accept(files: FileList | null) {
    setLocal(null);
    const f = files?.[0];
    if (!f) return;
    if (!/\.csv$/i.test(f.name)) return setLocal("PIVOT reads CSV files. In Excel or Google Sheets, use Save as / Download → CSV.");
    if (f.size > MAX) return setLocal("That file is over 10 MB. Upload a monthly summary or split the file.");
    if (input.current && files !== input.current.files) {
      const dt = new DataTransfer();
      dt.items.add(f);
      input.current.files = dt.files;
    }
    form.current?.requestSubmit();
  }

  const error = local ?? state?.error;
  return (
    <form ref={form} action={action}>
      <label
        htmlFor="csv-file"
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled) setDrag(true);
        }}
        onDragLeave={() => setDrag(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDrag(false);
          if (!disabled && !pending) accept(e.dataTransfer.files);
        }}
        className={cn(
          "flex flex-col items-center rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors sm:py-16",
          disabled ? "cursor-not-allowed border-line bg-canvas" : drag ? "border-ink bg-sunken" : "border-line-strong bg-surface hover:border-ink/40 hover:bg-canvas",
        )}
      >
        <span className="grid size-14 place-items-center rounded-2xl bg-sunken text-ink">
          {pending ? <Loader2 size={24} className="animate-spin" aria-hidden="true" /> : <FileUp size={24} aria-hidden="true" />}
        </span>
        <span className="mt-4 text-xl font-heavy tracking-tight text-ink">{pending ? "Reading your file…" : "Drop your business data here"}</span>
        <span className="mt-1.5 text-sm text-muted">Supported: CSV, up to 10 MB · or click to choose a file</span>
        {disabled && disabledReason && <span className="mt-3 max-w-sm text-sm text-ink-2">{disabledReason}</span>}
        <input
          ref={input}
          id="csv-file"
          name="file"
          type="file"
          accept=".csv,text/csv"
          className="sr-only"
          disabled={disabled || pending}
          onChange={(e) => accept(e.target.files)}
        />
      </label>
      {error && (
        <div className="mt-3">
          <FormMessage tone="error">
            <span className="font-heavy">Something went wrong. </span>
            {error}
          </FormMessage>
        </div>
      )}
    </form>
  );
}
