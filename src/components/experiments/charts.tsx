"use client";

/**
 * Experiment Lab charts. Two categorical series: A = blue, B = lumen orange
 * (validated: CVD ΔE 26, normal ΔE 36, both ≥3:1 on white). A legend is always
 * shown, lines are end-labeled, and every chart has a table twin.
 */
import { useMemo, useState } from "react";
import { fmtDay, niceTicks, TipRow, useWidth, VIZ } from "@/components/dashboard/charts";
import { cn } from "@/lib/utils";

export const SERIES = { A: "#2A78D6", B: "#F04A1A" } as const;
const STATUS = { good: "#0CA30C", goodText: "#006300", bad: "#D03B3B", badText: "#B42318" };

export function Legend({ names }: { names: { A: string; B: string } }) {
  return (
    <ul className="flex flex-wrap gap-x-5 gap-y-1 text-sm" aria-label="Legend">
      {(["A", "B"] as const).map((k) => (
        <li key={k} className="flex items-center gap-2">
          <span aria-hidden="true" className="h-0.5 w-4 rounded-full" style={{ background: SERIES[k] }} />
          <span className="font-semibold">{k}</span>
          <span className="text-muted-strong">{names[k]}</span>
        </li>
      ))}
    </ul>
  );
}

/** "Chance B beats the original" meter with a marker at the 95% ship line. */
export function ChanceMeter({ chance, label = "Chance B beats your original" }: { chance: number; label?: string }) {
  const value = Math.round(chance * 100);
  return (
    <div>
      <div className="flex items-baseline justify-between text-sm">
        <span className="font-medium text-muted-strong">{label}</span>
        <span className="text-2xl font-semibold tracking-[-0.02em]">{value}%</span>
      </div>
      <div
        role="meter"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={value}
        aria-valuetext={`${value} percent`}
        className="relative mt-2 h-3 rounded-full bg-[#FFE3D6]"
      >
        <div className="h-3 rounded-full" style={{ width: `${Math.max(1, value)}%`, background: SERIES.B }} />
        {/* 95% = "very likely": where we suggest shipping */}
        <span aria-hidden="true" className="absolute -top-1 h-5 w-0.5 rounded-full bg-ink" style={{ left: "95%" }} />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-strong" aria-hidden="true">
        <span>0%</span>
        <span style={{ marginLeft: "auto", marginRight: "3%" }}>95%: ship it</span>
      </div>
    </div>
  );
}

/**
 * Likely range of the difference (B − A), drawn around zero.
 * Color is status: green only if the whole range is better, red if worse.
 */
