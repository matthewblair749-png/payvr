"use client";

/**
 * Small, accessible form primitives for the editor (landing demo + Studio).
 * Styled in lumen's UI language: DM Sans, ink on white, soft shadows.
 */
import { useId, type ReactNode } from "react";
import { Check } from "lucide-react";
import { contrast } from "@/lib/color";
import { cn } from "@/lib/utils";

export function ControlGroup({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return (
    <div className="space-y-2">
      {htmlFor ? (
        <label htmlFor={htmlFor} className="block text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
      ) : (
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</p>
      )}
      {children}
    </div>
  );
}

/** Radio-group of color swatches plus a native picker for anything else. */
export function SwatchPicker({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; name: string }[];
  onChange: (hex: string) => void;
}) {
  const name = useId();
  const customId = useId();
  const isCustom = !options.some((o) => o.value.toLowerCase() === value.toLowerCase());
  return (
    <fieldset>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</legend>
      <div className="flex flex-wrap items-center gap-2">
        {options.map((o) => {
          const checked = o.value.toLowerCase() === value.toLowerCase();
          const tick = contrast("#FFFFFF", o.value) > contrast("#0E0E10", o.value) ? "#FFFFFF" : "#0E0E10";
          return (
            <label key={o.value} className="relative cursor-pointer" title={o.name}>
              <input
                type="radio"
                name={name}
                className="peer sr-only"
                checked={checked}
                onChange={() => onChange(o.value)}
              />
              <span className="sr-only">{o.name}</span>
              <span
                aria-hidden="true"
                className="grid h-9 w-9 place-items-center rounded-full border border-black/10 shadow-sm transition-transform duration-200 ease-[var(--ease-spring)] hover:scale-110 peer-checked:scale-110 peer-checked:ring-2 peer-checked:ring-ink peer-checked:ring-offset-2 peer-focus-visible:outline-3 peer-focus-visible:outline-offset-4 peer-focus-visible:outline-ink"
                style={{ background: o.value }}
              >
                {checked && <Check size={16} color={tick} strokeWidth={3} />}
              </span>
            </label>
          );
        })}
        <label
          htmlFor={customId}
          className={cn(
            "relative grid h-9 w-9 cursor-pointer place-items-center overflow-hidden rounded-full border border-dashed border-ink/40 text-xs font-bold has-focus-visible:outline-3 has-focus-visible:outline-offset-4 has-focus-visible:outline-ink",
            isCustom && "ring-2 ring-ink ring-offset-2",
          )}
          style={isCustom ? { background: value } : undefined}
          title="Custom color"
        >
          <span className="sr-only">Custom {label.toLowerCase()}</span>
          {!isCustom && <span aria-hidden="true">+</span>}
          <input
            id={customId}
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value.toUpperCase())}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>
      </div>
    </fieldset>
  );
}

/** Pill-style segmented control built on native radios (keyboard: arrow keys). */
export function Segmented<T extends string>({
  label,
  value,
  options,
  onChange,
  className,
}: {
  label: string;
  value: T;
  options: { value: T; label: ReactNode; style?: React.CSSProperties; srLabel?: string }[];
  onChange: (v: T) => void;
  className?: string;
}) {
  const name = useId();
  return (
    <fieldset className={className}>
      <legend className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted">{label}</legend>
      <div className="flex flex-wrap gap-1 rounded-2xl bg-surface p-1">
        {options.map((o) => (
          <label key={o.value} className="min-w-0 flex-1 cursor-pointer">
            <input
              type="radio"
              name={name}
              value={o.value}
              checked={value === o.value}
              onChange={() => onChange(o.value)}
              className="peer sr-only"
            />
            <span
              className="block rounded-xl px-3 py-2 text-center text-sm font-medium text-muted-strong transition-all duration-200 peer-checked:bg-white peer-checked:text-ink peer-checked:shadow-soft peer-focus-visible:outline-3 peer-focus-visible:outline-ink hover:text-ink"
              style={o.style}
            >
              {o.srLabel && <span className="sr-only">{o.srLabel}</span>}
              <span aria-hidden={o.srLabel ? true : undefined}>{o.label}</span>
            </span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function RangeControl({
  label,
  value,
  min,
  max,
  step = 1,
  unit = "",
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  unit?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const pct = ((value - min) / (max - min)) * 100;
  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label htmlFor={id} className="text-xs font-semibold uppercase tracking-wider text-muted">
          {label}
        </label>
        <span className="text-sm font-semibold tabular-nums">
          {value}
          {unit}
        </span>
      </div>
      <input
        id={id}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        className="lumen-range w-full"
        style={{ background: `linear-gradient(to right, var(--lumen-ink) ${pct}%, var(--lumen-surface) ${pct}%)` }}
      />
    </div>
  );
}
