"use client";

/**
 * Dashboard chart primitives (hand-built SVG, no chart library).
 *
 * Follows the data-viz method: one series color (lumen orange, validated
 * ≥3:1 on white), thin marks with 4px rounded data-ends and 2px gaps,
 * recessive hairline grid, never a dual axis, text in ink tokens (never the
 * series color), a hover/keyboard tooltip on every mark, and a table-view
 * twin for every chart so no value is tooltip-only.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export const VIZ = {
  series: "#F04A1A",
  wash: "rgba(240, 74, 26, 0.10)",
  ink: "#0E0E10",
  ink2: "#5C5C64",
  axis: "#6B6B73",
  grid: "#ECECEF",
  baseline: "#D4D4D8",
  surface: "#FFFFFF",
};

// ---------------------------------------------------------------------------
// Utilities

/** Measure an element's width (charts render at real pixel size; no stretched text). */
export function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(0);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setWidth(Math.floor(e.contentRect.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  return [ref, width] as const;
}

/** "Nice" axis ticks: 0 and ~4 round steps above the max. */
export function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0, 1];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? raw;
  const ticks = [];
  for (let v = 0; v <= max + step * 0.001; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step);
  return ticks;
}

/** Sequential single-hue scale (light → dark orange) for heat cells. */
const HEAT_STOPS = ["#FFF1EB", "#FFC9B3", "#FB8A60", "#F04A1A", "#B8360F", "#7A2308"];
export function heatColor(t: number): string {
  const x = Math.max(0, Math.min(1, t)) * (HEAT_STOPS.length - 1);
  const i = Math.min(HEAT_STOPS.length - 2, Math.floor(x));
  const f = x - i;
  const a = HEAT_STOPS[i].match(/\w\w/g)!.map((h) => parseInt(h, 16));
  const b = HEAT_STOPS[i + 1].match(/\w\w/g)!.map((h) => parseInt(h, 16));
  return `rgb(${a.map((v, k) => Math.round(v + (b[k] - v) * f)).join(",")})`;
}
/** Ink or white for text sitting inside a heat cell. */
export function heatText(t: number) {
  return t > 0.5 ? "#FFFFFF" : VIZ.ink;
}

const shortDate = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", timeZone: "UTC" });
export const fmtDay = (iso: string) => shortDate.format(new Date(`${iso}T00:00:00Z`));

// ---------------------------------------------------------------------------
// Tooltip

type TipState = { x: number; y: number; content: ReactNode } | null;

function Tooltip({ tip }: { tip: TipState }) {
  if (!tip) return null;
  return (
    <div
      role="status"
      className="pointer-events-none absolute z-10 min-w-[8rem] -translate-x-1/2 -translate-y-[calc(100%+10px)] rounded-xl bg-ink px-3 py-2 text-xs text-white shadow-lift"
      style={{ left: tip.x, top: tip.y }}
    >
      {tip.content}
    </div>
  );
}

