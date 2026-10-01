"use client";

/**
 * "Paste a link" brand import. Shows honest progress while the server fetches
 * the site and Claude designs the theme, then applies it (undoable).
 */
import { useEffect, useState, useTransition } from "react";
import { AnimatePresence, m } from "framer-motion";
import { Link2, Sparkles, Undo2 } from "lucide-react";
import { importBrandAction } from "@/app/studio/actions";
import { Button } from "@/components/ui/button";
import type { BrandImportResult } from "@/server/brand-import";

import { FONTS } from "@/lib/checkout/meta";

const STEPS = ["Visiting the site", "Reading colors and type", "Finding the logo", "Designing your checkout"];

export function ImportPanel({ onApply, onUndo }: { onApply: (r: BrandImportResult) => void; onUndo: () => void }) {
  const [url, setUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BrandImportResult | null>(null);
  const [pending, start] = useTransition();
  const [step, setStep] = useState(0);

  // Advance the progress copy on a rough schedule that matches the real pipeline.
  useEffect(() => {
    if (!pending) return;
    const timers = [1200, 2800, 4500].map((ms, i) => setTimeout(() => setStep(i + 1), ms));
    return () => timers.forEach(clearTimeout);
  }, [pending]);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);
    setStep(0);
    start(async () => {
      const res = await importBrandAction({ url });
      if (!res.ok) return setError(res.error);
      setResult(res.data);
      onApply(res.data);
    });
  }

  return (
    <div className="space-y-5">
      <div>
        <h2 className="font-display text-xl font-bold tracking-[-0.03em]">Paste a link</h2>
        <p className="mt-1 text-sm text-muted-strong">
          Your website or Instagram. We&apos;ll match your colors, type and logo in about 10 seconds.
        </p>
      </div>
      <form onSubmit={submit} className="space-y-3">
        <label htmlFor="import-url" className="sr-only">
          Website or Instagram URL
        </label>
        <div className="flex items-center gap-2 rounded-2xl border border-black/12 bg-white px-3 focus-within:border-ink">
          <Link2 size={18} aria-hidden="true" className="shrink-0 text-muted" />
          <input
            id="import-url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="yourbrand.com or instagram.com/you"
            inputMode="url"
            autoComplete="url"
            required
            className="min-w-0 flex-1 bg-transparent py-3 focus:outline-none"
          />
        </div>
        <Button type="submit" variant="primary" className="w-full" disabled={pending || !url.trim()}>
          <Sparkles size={16} aria-hidden="true" />
          {pending ? "Importing…" : "Match my brand"}
        </Button>
      </form>

      <div aria-live="polite">
        {pending && (
          <ol className="space-y-2">
            {STEPS.map((s, i) => (
              <li key={s} className="flex items-center gap-2.5 text-sm">
                <span
                  aria-hidden="true"
                  className={`h-2.5 w-2.5 rounded-full ${i < step ? "bg-ink" : i === step ? "animate-pulse bg-orange" : "bg-black/15"}`}
                />
                <span className={i <= step ? "font-medium" : "text-muted"}>{s}</span>
              </li>
            ))}
          </ol>
        )}
        {error && (
          <p role="alert" className="rounded-2xl bg-surface px-4 py-3 text-sm font-medium text-orange-deep">
            {error}
          </p>
        )}
        <AnimatePresence>
          {result && !pending && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-3 rounded-2xl bg-surface/70 p-4"
            >
              <div className="flex items-center gap-3">
                {result.logoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element -- arbitrary merchant host
                  <img src={result.logoUrl} alt="" className="h-10 w-10 rounded-xl bg-white object-contain" />
                ) : (
                  <span className="grid h-10 w-10 place-items-center rounded-xl font-bold text-white" style={{ background: result.theme.accent }}>
                    {result.brandName.charAt(0)}
                  </span>
                )}
                <div className="min-w-0">
                  <p className="truncate font-semibold">{result.brandName}</p>
                  <p className="text-xs text-muted-strong">
                    {FONTS[result.theme.font].label} · {result.theme.radius}px corners · {(result.elapsedMs / 1000).toFixed(1)}s
                    {result.source === "heuristic" && " · quick match"}
                  </p>
                </div>
              </div>
              <div className="flex gap-2" aria-label="Imported colors">
                {[result.theme.accent, result.theme.background].map((c) => (
                  <span key={c} className="flex items-center gap-1.5 rounded-full bg-white px-2 py-1 font-mono text-xs">
                    <span aria-hidden="true" className="h-4 w-4 rounded-full border border-black/10" style={{ background: c }} />
                    {c}
                  </span>
                ))}
              </div>
              <p className="text-sm">{result.rationale}</p>
              <Button variant="soft" size="sm" onClick={onUndo}>
                <Undo2 size={14} aria-hidden="true" /> Undo import
              </Button>
            </m.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
