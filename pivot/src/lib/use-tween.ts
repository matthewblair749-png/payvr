"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Smoothly animates a displayed number toward `target` (easeOutCubic).
 * Snaps immediately when the user prefers reduced motion.
 */
export function useTween(target: number, duration = 280): number {
  const [value, setValue] = useState(target);
  const from = useRef(target);
  const frame = useRef<number | null>(null);
  const current = useRef(target);

  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (frame.current) cancelAnimationFrame(frame.current);
    if (reduce) {
      current.current = target;
      frame.current = requestAnimationFrame(() => setValue(target));
      return;
    }
    from.current = current.current;
    const start = performance.now();
    const step = (t: number) => {
      const k = Math.min(1, (t - start) / duration);
      const eased = 1 - (1 - k) ** 3;
      const v = from.current + (target - from.current) * eased;
      current.current = v;
      setValue(v);
      if (k < 1) frame.current = requestAnimationFrame(step);
    };
    frame.current = requestAnimationFrame(step);
    return () => {
      if (frame.current) cancelAnimationFrame(frame.current);
    };
  }, [target, duration]);

  return value;
}
