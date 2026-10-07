"use client";

import { useEffect, useState } from "react";

/**
 * `value`, once it has stopped changing for `delay` ms. For screen-reader live
 * regions next to sliders: announce where the user landed, not every step.
 */
export function useSettled<T>(value: T, delay = 450): T {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return settled;
}
