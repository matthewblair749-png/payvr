import { cn } from "@/lib/utils";

/**
 * The PIVOT mark: a compass needle on its pivot point, turned toward the next
 * move (north-east). Geometric, works from 16px favicon to app icon.
 * `animate` turns the needle from north once (the landing hero's motion).
 */
export function LogoMark({ size = 32, animate = false, className }: { size?: number; animate?: boolean; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true" className={cn("shrink-0", className)}>
      <rect width="32" height="32" rx="9" fill="var(--pv-ink, #0a1020)" />
      <g transform="rotate(45 16 16)">
        <g className={cn("pv-needle", animate && "anim-needle")}>
          <path d="M16 4.5 L20.4 16 L11.6 16 Z" fill="#fff" />
          <path d="M11.6 16 L20.4 16 L16 27.5 Z" fill="#fff" fillOpacity="0.42" />
        </g>
      </g>
      <circle cx="16" cy="16" r="2.4" fill="var(--pv-ink, #0a1020)" stroke="#fff" strokeWidth="1.5" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-heavy tracking-[0.02em] text-ink", className)}>PIVOT</span>;
}

export function Logo({ size = 28, className, animate = false }: { size?: number; className?: string; animate?: boolean }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark size={size} animate={animate} />
      <Wordmark className="text-[1.0625rem] leading-none" />
    </span>
  );
}
