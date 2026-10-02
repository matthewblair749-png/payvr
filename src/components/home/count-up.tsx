"use client";

import { useLayoutEffect, useRef } from "react";

/**
 * Counts a number up (about 600ms, ease-out) on first show, and from the old
 * value to the new one when it changes. Writes straight to the DOM (no
 * re-renders). Screen readers get only the final value; reduced motion skips
 * the animation entirely.
 */
export function CountUp({ value, format, ms = 600 }: { value: number; format: (v: number) => string; ms?: number }) {
  const el = useRef<HTMLSpanElement>(null);
  const shown = useRef(0);
  // Layout effect: set the starting value before paint (no flash of the final number).
  useLayoutEffect(() => {
    const node = el.current;
    if (!node) return;
    const from = shown.current;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from === value) {
      node.textContent = format(value);
      shown.current = value;
      return;
    }
    const start = performance.now();
    let raf = 0;
    const tick = (t: number) => {
      const k = Math.min(1, (t - start) / ms);
      const eased = 1 - (1 - k) ** 3;
      const v = from + (value - from) * eased;
      node.textContent = format(k < 1 ? v : value);
      shown.current = v;
      if (k < 1) raf = requestAnimationFrame(tick);
      else shown.current = value;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, format, ms]);
  return (
    <>
      <span ref={el} aria-hidden="true">
        {format(value)}
      </span>
      <span className="sr-only">{format(value)}</span>
    </>
  );
}
