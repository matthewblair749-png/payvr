"use client";

import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { AreaClosed, LinePath } from "@visx/shape";
import { useId, useMemo, useState } from "react";
import { Card } from "@/components/app-shell/page-header";
import { niceTicks, useWidth } from "@/components/dashboard/charts";
import type { HomeDay, HomeOverview } from "@/server/dal/home";
import { DeltaBadge } from "./delta-badge";
import { delta, longDay, money, moneyCompact, shortDay } from "./format";
import { NORTH_STAR_HEIGHT } from "./skeletons";

const H = 220;

/** One plotted point: a day, or (for 90 days) a week ending on `end`. */
type Point = { start: string; end: string; prevStart: string; prevEnd: string; cur: number; prev: number };

/**
 * 90 daily points read as noise, so 90 days plot one point per week: the
 * average revenue per day that week. An average (not a total) keeps a short
 * first week honest and keeps the axis on the same $/day scale as 7 and 30
 * days. The table keeps every day.
 */
function toPoints(series: HomeDay[], unit: "day" | "week"): Point[] {
  if (unit === "day") {
    return series.map((d) => ({ start: d.day, end: d.day, prevStart: d.prevDay, prevEnd: d.prevDay, cur: d.revenueCents, prev: d.prevRevenueCents }));
  }
  const out: Point[] = [];
  for (let endIdx = series.length - 1; endIdx >= 0; endIdx -= 7) {
    const chunk = series.slice(Math.max(0, endIdx - 6), endIdx + 1);
    out.unshift({
      start: chunk[0].day,
      end: chunk[chunk.length - 1].day,
      prevStart: chunk[0].prevDay,
      prevEnd: chunk[chunk.length - 1].prevDay,
      cur: Math.round(chunk.reduce((a, d) => a + d.revenueCents, 0) / chunk.length),
      prev: Math.round(chunk.reduce((a, d) => a + d.prevRevenueCents, 0) / chunk.length),
    });
  }
  return out;
}

const span = (p: { start: string; end: string }) => (p.start === p.end ? longDay(p.start) : `${shortDay(p.start)} – ${shortDay(p.end)}`);
const PAD = { top: 28, right: 12, bottom: 26, left: 48 };

/**
 * The North Star: revenue for the period, huge, with its comparison, over an
 * orange area chart. The previous period rides along as a quiet gray line so
 * "is this normal?" is answered without hovering.
 */
