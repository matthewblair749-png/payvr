import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * A change, with direction shown by icon AND color (never color alone).
 * `good` says whether this direction is good for the business: retention
 * going down is bad, costs going down is good.
 */
export function Delta({
  label,
  direction,
  good,
  size = "sm",
  className,
}: {
  label: string;
  direction: "up" | "down" | "flat";
  good: boolean | null;
  size?: "sm" | "md";
  className?: string;
}) {
  const Icon = direction === "up" ? ArrowUpRight : direction === "down" ? ArrowDownRight : ArrowRight;
  const tone = good === null || direction === "flat" ? "text-muted bg-sunken" : good ? "text-positive-text bg-positive-soft" : "text-negative-text bg-negative-soft";
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 rounded-full font-heavy leading-none",
        size === "sm" ? "px-1.5 py-1 text-xs" : "px-2 py-1.5 text-[13px]",
        tone,
        className,
      )}
    >
      <Icon size={size === "sm" ? 13 : 15} strokeWidth={2.5} aria-hidden="true" />
      {label}
    </span>
  );
}

export function directionOf(n: number, epsilon = 1e-9): "up" | "down" | "flat" {
  return n > epsilon ? "up" : n < -epsilon ? "down" : "flat";
}
