"use client";

import { m, useReducedMotion } from "framer-motion";

/**
 * Success mark: a filled accent disc springs in, then the check strokes on.
 * With reduced motion it simply appears.
 */
export function SuccessCheck({ size = 72 }: { size?: number }) {
  const reduce = useReducedMotion();
  return (
    <m.svg
      width={size}
      height={size}
      viewBox="0 0 72 72"
      aria-hidden="true"
      initial={reduce ? false : { scale: 0.4, rotate: -30 }}
      animate={{ scale: 1, rotate: 0 }}
      transition={{ type: "spring", stiffness: 380, damping: 16 }}
    >
      <circle cx="36" cy="36" r="34" fill="var(--co-accent)" />
      <m.path
        d="M22 37.5 31.5 47 50 27"
        fill="none"
        stroke="var(--co-accent-fg)"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={reduce ? false : { pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ delay: 0.18, duration: 0.42, ease: [0.22, 1, 0.36, 1] }}
      />
    </m.svg>
  );
}
