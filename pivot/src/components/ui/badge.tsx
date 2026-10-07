import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type Tone = "neutral" | "ink" | "positive" | "negative" | "caution";

const tones: Record<Tone, string> = {
  neutral: "bg-sunken text-ink-2",
  ink: "bg-ink text-white",
  positive: "bg-positive-soft text-positive-text",
  negative: "bg-negative-soft text-negative-text",
  caution: "bg-caution-soft text-caution-text",
};

const dots: Record<Tone, string> = {
  neutral: "bg-faint",
  ink: "bg-white",
  positive: "bg-positive",
  negative: "bg-negative",
  caution: "bg-caution",
};

export function Badge({ tone = "neutral", dot = false, children, className }: { tone?: Tone; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs leading-none", tones[tone], className)}>
      {dot && <span className={cn("size-1.5 rounded-full", dots[tone])} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Uppercase status label with a colored dot: "ACTION NEEDED". Never color alone. */
export function StatusLabel({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-2 text-[11px] font-heavy uppercase tracking-[0.08em]", tone === "negative" ? "text-negative-text" : tone === "positive" ? "text-positive-text" : tone === "caution" ? "text-caution-text" : "text-muted")}>
      <span className={cn("size-2 rounded-full", dots[tone])} aria-hidden="true" />
      {children}
    </span>
  );
}
