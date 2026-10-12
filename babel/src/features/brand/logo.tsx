import clsx from "clsx";

/**
 * The Babel mark: a geometric "b/B" built from a stem and two stacked bowls.
 * Stem and lower bowl are ink on light backgrounds and ivory on dark ones
 * (they follow the theme through --logo-ink); the smaller top bowl is
 * always coral. Flat, no gradients.
 */
type Tone = "auto" | "dark";

export function LogoMark({ tone = "auto", className }: { tone?: Tone | "light"; className?: string }) {
  const body = tone === "dark" ? "var(--brand-ivory)" : "var(--logo-ink)";
  return (
    <svg viewBox="0 0 26 32" className={clsx("h-8 w-auto shrink-0", className)} aria-hidden focusable="false">
      <rect x="0" y="0" width="7" height="32" fill={body} />
      <path d="M7 0H12.5A6.5 6.5 0 0 1 12.5 13H7Z" fill="var(--brand-coral)" />
      <path d="M7 15H17A8.5 8.5 0 0 1 17 32H7Z" fill={body} />
    </svg>
  );
}

/** Mark plus the lowercase "babel" wordmark. */
export function Logo({ tone = "auto", className }: { tone?: Tone | "light"; className?: string }) {
  return (
    <span className={clsx("inline-flex items-center gap-2", className)}>
      <LogoMark tone={tone} className="h-7" />
      <span
        className="font-display text-2xl font-black leading-none tracking-[-0.04em]"
        style={{ color: tone === "dark" ? "var(--brand-ivory)" : "var(--logo-ink)" }}
      >
        babel
      </span>
    </span>
  );
}
