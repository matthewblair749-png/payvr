import type { CSSProperties } from "react";
import { cn } from "@/lib/utils";

/** An integer that counts up from 0 on first paint (CSS only; see globals.css). */
export function CountUp({ value, className }: { value: number; className?: string }) {
  const n = Math.round(value);
  return (
    <span className={className}>
      <span className={cn("pv-count")} style={{ "--pv-n": n } as CSSProperties} aria-hidden="true" />
      <span className="sr-only">{n}</span>
    </span>
  );
}