export function NorthStar({ data, periodLabel }: { data: HomeOverview; periodLabel: string }) {
  const { current, previous, series, currency, days } = data;
  const d = delta("money", current.revenueCents, previous.revenueCents);
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();
  const summaryId = useId();
  const unit = days >= 90 ? "week" : "day";
  const points = useMemo(() => toPoints(series, unit), [series, unit]);
  const peak = points.reduce((a, b) => (b.cur > a.cur ? b : a), points[0]);
  const prevLabel = `previous ${days} days`;

  return (
    <Card aria-labelledby="north-star-title" className={`${NORTH_STAR_HEIGHT} p-6 sm:p-8`}>
      <div className="flex flex-wrap items-start justify-between gap-x-6 gap-y-3">
        <div>
          <h2 id="north-star-title" className="text-ui font-semibold text-app-muted">
            Revenue · {periodLabel}
          </h2>
          <p className="mt-2 font-display text-hero font-bold tracking-[-0.04em]">{money(current.revenueCents, currency)}</p>
          <DeltaBadge className="mt-3" delta={d} against={`vs ${money(previous.revenueCents, currency)} in the ${prevLabel}`} />
        </div>
        {/* Two series, so a legend (the end-label and best-day label supplement it). */}
        <ul aria-label="Legend" className="flex items-center gap-4 pt-1 text-cap text-app-muted">
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-app-accent" />
            This period
          </li>
          <li className="flex items-center gap-2">
            <span aria-hidden="true" className="h-0.5 w-4 rounded-full bg-(--app-chart-gray)" />
            Previous {days} days
          </li>
        </ul>
      </div>

      <p id={summaryId} className="sr-only">
        {unit === "week" ? "Average daily revenue, week by week," : "Daily revenue"} for the {periodLabel.toLowerCase()}: {money(current.revenueCents, currency)} in total, {d.spoken} on
        the {prevLabel}.
        {peak && peak.cur > 0 && ` Best ${unit} was ${span(peak)} with ${money(peak.cur, currency)}${unit === "week" ? " a day on average" : ""}.`} Use the arrow keys on the chart to read each{" "}
        {unit}, or show the table.
      </p>

      <RevenueChart points={points} unit={unit} currency={currency} peak={peak} summaryId={summaryId} />

      <button
        type="button"
        onClick={() => setShowTable((s) => !s)}
        aria-expanded={showTable}
        aria-controls={tableId}
        className="mt-2 rounded-control px-1 text-cap font-semibold text-app-muted underline-offset-4 hover:text-app-fg hover:underline"
      >
        {showTable ? "Hide table" : "Show as table"}
      </button>
      <div
        id={tableId}
        hidden={!showTable}
        // Scrollable, so it must be reachable from the keyboard.
        tabIndex={showTable ? 0 : undefined}
        role="region"
        aria-label="Daily revenue table"
        className="mt-3 max-h-80 overflow-y-auto rounded-control border border-app-hairline">
        {showTable && (
          <table className="w-full text-left text-ui">
            <caption className="sr-only">Daily revenue, this period and the {prevLabel}</caption>
            <thead className="sticky top-0 bg-app-card text-cap text-app-muted">
              <tr>
                <th scope="col" className="px-4 py-2 font-semibold">Day</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Revenue</th>
                <th scope="col" className="px-4 py-2 font-semibold">Same day, previous period</th>
                <th scope="col" className="px-4 py-2 text-right font-semibold">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {series.map((p) => (
                <tr key={p.day} className="border-t border-app-hairline">
                  <th scope="row" className="px-4 py-2 font-medium">{longDay(p.day)}</th>
                  <td className="px-4 py-2 text-right">{money(p.revenueCents, currency)}</td>
                  <td className="px-4 py-2 text-app-muted">{p.prevDay ? longDay(p.prevDay) : "–"}</td>
                  <td className="px-4 py-2 text-right text-app-muted">{money(p.prevRevenueCents, currency)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </Card>
  );
}

function RevenueChart({
  points: series,
  unit,
  currency,
  peak,
  summaryId,
}: {
  points: Point[];
  unit: "day" | "week";
  currency: string;
  peak: Point | undefined;
  summaryId: string;
}) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const last = series.length - 1;

  const { x, y, ticks } = useMemo(() => {
    const max = Math.max(1, ...series.flatMap((p) => [p.cur, p.prev]));
    const ticks = niceTicks(max, 3);
    return {
      ticks,
      x: scaleLinear({ domain: [0, Math.max(1, last)], range: [PAD.left, Math.max(PAD.left + 1, width - PAD.right)] }),
      y: scaleLinear({ domain: [0, ticks[ticks.length - 1]], range: [H - PAD.bottom, PAD.top] }),
    };
  }, [series, width, last]);

  const every = Math.max(1, Math.ceil(series.length / (width < 480 ? 3 : 6)));
  const peakIndex = peak ? series.indexOf(peak) : -1;
  const a = active != null ? series[active] : null;

  // Keep the best-day label inside the plot.
  const peakX = peakIndex >= 0 ? x(peakIndex) : 0;
  const peakAnchor = peakX > width - 120 ? "end" : peakX < PAD.left + 80 ? "start" : "middle";

  return (
    <div
      ref={ref}
      tabIndex={0}
      role="group"
      aria-roledescription="chart"
      aria-label={unit === "week" ? "Revenue per day, by week, chart" : "Daily revenue chart"}
      aria-describedby={summaryId}
      onKeyDown={(e) => {
        if (e.key === "ArrowRight") setActive((i) => Math.min(last, (i ?? -1) + 1));
        else if (e.key === "ArrowLeft") setActive((i) => Math.max(0, (i ?? last + 1) - 1));
        else if (e.key === "Home") setActive(0);
        else if (e.key === "End") setActive(last);
        else if (e.key === "Escape") setActive(null);
        else return;
        e.preventDefault();
      }}
      onBlur={() => setActive(null)}
      className="relative mt-6 h-[220px] rounded-control"
    >
      {width > 0 && series.length > 0 && (
        <svg width={width} height={H} aria-hidden="true" className="block overflow-visible">
          {ticks.map((t) => (
            <g key={t}>
              <line x1={PAD.left} x2={width - PAD.right} y1={y(t)} y2={y(t)} stroke="var(--app-chart-grid)" strokeWidth={1} />
              <text x={PAD.left - 10} y={y(t)} dy="0.32em" textAnchor="end" fontSize={12} fill="var(--app-chart-axis)">
                {moneyCompact(t, currency)}
              </text>
            </g>
          ))}
          {series.map((p, i) =>
            i % every === 0 || i === last ? (
              <text key={p.end} x={x(i)} y={H - 6} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize={12} fill="var(--app-chart-axis)">
                {i === last ? (unit === "week" ? "This week" : "Today") : shortDay(p.start)}
              </text>
            ) : null,
          )}

          {/* Previous period: quiet context */}
          <LinePath
            data={series}
            x={(_, i) => x(i)}
            y={(p) => y(p.prev)}
            curve={curveMonotoneX}
            stroke="var(--app-chart-gray)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          {/* This period: the one orange series */}
          <AreaClosed
            data={series}
            x={(_, i) => x(i)}
            y={(p) => y(p.cur)}
            yScale={y}
            curve={curveMonotoneX}
            fill="var(--app-chart-main-fill)"
          />
          <LinePath
            data={series}
            x={(_, i) => x(i)}
            y={(p) => y(p.cur)}
            curve={curveMonotoneX}
            stroke="var(--app-chart-main)"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Selective direct label: the best day only. */}
          {peak && peak.cur > 0 && active == null && (
            <g>
              <circle cx={peakX} cy={y(peak.cur)} r={4} fill="var(--app-chart-main)" stroke="var(--app-card)" strokeWidth={2} />
              <text x={peakX} y={y(peak.cur) - 12} textAnchor={peakAnchor} fontSize={12} fontWeight={600} fill="var(--app-fg)">
                Best {unit} · {unit === "week" ? span(peak) : shortDay(peak.start)} · {money(peak.cur, currency)}
                {unit === "week" ? " a day" : ""}
              </text>
            </g>
          )}
          {/* Today's point */}
          {active == null && (
            <circle cx={x(last)} cy={y(series[last].cur)} r={4} fill="var(--app-chart-main)" stroke="var(--app-card)" strokeWidth={2} />
          )}

          {/* Crosshair */}
          {a && active != null && (
            <g>
              <line x1={x(active)} x2={x(active)} y1={PAD.top - 8} y2={H - PAD.bottom} stroke="var(--app-chart-axis)" strokeWidth={1} />
              <circle cx={x(active)} cy={y(a.prev)} r={4} fill="var(--app-chart-gray)" stroke="var(--app-card)" strokeWidth={2} />
              <circle cx={x(active)} cy={y(a.cur)} r={5} fill="var(--app-chart-main)" stroke="var(--app-card)" strokeWidth={2} />
            </g>
          )}
          <rect
            x={PAD.left}
            y={0}
            width={Math.max(0, width - PAD.left - PAD.right)}
            height={H}
            fill="transparent"
            onPointerMove={(e) => {
              const r = e.currentTarget.getBoundingClientRect();
              const i = Math.round(((e.clientX - r.left) / r.width) * last);
              setActive(Math.max(0, Math.min(last, i)));
            }}
            onPointerLeave={() => setActive(null)}
          />
        </svg>
      )}

      {a && active != null && (
        <div
          className="pointer-events-none absolute top-0 z-10 w-max min-w-44 rounded-control border border-app-hairline bg-app-card px-3 py-2.5 text-cap shadow-pop"
          style={{
            left: Math.min(Math.max(x(active), 96), width - 96),
            transform: "translate(-50%, -100%)",
          }}
        >
          <p className="text-app-muted">
            {span(a)}
            {unit === "week" ? " · average per day" : ""}
          </p>
          <TipRow value={money(a.cur, currency)} label="This period" swatch="var(--app-chart-main)" />
          <TipRow
            value={money(a.prev, currency)}
            label={a.prevStart ? span({ start: a.prevStart, end: a.prevEnd }) : "Previous period"}
            swatch="var(--app-chart-gray)"
          />
        </div>
      )}
      {/* Keyboard readout for screen readers. */}
      <p className="sr-only" aria-live="polite">
        {a
          ? `${span(a)}: ${money(a.cur, currency)}${unit === "week" ? " a day" : ""}. Same ${unit} last period: ${money(a.prev, currency)}${unit === "week" ? " a day" : ""}.`
          : ""}
      </p>
    </div>
  );
}

function TipRow({ value, label, swatch }: { value: string; label: string; swatch: string }) {
  return (
    <p className="mt-1.5 flex items-center gap-2">
      <span aria-hidden="true" className="h-0.5 w-3 shrink-0 rounded-full" style={{ background: swatch }} />
      <span className="text-ui font-semibold text-app-fg">{value}</span>
      <span className="text-app-muted">{label}</span>
    </p>
  );
}
