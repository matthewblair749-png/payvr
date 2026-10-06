"use client";

import * as SliderPrimitive from "@radix-ui/react-slider";
import { cn } from "@/lib/utils";

/**
 * Accessible slider (keyboard, screen reader, touch). The thumb has a 44px
 * touch target on phones. `centered` fills from zero for -/+ ranges.
 */
export function Slider({
  value,
  onValueChange,
  onValueCommit,
  min,
  max,
  step = 1,
  label,
  valueText,
  centered = false,
  className,
}: {
  value: number;
  onValueChange: (v: number) => void;
  onValueCommit?: (v: number) => void;
  min: number;
  max: number;
  step?: number;
  label: string;
  valueText?: string;
  centered?: boolean;
  className?: string;
}) {
  const zero = ((0 - min) / (max - min)) * 100;
  const pos = ((value - min) / (max - min)) * 100;
  return (
    <SliderPrimitive.Root
      className={cn("relative flex h-11 w-full touch-none select-none items-center", className)}
      value={[value]}
      min={min}
      max={max}
      step={step}
      onValueChange={(v) => onValueChange(v[0])}
      onValueCommit={onValueCommit ? (v) => onValueCommit(v[0]) : undefined}
    >
      <SliderPrimitive.Track className="relative h-1.5 w-full grow overflow-hidden rounded-full bg-sunken">
        {centered ? (
          <span
            className="absolute inset-y-0 rounded-full bg-ink"
            style={{ left: `${Math.min(zero, pos)}%`, right: `${100 - Math.max(zero, pos)}%` }}
          />
        ) : (
          <SliderPrimitive.Range className="absolute h-full rounded-full bg-ink" />
        )}
      </SliderPrimitive.Track>
      {centered && <span className="pointer-events-none absolute top-1/2 h-3 w-0.5 -translate-y-1/2 rounded bg-line-strong" style={{ left: `${zero}%` }} aria-hidden="true" />}
      <SliderPrimitive.Thumb
        aria-label={label}
        aria-valuetext={valueText}
        className="relative block size-6 rounded-full border-2 border-ink bg-white shadow-[0_2px_8px_rgb(10_16_32/0.2)] transition-transform hover:scale-110 focus-visible:scale-110 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ink/15 before:absolute before:-inset-2.5 before:content-['']"
      />
    </SliderPrimitive.Root>
  );
}
