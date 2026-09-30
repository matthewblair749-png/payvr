"use client";

/**
 * A playable version of lumen's post-purchase "one-tap" question. Visitors tap
 * an answer and see the (sample) crowd results animate in — a preview of the
 * research engine without a screenshot.
 */
import { AnimatePresence, m } from "framer-motion";
import { useState } from "react";

const ANSWERS = [
  { id: "shipping", label: "Shipping cost", share: 38 },
  { id: "price", label: "The price", share: 24 },
  { id: "trust", label: "Wasn't sure it's legit", share: 17 },
  { id: "nothing", label: "Nothing. Take my money", share: 21 },
];

export function OneTapDemo() {
  const [picked, setPicked] = useState<string | null>(null);

  return (
    <div className="rounded-[28px] bg-white p-6 text-ink shadow-lift sm:p-8">
      <p className="text-sm font-semibold uppercase tracking-wider text-muted">After checkout, one tap</p>
      <h3 id="one-tap-q" className="mt-2 font-display text-2xl font-bold tracking-[-0.03em] sm:text-3xl">
        What nearly stopped you?
      </h3>

      <div role="group" aria-labelledby="one-tap-q" className="mt-5 grid gap-2.5">
        {ANSWERS.map((a) => {
          const chosen = picked === a.id;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => setPicked(a.id)}
              aria-pressed={chosen}
              className="relative overflow-hidden rounded-2xl border-2 border-black/8 px-4 py-3.5 text-left font-semibold transition-colors hover:border-ink aria-pressed:border-ink"
            >
              <AnimatePresence>
                {picked && (
                  <m.span
                    aria-hidden="true"
                    className={`absolute inset-y-0 left-0 ${chosen ? "bg-spark" : "bg-surface"}`}
                    initial={{ width: 0 }}
                    animate={{ width: `${a.share}%` }}
                    transition={{ type: "spring", stiffness: 120, damping: 20 }}
                  />
                )}
              </AnimatePresence>
              <span className="relative flex items-center justify-between gap-3">
                <span>{a.label}</span>
                {picked && (
                  <span className="tabular-nums text-muted-strong">
                    {a.share}%<span className="sr-only"> of buyers</span>
                  </span>
                )}
              </span>
            </button>
          );
        })}
      </div>

      <div aria-live="polite" className="min-h-[3.5rem]">
        {picked && (
          <m.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-5 rounded-2xl bg-ink px-4 py-3 text-sm leading-relaxed text-white"
          >
            <span className="font-semibold text-spark">lumen noticed:</span> 38% of buyers hesitated on shipping. Try
            free shipping over $60 — want me to start that test?
          </m.p>
        )}
      </div>
    </div>
  );
}
