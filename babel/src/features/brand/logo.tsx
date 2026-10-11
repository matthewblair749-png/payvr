import clsx from "clsx";

/**
 * The Babel mark: a geometric "b/B" built from a stem and two stacked bowls.
 * Stem and lower bowl are ink on light backgrounds and ivory on dark ones;
 * the smaller top bowl is always coral. Flat, no gradients.
 */
export function LogoMark({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  const body = tone === "dark" ? "#F3EFE6" : "#0C1021";
  return (
    <svg viewBox="0 0 26 32" className={clsx("h-8 w-auto shrink-0", className)} aria-hidden focusable="false">
      <rect x="0" y="0" width="7" height="32" fill={body} />
      <path d="M7 0H12.5A6.5 6.5 0 0 1 12.5 13H7Z" fill="#FF5A3C" />
      <path d="M7 15H17A8.5 8.5 0 0 1 17 32H7Z" fill={body} />
    </svg>
  );
}

/** Mark plus the lowercase "babel" wordmark. */
export function Logo({ tone = "light", className }: { tone?: "light" | "dark"; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark tone={tone} className="h-7" />
      <span
        className={clsx(
          "font-display text-[1.65rem] font-black leading-none tracking-[-0.04em]",
          tone === "dark" ? "text-paper" : "text-ink-deep",
        )}
      >
        babel
      </span>
    </span>
  );
}