export function RangeBar({
  low,
  mid,
  high,
  format,
  unit,
}: {
  low: number;
  mid: number;
  high: number;
  format: (v: number) => string;
  /** e.g. "sales per 100 visitors" */
  unit: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const span = Math.max(Math.abs(low), Math.abs(high), 1e-9) * 1.25;
  const x = (v: number) => ((v + span) / (2 * span)) * width;
  const tone = low > 0 ? "good" : high < 0 ? "bad" : "neutral";
  const color = tone === "good" ? STATUS.good : tone === "bad" ? STATUS.bad : VIZ.ink2;
  const word = tone === "good" ? "Better" : tone === "bad" ? "Worse" : "Could go either way";
  return (
    <div>
      <p className="text-sm font-medium text-muted-strong">Likely difference with B ({unit})</p>
      <div ref={ref} className="relative mt-3 h-14" role="img" aria-label={`B vs original: most likely ${format(mid)}, somewhere between ${format(low)} and ${format(high)} ${unit}. ${word}.`}>
        {width > 0 && (
          <svg width={width} height={56} aria-hidden="true" className="overflow-visible">
            <line x1={0} x2={width} y1={22} y2={22} stroke={VIZ.grid} strokeWidth={1} />
            <line x1={x(0)} x2={x(0)} y1={8} y2={36} stroke={VIZ.baseline} strokeWidth={1} />
            <text x={x(0)} y={52} textAnchor="middle" fontSize={11} fill={VIZ.axis}>
              no change
            </text>
            <rect x={x(low)} y={16} width={Math.max(2, x(high) - x(low))} height={12} rx={6} fill={color} opacity={0.25} />
            <circle cx={x(mid)} cy={22} r={6} fill={color} stroke={VIZ.surface} strokeWidth={2} />
            <text x={x(low)} y={8} textAnchor="middle" fontSize={11} fill={VIZ.ink2}>
              {format(low)}
            </text>
            <text x={x(high)} y={8} textAnchor="middle" fontSize={11} fill={VIZ.ink2}>
              {format(high)}
            </text>
          </svg>
        )}
      </div>
      <p className={cn("mt-1 text-sm font-semibold")} style={{ color: tone === "good" ? STATUS.goodText : tone === "bad" ? STATUS.badText : VIZ.ink2 }}>
        <span aria-hidden="true">{tone === "good" ? "▲ " : tone === "bad" ? "▼ " : "◆ "}</span>
        {word}: most likely {format(mid)}
      </p>
    </div>
  );
}

type Day = { day: string; A: { visits: number; conversions: number }; B: { visits: number; conversions: number } };

/** Cumulative conversion per variant over the test (smooths daily noise, shows convergence). */
export function CumulativeChart({ days, height = 220 }: { days: Day[]; height?: number }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const pts = useMemo(() => {
    const acc = { A: { v: 0, c: 0 }, B: { v: 0, c: 0 } };
    return days.map((d) => {
      acc.A.v += d.A.visits;
      acc.A.c += d.A.conversions;
      acc.B.v += d.B.visits;
      acc.B.c += d.B.conversions;
      return { day: d.day, A: acc.A.v ? acc.A.c / acc.A.v : null, B: acc.B.v ? acc.B.c / acc.B.v : null };
    });
  }, [days]);
  const pad = { top: 14, right: 56, bottom: 26, left: 44 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;
  const max = Math.max(0.05, ...pts.flatMap((p) => [p.A ?? 0, p.B ?? 0]));
  const ticks = niceTicks(max);
  const top = ticks[ticks.length - 1];
  const xAt = (i: number) => pad.left + (pts.length > 1 ? (i / (pts.length - 1)) * plotW : plotW / 2);
  const yAt = (v: number) => pad.top + plotH - (v / top) * plotH;
  const path = (k: "A" | "B") =>
    pts
      .map((p, i) => (p[k] == null ? null : `${xAt(i)},${yAt(p[k]!)}`))
      .filter(Boolean)
      .map((xy, i) => `${i ? "L" : "M"}${xy}`)
      .join("");
  const every = Math.max(1, Math.ceil(pts.length / 6));
  const last = pts.length - 1;
  const pct = (v: number | null) => (v == null ? "–" : `${(v * 100).toFixed(1)}%`);

  return (
    <div
      ref={ref}
      className="relative outline-offset-4"
      tabIndex={0}
      role="img"
      aria-label={`Cumulative conversion over the test. Latest: A ${pct(pts[last]?.A ?? null)}, B ${pct(pts[last]?.B ?? null)}. Use arrow keys to read each day.`}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setActive((a) => Math.min(last, (a ?? -1) + 1));
        if (e.key === "ArrowLeft") setActive((a) => Math.max(0, (a ?? last + 1) - 1));
      }}
      onBlur={() => setActive(null)}
    >
      {width > 0 && pts.length > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? VIZ.baseline : VIZ.grid} />
              <text x={pad.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.axis}>
                {Math.round(t * 100)}%
              </text>
            </g>
          ))}
          {pts.map((p, i) =>
            i % every === 0 || i === last ? (
              <text key={p.day} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={VIZ.axis}>
                {fmtDay(p.day)}
              </text>
            ) : null,
          )}
          {(["A", "B"] as const).map((k) => (
            <g key={k}>
              <path d={path(k)} fill="none" stroke={SERIES[k]} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {pts[last]?.[k] != null && (
                <>
                  <circle cx={xAt(last)} cy={yAt(pts[last][k]!)} r={4} fill={SERIES[k]} stroke={VIZ.surface} strokeWidth={2} />
                  {/* End label in ink (text never wears the series color); the dot beside it carries identity. */}
                  <text x={xAt(last) + 10} y={yAt(pts[last][k]!)} dy="0.32em" fontSize={12} fontWeight={600} fill={VIZ.ink}>
                    {k} {pct(pts[last][k])}
                  </text>
                </>
              )}
            </g>
          ))}
          {active != null && <line x1={xAt(active)} x2={xAt(active)} y1={pad.top} y2={yAt(0)} stroke={VIZ.baseline} />}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              setActive(Math.round(((e.clientX - r.left) / r.width) * last));
            }}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      {active != null && pts[active] && (
        <div
          role="status"
          className="pointer-events-none absolute z-10 min-w-[9rem] -translate-x-1/2 rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lift"
          style={{ left: xAt(active), top: 0 }}
        >
          <div className="mb-1 text-white/70">Through {fmtDay(pts[active].day)}</div>
          <TipRow value={pct(pts[active].B)} label="B" color={SERIES.B} />
          <TipRow value={pct(pts[active].A)} label="A (original)" color={SERIES.A} />
        </div>
      )}
    </div>
  );
}
