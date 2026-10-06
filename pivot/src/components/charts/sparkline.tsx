import { cn } from "@/lib/utils";

/** A tiny trend line (server-rendered SVG, draws in once). */
export function Sparkline({
  values,
  width = 96,
  height = 28,
  tone = "ink",
  className,
  label,
}: {
  values: number[];
  width?: number;
  height?: number;
  tone?: "ink" | "gray";
  className?: string;
  label?: string;
}) {
  if (values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const pad = 3;
  const pts = values.map((v, i) => [pad + (i / (values.length - 1)) * (width - pad * 2), pad + (1 - (v - min) / span) * (height - pad * 2)] as const);
  const d = pts.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = pts[pts.length - 1];
  const color = tone === "ink" ? "var(--pv-chart-1)" : "var(--pv-chart-2)";
  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={cn("overflow-visible", className)} role={label ? "img" : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      <path d={d} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" pathLength={1} className="anim-draw" style={{ ["--pv-len" as string]: 1 }} />
      <circle cx={lx} cy={ly} r={3.5} fill={color} stroke="var(--pv-surface)" strokeWidth={2} />
    </svg>
  );
}
