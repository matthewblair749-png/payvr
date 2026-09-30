import { cn } from "@/lib/utils";

/**
 * The lumen mark: a chunky rounded "L" built from two pill-shaped bars plus a
 * circular "spark", sitting on a squircle tile. Flat colors only — no gradients.
 *
 * - `default`:  orange tile, white L, yellow spark (use on light/ink backgrounds)
 * - `inverted`: white tile, orange L, amber spark (use on orange backgrounds)
 */
export type LogoVariant = "default" | "inverted";

const PALETTE: Record<LogoVariant, { tile: string; l: string; spark: string }> = {
  default: { tile: "#F04A1A", l: "#FFFFFF", spark: "#FFD84D" },
  inverted: { tile: "#FFFFFF", l: "#F04A1A", spark: "#FFB100" },
};

/** Squircle (superellipse-ish) tile path in a 100×100 box. */
const SQUIRCLE = "M50 0C88 0 100 12 100 50S88 100 50 100 0 88 0 50 12 0 50 0Z";

export function LogoMark({
  size = 40,
  variant = "default",
  animated = false,
  className,
  title = "lumen",
}: {
  size?: number;
  variant?: LogoVariant;
  /** Plays the CSS entrance (tile spring + spark pop). Respects reduced motion. */
  animated?: boolean;
  className?: string;
  /** Accessible name. Pass "" to mark as decorative (e.g. next to a wordmark). */
  title?: string;
}) {
  const c = PALETTE[variant];
  const decorative = title === "";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      className={cn(animated && "anim-tile-in", "shrink-0", className)}
      role={decorative ? undefined : "img"}
      aria-hidden={decorative || undefined}
      aria-label={decorative ? undefined : title}
    >
      <path d={SQUIRCLE} fill={c.tile} />
      {/* Vertical pill */}
      <rect x="27" y="20" width="19" height="60" rx="9.5" fill={c.l} />
      {/* Horizontal pill */}
      <rect x="27" y="61" width="46" height="19" rx="9.5" fill={c.l} />
      {/* Spark */}
      <circle cx="65" cy="35" r="8.5" fill={c.spark} className={animated ? "anim-spark-pop" : undefined} />
    </svg>
  );
}

/** "lumen" wordmark — always lowercase, Sora 700, tight tracking. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span className={cn("font-display font-bold lowercase leading-none tracking-[-0.05em]", className)}>
      lumen
    </span>
  );
}

/** Mark + wordmark lockup for nav bars and footers. */
export function Logo({
  variant = "default",
  size = 32,
  className,
  wordmarkClassName,
}: {
  variant?: LogoVariant;
  size?: number;
  className?: string;
  wordmarkClassName?: string;
}) {
  return (
    <span className={cn("inline-flex items-center gap-2", className)}>
      <LogoMark size={size} variant={variant} title="" />
      <Wordmark className={cn("text-[1.6rem]", wordmarkClassName)} />
    </span>
  );
}
