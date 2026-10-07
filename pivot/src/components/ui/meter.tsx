import { cn } from "@/lib/utils";

/** A horizontal 0-100 bar. Animates in once. */
export function Meter({ value, tone = "ink", className, label }: { value: number; tone?: "ink" | "gray" | "positive" | "negative" | "caution"; className?: string; label?: string }) {
  const fill =
    tone === "ink" ? "bg-ink" : tone === "gray" ? "bg-chart-2" : tone === "positive" ? "bg-positive" : tone === "negative" ? "bg-negative" : "bg-caution";
  return (
    <div className={cn("h-2 w-full overflow-hidden rounded-full bg-sunken", className)} role={label ? "meter" : undefined} aria-label={label} aria-valuenow={label ? Math.round(value) : undefined} aria-valuemin={label ? 0 : undefined} aria-valuemax={label ? 100 : undefined}>
      <div className={cn("anim-grow-x h-full rounded-full", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}
