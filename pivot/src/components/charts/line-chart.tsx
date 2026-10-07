"use client";

import { curveMonotoneX } from "@visx/curve";
import { scaleLinear, scalePoint } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import type { ChartSeries } from "@/lib/engine/types";
import { count, money, monthLabel, monthShort, pct } from "@/lib/format";
import { cn } from "@/lib/utils";

/**
 * Line chart for monthly series.
 * - One y-axis, always. Emphasis series in ink, comparison in gray,
 *   forecasts dashed. Area wash only for a single actual series.
 * - Crosshair + tooltip on hover/touch; a visually hidden table for
 *   screen readers; the latest value labeled directly.
 * - Draws in once on load (CSS), then stays still.
 */

const fmt = (format: ChartSeries["format"], v: number, currency: string, compact = false) =>
  format === "money" ? money(v, currency) : format === "percent" ? pct(v) : count(v, compact);

function niceTicks(min: number, max: number, n = 4) {
  const span = max - min || Math.abs(max) || 1;
  const raw = span / n;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n) ?? 10 * mag;
  const start = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let t = start; t <= max + step * 0.5; t += step) ticks.push(Number(t.toFixed(10)));
  return ticks;
}

export function LineChart({
  periods,
  series,
  height = 260,
  currency = "USD",
  title,
  className,
}: {
  periods: string[];
  series: ChartSeries[];
  height?: number;
  currency?: string;
  title: string;
  className?: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(640);
  const [hover, setHover] = useState<number | null>(null);

  useLayoutEffect(() => {
    const el = wrap.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(260, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const format = series[0]?.format ?? "count";
  const compactAxis = width < 480;
  const m = { top: 16, right: compactAxis ? 12 : 20, bottom: 28, left: compactAxis ? 46 : 58 };
  const innerW = width - m.left - m.right;
  const innerH = height - m.top - m.bottom;

  const { x, y, ticks } = useMemo(() => {
    const vals = series.flatMap((s) => s.values.filter((v): v is number => v !== null));
    let lo = Math.min(...vals);
    let hi = Math.max(...vals);
    const pad = (hi - lo) * 0.12 || Math.abs(hi) * 0.1 || 1;
    lo = format === "percent" ? Math.max(0, lo - pad) : lo - pad;
    hi = hi + pad;
    if (format !== "percent" && lo < 0 && vals.every((v) => v >= 0)) lo = 0;
    const t = niceTicks(lo, hi, 4);
    return {
      x: scalePoint<string>({ domain: periods, range: [0, innerW], padding: 0.2 }),
      y: scaleLinear<number>({ domain: [t[0], t[t.length - 1]], range: [innerH, 0] }),
      ticks: t,
    };
  }, [series, periods, innerW, innerH, format]);

  const everyNth = Math.max(1, Math.ceil(periods.length / Math.max(3, Math.floor(innerW / 64))));
  const visible = series.filter((s) => s.values.some((v) => v !== null));
  const legend = visible.length > 1;
  const single = visible.filter((s) => s.kind !== "forecast").length === 1;
  const lastActualIdx = (() => {
    const a = visible.find((s) => s.kind === "actual");
    if (!a) return -1;
    for (let i = a.values.length - 1; i >= 0; i--) if (a.values[i] !== null) return i;
    return -1;
  })();

  function onMove(clientX: number) {
    const el = wrap.current;
    if (!el) return;
    const rel = clientX - el.getBoundingClientRect().left - m.left;
    const step = x.step();
    const i = Math.round((rel - x(periods[0])!) / step);
    setHover(i >= 0 && i < periods.length ? i : null);
  }

  const color = (s: ChartSeries) => (s.kind === "baseline" ? "var(--pv-chart-2)" : "var(--pv-chart-1)");
  const hp = hover !== null ? periods[hover] : null;

  return (
    <figure className={cn("relative", className)}>
      {legend && (
        <figcaption className="mb-3 flex flex-wrap gap-x-5 gap-y-1 text-[13px] text-muted">
          {visible.map((s) => (
            <span key={s.label} className="inline-flex items-center gap-2">
              <svg width="18" height="8" aria-hidden="true">
                <line x1="1" x2="17" y1="4" y2="4" stroke={color(s)} strokeWidth="2" strokeDasharray={s.kind === "forecast" ? "4 3" : undefined} strokeLinecap="round" />
              </svg>
              {s.label}
            </span>
          ))}
        </figcaption>
      )}
      <div
        ref={wrap}
        className="relative touch-pan-y select-none"
        onPointerMove={(e) => onMove(e.clientX)}
        onPointerDown={(e) => onMove(e.clientX)}
        onPointerLeave={() => setHover(null)}
      >
        <svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-label={title}>
          <g transform={`translate(${m.left},${m.top})`}>
            {ticks.map((t) => (
              <g key={t}>
                <line x1={0} x2={innerW} y1={y(t)} y2={y(t)} stroke="var(--pv-chart-grid)" strokeWidth={1} />
                <text x={-10} y={y(t)} dy="0.32em" textAnchor="end" className="fill-muted text-[11px]">
                  {fmt(format, t, currency, true)}
                </text>
              </g>
            ))}
            {periods.map((p, i) =>
              i % everyNth === 0 || i === periods.length - 1 ? (
                <text key={p} x={x(p)} y={innerH + 20} textAnchor="middle" className="fill-muted text-[11px]">
                  {monthShort(p)}
                </text>
              ) : null,
            )}
            {single &&
              visible
                .filter((s) => s.kind === "actual")
                .map((s) => (
                  <AreaClosed<number | null>
                    key={`area-${s.label}`}
                    data={s.values}
                    x={(_, i) => x(periods[i])!}
                    y={(v) => y(v as number)}
                    yScale={y}
                    defined={(v) => v !== null}
                    curve={curveMonotoneX}
                    fill="var(--pv-chart-1)"
                    fillOpacity={0.07}
                  />
                ))}
            {visible.map((s) => (
              <LinePath<number | null>
                key={s.label}
                data={s.values}
                x={(_, i) => x(periods[i])!}
                y={(v) => y(v as number)}
                defined={(v) => v !== null}
                curve={curveMonotoneX}
                stroke={color(s)}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeDasharray={s.kind === "forecast" ? "5 5" : undefined}
                strokeOpacity={s.kind === "forecast" ? 0.7 : 1}
                pathLength={s.kind === "forecast" ? undefined : 1}
                className={s.kind === "forecast" ? "anim-fade" : "anim-draw"}
                style={s.kind === "forecast" ? { animationDelay: "700ms" } : { ["--pv-len" as string]: 1 }}
              />
            ))}
            {lastActualIdx >= 0 &&
              hover === null &&
              visible
                .filter((s) => s.kind !== "forecast")
                .map((s) => {
                  const v = s.values[lastActualIdx];
                  if (v === null) return null;
                  return <circle key={`end-${s.label}`} cx={x(periods[lastActualIdx])} cy={y(v)} r={4.5} fill={color(s)} stroke="var(--pv-surface)" strokeWidth={2} />;
                })}
            {hp !== null && hover !== null && (
              <g>
                <line x1={x(hp)} x2={x(hp)} y1={0} y2={innerH} stroke="var(--pv-line-strong)" strokeWidth={1} />
                {visible.map((s) => {
                  const v = s.values[hover];
                  return v === null ? null : <circle key={`h-${s.label}`} cx={x(hp)} cy={y(v)} r={4.5} fill={color(s)} stroke="var(--pv-surface)" strokeWidth={2} />;
                })}
              </g>
            )}
          </g>
        </svg>
        {hp !== null && hover !== null && (
          <div
            className="pointer-events-none absolute top-1 z-10 min-w-36 rounded-xl border border-line bg-surface px-3 py-2 text-[13px] shadow-raise"
            style={{
              left: Math.min(Math.max(m.left + x(hp)! - 72, 0), width - 160),
            }}
          >
            <p className="text-muted">{monthLabel(hp)}</p>
            {visible.map((s) => {
              const v = s.values[hover];
              return v === null ? null : (
                <p key={s.label} className="mt-0.5 flex items-center justify-between gap-4">
                  <span className="text-ink-2">{s.label}</span>
                  <span className="font-heavy text-ink">{fmt(s.format, v, currency)}</span>
                </p>
              );
            })}
          </div>
        )}
      </div>
      <table className="sr-only">
        <caption>{title}</caption>
        <thead>
          <tr>
            <th scope="col">Month</th>
            {visible.map((s) => (
              <th key={s.label} scope="col">
                {s.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {periods.map((p, i) => (
            <tr key={p}>
              <th scope="row">{monthLabel(p)}</th>
              {visible.map((s) => (
                <td key={s.label}>{s.values[i] === null ? "–" : fmt(s.format, s.values[i] as number, currency)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}
