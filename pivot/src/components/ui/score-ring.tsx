import { cn } from "@/lib/utils";
import { CountUp } from "./count-up";

/**
 * A 0-100 score as a ring. Ink by default; `accent` only when this score is
 * the single most important number on the screen.
 */
export function ScoreRing({
  score,
  size = 120,
  stroke = 10,
  accent = false,
  label,
  className,
  showMax = true,
}: {
  score: number;
  size?: number;
  stroke?: number;
  accent?: boolean;
  label?: string;
  className?: string;
  showMax?: boolean;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const frac = Math.max(0, Math.min(100, score)) / 100;
  return (
    <div className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }} role="img" aria-label={`${label ?? "Score"}: ${Math.round(score)} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90" aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--pv-sunken)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          fill="none"
          stroke={accent ? "var(--pv-accent)" : "var(--pv-ink)"}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${c * frac} ${c}`}
          className="anim-draw"
          style={{ ["--pv-len" as string]: c * frac }}
        />
      </svg>
      <div className="absolute inset-0 grid place-items-center" aria-hidden="true">
        <div className="text-center leading-none">
          <CountUp
            value={score}
            className={cn("font-heavy tracking-tighter", accent ? "text-accent" : "text-ink")}
          />
          {showMax && <div className="mt-1 text-[11px] text-muted">/ 100</div>}
        </div>
      </div>
    </div>
  );
}
