"use client";

import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useWidth } from "@/components/dashboard/charts";
import type { AskChart as Chart } from "@/server/home/ask";
import { cn } from "@/lib/utils";
import { count, money, moneyCompact, pct } from "./format";

export function formatValue(v: number, unit: Chart["unit"], currency: string) {
  return unit === "money" ? money(Math.round(v), currency) : unit === "percent" ? pct(v, 0) : count(Math.round(v));
}

/**
 * The answer's small chart. Monochrome (ink and gray), with the point the
 * answer is about in full ink. Bars carry their values, so no hover needed.
 */
export function AskChart({ chart, currency }: { chart: Chart; currency: string }) {
  const max = Math.max(...chart.points.map((p) => p.value), chart.unit === "percent" ? 0.01 : 1);
  const summary = `${chart.title}: ${chart.points.map((p) => `${p.label} ${formatValue(p.value, chart.unit, currency)}`).join(", ")}.`;

  if (chart.kind === "bar") {
    return (
      <figure className="mt-4">
        <figcaption className="text-cap font-semibold text-app-muted">{chart.title}</figcaption>
        <ul className="mt-2 space-y-1.5" aria-label={summary}>
          {chart.points.map((p) => {
            const hot = p.label === chart.highlight;
            return (
              <li key={p.label} className="grid grid-cols-[7rem_1fr_auto] items-center gap-3 text-ui">
                <span className={cn("truncate", hot ? "font-semibold" : "text-app-muted")}>{p.label}</span>
                <span aria-hidden="true" className="h-2.5 rounded-r-[4px] bg-app-sunken">
                  <span
                    className={cn("block h-2.5 rounded-r-[4px]", hot ? "bg-(--app-chart-ink)" : "bg-(--app-chart-gray)")}
                    style={{ width: `${Math.max(1, (p.value / max) * 100)}%` }}
                  />
                </span>
                <span className={cn("text-right", hot && "font-semibold")}>{formatValue(p.value, chart.unit, currency)}</span>
              </li>
            );
          })}
        </ul>
      </figure>
    );
  }
  return <AskLine chart={chart} currency={currency} summary={summary} />;
}

function AskLine({ chart, currency, summary }: { chart: Chart; currency: string; summary: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const H = 120;
  const pts = chart.points;
  const max = Math.max(...pts.map((p) => p.value), 1);
  const x = scaleLinear({ domain: [0, Math.max(1, pts.length - 1)], range: [8, Math.max(9, width - 8)] });
  const y = scaleLinear({ domain: [0, max], range: [H - 20, 16] });
  const hi = pts.findIndex((p) => p.label === chart.highlight);
  const fmt = (v: number) => (chart.unit === "money" ? moneyCompact(v, currency) : formatValue(v, chart.unit, currency));
  return (
    <figure className="mt-4">
      <figcaption className="text-cap font-semibold text-app-muted">{chart.title}</figcaption>
      <div ref={ref} role="img" aria-label={summary} className="mt-2 h-[120px]">
        {width > 0 && (
          <svg width={width} height={H} aria-hidden="true" className="block overflow-visible">
            <line x1={0} x2={width} y1={H - 20} y2={H - 20} stroke="var(--app-chart-grid)" />
            <LinePath
              data={pts}
              x={(_, i) => x(i)}
              y={(p) => y(p.value)}
              curve={curveMonotoneX}
              stroke="var(--app-chart-ink)"
              strokeOpacity={0.75}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {hi >= 0 && (
              <g>
                <circle cx={x(hi)} cy={y(pts[hi].value)} r={4} fill="var(--app-chart-ink)" stroke="var(--app-card)" strokeWidth={2} />
                <text
                  x={x(hi)}
                  y={y(pts[hi].value) - 10}
                  textAnchor={x(hi) > width - 80 ? "end" : x(hi) < 80 ? "start" : "middle"}
                  fontSize={12}
                  fontWeight={600}
                  fill="var(--app-fg)"
                >
                  {pts[hi].label} · {fmt(pts[hi].value)}
                </text>
              </g>
            )}
            <text x={0} y={H - 4} fontSize={12} fill="var(--app-chart-axis)">
              {pts[0]?.label}
            </text>
            <text x={width} y={H - 4} textAnchor="end" fontSize={12} fill="var(--app-chart-axis)">
              {pts[pts.length - 1]?.label}
            </text>
          </svg>
        )}
      </div>
    </figure>
  );
}