/** Tooltip row: value first (strong), label second, keyed with a short line in the series color. */
export function TipRow({ value, label, color = VIZ.series }: { value: string; label: string; color?: string }) {
  return (
    <div className="flex items-center gap-2">
      <span aria-hidden="true" className="h-0.5 w-3 rounded-full" style={{ background: color }} />
      <span className="font-semibold tabular-nums">{value}</span>
      <span className="text-white/70">{label}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Card + table view

export function ChartCard({
  title,
  subtitle,
  children,
  table,
  className,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  /** Accessible table twin of the chart. */
  table?: ReactNode;
  className?: string;
  action?: ReactNode;
}) {
  const id = useId();
  return (
    <section aria-labelledby={id} className={cn("rounded-[24px] bg-white p-5 shadow-soft ring-1 ring-black/5 sm:p-6", className)}>
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 id={id} className="font-display text-lg font-bold tracking-[-0.03em]">
            {title}
          </h2>
          {subtitle && <p className="mt-0.5 text-sm text-muted-strong">{subtitle}</p>}
        </div>
        {action}
      </div>
      {children}
      {table && (
        <details className="group mt-4 border-t border-black/6 pt-3">
          <summary className="cursor-pointer text-xs font-semibold text-muted-strong hover:text-ink">
            <span className="group-open:hidden">Show as table</span>
            <span className="hidden group-open:inline">Hide table</span>
          </summary>
          <div className="mt-3 max-h-72 overflow-auto">{table}</div>
        </details>
      )}
    </section>
  );
}

export function DataTable({ head, rows, caption }: { head: string[]; rows: (string | number)[][]; caption: string }) {
  return (
    <table className="w-full text-left text-sm">
      <caption className="sr-only">{caption}</caption>
      <thead>
        <tr>
          {head.map((h, i) => (
            <th key={h} scope="col" className={cn("pb-2 text-xs font-semibold text-muted-strong", i > 0 && "text-right")}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody className="tabular-nums">
        {rows.map((r, i) => (
          <tr key={i} className="border-t border-black/6">
            {r.map((c, j) => (
              <td key={j} className={cn("py-1.5", j > 0 && "text-right")}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ---------------------------------------------------------------------------
// Time series (columns or line) with crosshair + keyboard navigation

type SeriesPoint = { key: string; label: string; value: number | null };

export function TimeSeriesChart({
  points,
  kind,
  height = 200,
  formatValue,
  formatAxis,
  describe,
  tooltipLabel,
}: {
  points: SeriesPoint[];
  kind: "columns" | "line";
  height?: number;
  formatValue: (v: number) => string;
  formatAxis: (v: number) => string;
  /** One-sentence summary for screen readers. */
  describe: string;
  tooltipLabel: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const pad = { top: 12, right: 12, bottom: 26, left: 48 };
  const plotW = Math.max(0, width - pad.left - pad.right);
  const plotH = height - pad.top - pad.bottom;

  const max = Math.max(0, ...points.map((p) => p.value ?? 0));
  const ticks = useMemo(() => niceTicks(max), [max]);
  const top = ticks[ticks.length - 1] || 1;
  const n = points.length;
  const slot = n ? plotW / n : 0;
  const xAt = (i: number) => pad.left + slot * i + slot / 2;
  const yAt = (v: number) => pad.top + plotH - (v / top) * plotH;

  // ~6 evenly spaced x labels.
  const every = Math.max(1, Math.ceil(n / 6));

  const onMove = useCallback(
    (e: React.PointerEvent<SVGRectElement>) => {
      const rect = (e.currentTarget as SVGRectElement).getBoundingClientRect();
      const i = Math.max(0, Math.min(n - 1, Math.floor(((e.clientX - rect.left) / rect.width) * n)));
      setActive(i);
    },
    [n],
  );

  const onKey = (e: React.KeyboardEvent) => {
    if (!n) return;
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      e.preventDefault();
      setActive((a) => {
        const cur = a ?? (e.key === "ArrowRight" ? -1 : n);
        return Math.max(0, Math.min(n - 1, cur + (e.key === "ArrowRight" ? 1 : -1)));
      });
    } else if (e.key === "Home") setActive(0);
    else if (e.key === "End") setActive(n - 1);
  };

  const linePath = useMemo(() => {
    if (kind !== "line") return { line: "", area: "" };
    let line = "";
    let area = "";
    let run: [number, number][] = [];
    const flush = () => {
      if (!run.length) return;
      line += run.map(([x, y], i) => `${i ? "L" : "M"}${x},${y}`).join("");
      area += `M${run[0][0]},${yAt(0)}` + run.map(([x, y]) => `L${x},${y}`).join("") + `L${run[run.length - 1][0]},${yAt(0)}Z`;
      run = [];
    };
    points.forEach((p, i) => (p.value == null ? flush() : run.push([xAt(i), yAt(p.value)])));
    flush();
    return { line, area };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [points, kind, width, top]);

  const lastIdx = [...points].map((p) => p.value).findLastIndex((v) => v != null);
  const activePoint = active != null ? points[active] : null;

  return (
    <div
      ref={ref}
      className="relative outline-offset-4"
      tabIndex={0}
      role="img"
      aria-label={`${describe} Use the left and right arrow keys to read each day.`}
      onKeyDown={onKey}
      onBlur={() => setActive(null)}
    >
      {width > 0 && (
        <svg width={width} height={height} aria-hidden="true" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={pad.left} x2={width - pad.right} y1={yAt(t)} y2={yAt(t)} stroke={t === 0 ? VIZ.baseline : VIZ.grid} strokeWidth={1} />
              <text x={pad.left - 8} y={yAt(t)} dy="0.32em" textAnchor="end" fontSize={11} fill={VIZ.axis} className="tabular-nums">
                {formatAxis(t)}
              </text>
            </g>
          ))}
          {points.map((p, i) =>
            i % every === 0 ? (
              <text key={p.key} x={xAt(i)} y={height - 6} textAnchor="middle" fontSize={11} fill={VIZ.axis}>
                {p.label}
              </text>
            ) : null,
          )}

          {kind === "columns" &&
            points.map((p, i) => {
              if (!p.value) return null;
              const w = Math.max(1, Math.min(24, slot - 2));
              const x = xAt(i) - w / 2;
              const y = yAt(p.value);
              const h = yAt(0) - y;
              const r = Math.min(4, w / 2, h);
              return (
                <path
                  key={p.key}
                  d={`M${x},${yAt(0)}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${yAt(0)}Z`}
                  fill={VIZ.series}
                  opacity={active == null || active === i ? 1 : 0.55}
                />
              );
            })}

          {kind === "line" && (
            <>
              <path d={linePath.area} fill={VIZ.wash} />
              <path d={linePath.line} fill="none" stroke={VIZ.series} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />
              {lastIdx >= 0 && active == null && (
                <>
                  <circle cx={xAt(lastIdx)} cy={yAt(points[lastIdx].value!)} r={4} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={2} />
                  <text x={xAt(lastIdx) - 8} y={yAt(points[lastIdx].value!) - 10} textAnchor="end" fontSize={12} fontWeight={600} fill={VIZ.ink}>
                    {formatValue(points[lastIdx].value!)}
                  </text>
                </>
              )}
            </>
          )}

          {/* Crosshair */}
          {active != null && (
            <>
              <line x1={xAt(active)} x2={xAt(active)} y1={pad.top} y2={yAt(0)} stroke={VIZ.baseline} strokeWidth={1} />
              {kind === "line" && activePoint?.value != null && (
                <circle cx={xAt(active)} cy={yAt(activePoint.value)} r={4} fill={VIZ.series} stroke={VIZ.surface} strokeWidth={2} />
              )}
            </>
          )}

          {/* Hit layer: the whole plot, so the pointer only needs to find the date. */}
          <rect
            x={pad.left}
            y={pad.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onPointerMove={onMove}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}
      <Tooltip
        tip={
          activePoint
            ? {
                x: xAt(active!),
                y: activePoint.value != null ? yAt(activePoint.value) : yAt(0),
                content: (
                  <>
                    <div className="mb-1 text-white/70">{activePoint.label}</div>
                    <TipRow value={activePoint.value == null ? "No data" : formatValue(activePoint.value)} label={tooltipLabel} />
                  </>
                ),
              }
            : null
        }
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Horizontal bars (funnel, survey answers)

export type HBar = { key: string; label: string; value: number; valueLabel: string; note?: string };

export function HBarList({ bars, max, describe }: { bars: HBar[]; max?: number; describe: string }) {
  const top = max ?? Math.max(1, ...bars.map((b) => b.value));
  return (
    <ul aria-label={describe} className="space-y-3">
      {bars.map((b) => (
        <li key={b.key}>
          <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
            <span className="font-medium">{b.label}</span>
            <span className="shrink-0 font-semibold tabular-nums">{b.valueLabel}</span>
          </div>
          <div className="h-3 rounded-full bg-surface/70" aria-hidden="true">
            <div
              className="h-3 rounded-full transition-[width] duration-500 ease-[var(--ease-out-soft)]"
              style={{ width: `${Math.max(0.5, (b.value / top) * 100)}%`, background: VIZ.series }}
            />
          </div>
          {b.note && <p className="mt-1 text-xs text-muted-strong">{b.note}</p>}
        </li>
      ))}
    </ul>
  );
}

// ---------------------------------------------------------------------------
// Heatmap grid

export type HeatCell = {
  /** 0..1 position on the color scale. */
  t: number;
  /** Text inside the cell (e.g. "35%"). */
  label: string;
  /** Smaller second line (e.g. "of 288"). */
  sub?: string;
  /** Full sentence for tooltip / screen readers. */
  detail: string;
  /** Too little data to trust: drawn as an empty cell. */
  lowData?: boolean;
};

export function Heatmap({
  rows,
  cols,
  cells,
  legend,
  caption,
}: {
  rows: { key: string; label: string }[];
  cols: { key: string; label: string }[];
  cells: Record<string, HeatCell | undefined>; // key = `${row}|${col}`
  legend: { low: string; high: string; title: string };
  caption: string;
}) {
  const [tip, setTip] = useState<TipState>(null);
  const wrap = useRef<HTMLDivElement>(null);

  const show = (el: HTMLElement, cell: HeatCell) => {
    const box = wrap.current!.getBoundingClientRect();
    const r = el.getBoundingClientRect();
    setTip({ x: r.left - box.left + r.width / 2, y: r.top - box.top, content: <span>{cell.detail}</span> });
  };

  return (
    <div ref={wrap} className="relative">
      <div className="overflow-x-auto">
        <table className="w-full border-separate [border-spacing:2px] text-sm">
          <caption className="sr-only">{caption}</caption>
          <thead>
            <tr>
              <th scope="col" className="w-[38%]">
                <span className="sr-only">Row</span>
              </th>
              {cols.map((c) => (
                <th key={c.key} scope="col" className="pb-1 text-center text-xs font-semibold text-muted-strong">
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.key}>
                <th scope="row" className="pr-3 text-left text-sm font-medium">
                  {r.label}
                </th>
                {cols.map((c) => {
                  const cell = cells[`${r.key}|${c.key}`];
                  if (!cell || cell.lowData) {
                    return (
                      <td key={c.key} className="h-12 rounded-lg bg-surface/50 text-center text-xs text-muted-strong" title={cell?.detail ?? "No data"}>
                        <span aria-hidden="true">·</span>
                        <span className="sr-only">{cell?.detail ?? "No data"}</span>
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.key}
                      tabIndex={0}
                      onPointerEnter={(e) => show(e.currentTarget, cell)}
                      onPointerLeave={() => setTip(null)}
                      onFocus={(e) => show(e.currentTarget, cell)}
                      onBlur={() => setTip(null)}
                      className="h-12 min-w-16 rounded-lg text-center outline-offset-2 transition-[filter] hover:brightness-95"
                      style={{ background: heatColor(cell.t), color: heatText(cell.t) }}
                    >
                      <span className="block font-semibold tabular-nums leading-tight">{cell.label}</span>
                      {cell.sub && <span className="block text-[11px] leading-tight opacity-80">{cell.sub}</span>}
                      <span className="sr-only">{cell.detail}</span>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-3 flex items-center gap-2 text-xs text-muted-strong" aria-hidden="true">
        <span>{legend.title}</span>
        <span>{legend.low}</span>
        <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${[0, 0.2, 0.4, 0.6, 0.8, 1].map(heatColor).join(",")})` }} />
        <span>{legend.high}</span>
      </div>
      <Tooltip tip={tip} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Stat tile

export function StatTile({
  label,
  value,
  delta,
  upIsGood = true,
  hero = false,
}: {
  label: string;
  value: string;
  /** Relative change vs the previous period (0.12 = +12%), or null if not comparable. */
  delta: number | null;
  upIsGood?: boolean;
  hero?: boolean;
}) {
  const good = delta == null || Math.abs(delta) < 0.005 ? null : (delta > 0) === upIsGood;
  return (
    <div className="rounded-[24px] bg-white p-5 shadow-soft ring-1 ring-black/5">
      <p className="text-sm font-medium text-muted-strong">{label}</p>
      <p className={cn("mt-1 font-semibold tracking-[-0.03em]", hero ? "text-5xl" : "text-3xl")}>{value}</p>
      {delta != null && (
        <p className={cn("mt-1 text-sm font-semibold", good === null ? "text-muted-strong" : good ? "text-[#006300]" : "text-[#B42318]")}>
          <span aria-hidden="true">{Math.abs(delta) < 0.005 ? "→" : delta > 0 ? "↑" : "↓"}</span>{" "}
          {Math.abs(delta) < 0.005 ? "No change" : `${delta > 0 ? "+" : "−"}${Math.abs(delta * 100).toFixed(1)}%`}
          <span className="font-normal text-muted-strong"> vs previous period</span>
        </p>
      )}
    </div>
  );
}
