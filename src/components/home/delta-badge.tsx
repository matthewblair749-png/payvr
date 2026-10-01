import { ArrowDownRight, ArrowUpRight, Minus, Sparkle } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Delta } from "./format";

const ICON = { up: ArrowUpRight, down: ArrowDownRight, flat: Minus, new: Sparkle } as const;
const TONE = {
  good: "text-app-success-text",
  bad: "text-app-failure-text",
  neutral: "text-app-muted",
} as const;

/**
 * Direction is carried three ways: the arrow icon, the words, and the color
 * (good/bad by metric). Never by color alone.
 */
export function DeltaBadge({ delta, against, className }: { delta: Delta; against: string; className?: string }) {
  const Icon = ICON[delta.direction];
  return (
    <p className={cn("flex flex-wrap items-center gap-x-1.5 text-ui", className)}>
      <span className={cn("inline-flex items-center gap-0.5 font-semibold", TONE[delta.tone])}>
        <Icon size={16} aria-hidden="true" strokeWidth={2.25} />
        <span className="sr-only">{delta.spoken}</span>
        <span aria-hidden="true">{delta.text}</span>
      </span>
      <span className="text-app-muted">{against}</span>
    </p>
  );
}
