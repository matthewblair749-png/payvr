import type { Explanation } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

/** The four answers every major number gets. */
export function FourAnswers({ e, compact = false, className }: { e: Explanation; compact?: boolean; className?: string }) {
  const parts = [
    { q: "What?", a: e.what },
    { q: "Why?", a: e.why },
    { q: "So what?", a: e.soWhat },
    { q: "Now what?", a: e.nowWhat },
  ];
  return (
    <dl className={cn(compact ? "space-y-3" : "grid gap-5 sm:grid-cols-2", className)}>
      {parts.map((p) => (
        <div key={p.q} className={compact ? "" : "border-t-2 border-ink pt-3"}>
          <dt className="text-[13px] font-heavy uppercase tracking-[0.06em] text-ink">{p.q}</dt>
          <dd className="mt-1 text-[15px] leading-relaxed text-ink-2">{p.a}</dd>
        </div>
      ))}
    </dl>
  );
}
