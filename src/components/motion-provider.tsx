"use client";

import { LazyMotion, MotionConfig } from "framer-motion";
import type { ReactNode } from "react";

// Animation features are code-split and fetched after first paint.
const loadFeatures = () => import("./motion-features").then((m) => m.default);

/**
 * App-wide motion setup:
 * - LazyMotion + `m.*` components keep the initial JS bundle small.
 * - reducedMotion="user" makes every Framer animation honor the OS setting.
 */
export function MotionProvider({ children }: { children: ReactNode }) {
  return (
    <LazyMotion features={loadFeatures} strict>
      <MotionConfig reducedMotion="user">{children}</MotionConfig>
    </LazyMotion>
  );
}
