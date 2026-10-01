"use client";

import { curveMonotoneX } from "@visx/curve";
import { scaleLinear } from "@visx/scale";
import { LinePath } from "@visx/shape";
import { useMemo } from "react";
import { Card } from "@/components/app-shell/page-header";
import { useWidth } from "@/components/dashboard/charts";
import type { HomeDay, HomeOverview, PeriodTotals } from "@/server/dal/home";
import { DeltaBadge } from "./delta-badge";
import { delta, formatMetric, rollingMean, type MetricKind } from "./format";
import { KPI_HEIGHT } from "./skeletons";

type Tile = {
  key: string;
  label: string;
  kind: MetricKind;
  upIsGood: boolean;
  total: (t: PeriodTotals) => number;
  daily: (d: HomeDay) => number | null;
  /** How the sparkline is described to screen readers. */
  noun: string;
};

const TILES: Tile[] = [
  { key: "orders", label: "Orders", kind: "count", upIsGood: true, total: (t) => t.orders, daily: (d) => d.orders, noun: "orders per day" },
  {
    key: "conversion",
    label: "Conversion rate",
    kind: "rate",
    upIsGood: true,
    total: (t) => t.conversion,
    daily: (d) => d.conversion,
    noun: "daily conversion",
  },
  {
    key: "aov",
    label: "Average order value",
    kind: "money",
    upIsGood: true,
    total: (t) => t.aovCents,
    daily: (d) => d.aovCents,
    noun: "daily average order value",
  },
  {
    key: "issues",
    label: "Refund and dispute rate",
    kind: "rate",
    upIsGood: false,
    total: (t) => t.issueRate,
    daily: (d) => d.issueRate,
    noun: "daily refund and dispute rate",
  },
];

export function KpiTiles({ data }: { data: HomeOverview }) {
  return (
    <section aria-labelledby="kpi-heading">
      <h2 id="kpi-heading" className="sr-only">
        Key numbers
      </h2>
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {TILES.map((t) => (
          <li key={t.key}>
            <KpiTile tile={t} data={data} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function KpiTile({ tile, data }: { tile: Tile; data: HomeOverview }) {
  const cur = tile.total(data.current);
  const prev = tile.total(data.previous);
  const d = delta(tile.kind, cur, prev, tile.upIsGood);
  const fmt = (v: number) => formatMetric(tile.kind, v, data.currency);
  // Daily values are noisy over 30+ days; a 7-day average shows the trend.
  const smooth = data.days >= 30 ? 7 : 1;
  const points = rollingMean(data.series.map(tile.daily), smooth);
  const defined = points.filter((v): v is number => v != null);
  const lo = defined.length ? Math.min(...defined) : 0;
  const hi = defined.length ? Math.max(...defined) : 0;
  const titleId = `kpi-${tile.key}`;

  return (
    <Card aria-labelledby={titleId} className={`${KPI_HEIGHT} flex flex-col p-5`}>
      <h3 id={titleId} className="text-ui font-medium text-app-muted">
        {tile.label}
      </h3>
      <p className="mt-1 font-display text-figure font-bold tracking-[-0.03em]">{fmt(cur)}</p>
      <DeltaBadge className="mt-1" delta={d} against={`vs ${fmt(prev)}`} />
      <Sparkline
        points={points}
        label={
          defined.length
            ? `Trend of ${tile.noun}${smooth > 1 ? " (7-day average)" : ""} over the last ${data.days} days: between ${fmt(lo)} and ${fmt(hi)}, ending at ${fmt(defined[defined.length - 1])}.`
            : `No ${tile.noun} yet in this period.`
        }
      />
    </Card>
  );
}

/** Monochrome trend: ink line, a dot on today. Shape only, no axes. */
function Sparkline({ points, label }: { points: (number | null)[]; label: string }) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const h = 36;
  const { x, y } = useMemo(() => {
    const vals = points.filter((v): v is number => v != null);
    const lo = vals.length ? Math.min(...vals) : 0;
    const hi = vals.length ? Math.max(...vals) : 1;
    return {
      x: scaleLinear({ domain: [0, Math.max(1, points.length - 1)], range: [3, Math.max(4, width - 4)] }),
      // A flat series sits in the middle instead of on the floor.
      y: scaleLinear({ domain: hi === lo ? [lo - 1, hi + 1] : [lo, hi], range: [h - 4, 4] }),
    };
  }, [points, width]);
  const lastIndex = points.findLastIndex((v) => v != null);

  return (
    <div ref={ref} role="img" aria-label={label} className="mt-auto h-9">
      {width > 0 && lastIndex >= 0 && (
        <svg width={width} height={h} aria-hidden="true" className="block overflow-visible">
          <LinePath
            data={points.map((v, i) => [i, v] as const)}
            defined={([, v]) => v != null}
            x={([i]) => x(i)}
            y={([, v]) => y(v ?? 0)}
            curve={curveMonotoneX}
            stroke="var(--app-chart-ink)"
            strokeOpacity={0.7}
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <circle cx={x(lastIndex)} cy={y(points[lastIndex]!)} r={3} fill="var(--app-chart-ink)" stroke="var(--app-card)" strokeWidth={2} />
        </svg>
      )}
    </div>
  );
}
