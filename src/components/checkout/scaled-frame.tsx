"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Renders children at a fixed "device" size and scales them down to fit the
 * available width. Container queries inside see the true device width, so a
 * desktop preview lays out like a real desktop even in a narrow column.
 */
export function ScaledFrame({
  width,
  height,
  children,
  className,
  label,
}: {
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
  /** Accessible label for the preview region. */
  label: string;
}) {
  const outer = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outer.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      setScale(Math.min(1, entry.contentRect.width / width));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={outer} className="mx-auto w-full" style={{ maxWidth: width, height: height * scale }}>
      <div
        role="region"
        aria-label={label}
        className={cn("origin-top-left overflow-hidden", className)}
        style={{ width, height, transform: `scale(${scale})` }}
      >
        {children}
      </div>
    </div>
  );
}
