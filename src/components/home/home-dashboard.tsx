"use client";

import { RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { useState } from "react";
import { Card } from "@/components/app-shell/page-header";
import { parseRange, RANGES, type RangeValue } from "@/lib/date-range";
import { type HomeLayout, type HomeView, rows, type SectionKey } from "@/lib/home-layout";
import { cn } from "@/lib/utils";
import { CustomizePanel, HomeToolbar, type LayoutState, useHomeLayout } from "./customize";
import { ExperimentCardView, LiveFeed, WhyTheyBuyCard } from "./activity-cards";
import { FunnelCard, FunnelSkeleton, useFunnel } from "./funnel-card";
import { KpiTiles } from "./kpi-tiles";
import { BriefSkeleton, MorningBrief } from "./morning-brief";
import { NorthStar } from "./north-star";
import { KpiSkeleton, NorthStarSkeleton } from "./skeletons";
import { useHomeOverview } from "./use-home";

/** Home's widgets. The global date range (top bar) scopes every one of them. */
export function HomeDashboard({ layout, views }: { layout: HomeLayout; views: HomeView[] }) {
  const state = useHomeLayout(layout, views);
  const [editing, setEditing] = useState(false);
  return (
    <>
      <HomeToolbar state={state} editing={editing} onEdit={setEditing} />
      {editing && <CustomizePanel state={state} onDone={() => setEditing(false)} />}
      <Sections state={state} />
    </>
  );
}

function Sections({ state }: { state: LayoutState }) {
  const range = parseRange(useSearchParams().get("range"));
  const periodLabel = RANGES.find((r) => r.value === range)!.long;
  const { data, isPending, isError, isPlaceholderData, refetch, isRefetching } = useHomeOverview(range);

  if (isPending) return <HomeSkeleton layout={state.layout} />;

  if (isError && !data) {
    return (
      <Card role="alert" className="mt-4 p-8">
        <h2 className="font-display text-title font-bold">Your numbers didn&apos;t load</h2>
        <p className="mt-2 max-w-prose text-body text-app-muted">
          Nothing is wrong with your sales or payouts. lumen couldn&apos;t reach your data just now, usually because the
          connection dropped. Try again, and if it keeps happening, reload the page.
        </p>
        <button
          type="button"
          onClick={() => refetch()}
          disabled={isRefetching}
          className="mt-5 inline-flex h-10 items-center gap-2 rounded-control bg-app-accent px-4 text-ui font-semibold text-app-accent-fg disabled:opacity-60"
        >
          <RefreshCw size={16} aria-hidden="true" className={cn(isRefetching && "motion-safe:animate-spin")} />
          {isRefetching ? "Trying again…" : "Try again"}
        </button>
      </Card>
    );
  }

  const overview = data!;
  function section(k: SectionKey) {
    switch (k) {
      case "brief":
        return <MorningBrief />;
      case "northStar":
        return <NorthStar data={overview} periodLabel={periodLabel} />;
      case "funnel":
        return <FunnelSection range={range} periodLabel={periodLabel} />;
      case "feed":
        return <LiveFeed className="h-full" />;
      case "why":
        return <WhyTheyBuyCard range={range} periodLabel={periodLabel} />;
      case "experiment":
        return <ExperimentCardView />;
      case "kpis":
        return null;
    }
  }

  return (
    // While a new range loads, the old numbers stay put, dimmed: no skeleton flash, no jump.
    <div
      aria-busy={isPlaceholderData || undefined}
      className={cn("mt-4 space-y-4 transition-opacity duration-200 sm:space-y-6", isPlaceholderData && "opacity-60")}
    >
      {/* First load: each card rises in 40ms after the one before (--i); KPI tiles stagger individually. */}
      {placed(state.layout).map((row) =>
        row.length === 1 && row[0].key !== "kpis" ? (
          <Reveal key={row[0].key} i={row[0].i}>
            {section(row[0].key)}
          </Reveal>
        ) : row[0].key === "kpis" ? (
          <KpiTiles key="kpis" data={data} stagger={row[0].i} />
        ) : (
          <SmallRow key={row.map((c) => c.key).join()} row={row} render={section} />
        ),
      )}
    </div>
  );
}

/** Loads on its own, so a slow funnel never holds back the North Star. */
function FunnelSection({ range, periodLabel }: { range: RangeValue; periodLabel: string }) {
  const { data, isPending, isError, isPlaceholderData, refetch } = useFunnel(range);
  if (isPending) return <FunnelSkeleton />;
  if (isError && !data) {
    return (
      <Card role="alert" className="p-6 sm:p-8">
        <h2 className="text-ui font-semibold">The checkout funnel didn&apos;t load</h2>
        <p className="mt-1 text-ui text-app-muted">
          Your other numbers are fine.{" "}
          <button type="button" onClick={() => refetch()} className="font-semibold text-app-fg underline underline-offset-4">
            Try again
          </button>
        </p>
      </Card>
    );
  }
  return (
    <div className={cn("transition-opacity duration-200", isPlaceholderData && "opacity-60")} aria-busy={isPlaceholderData || undefined}>
      <FunnelCard data={data} range={range} periodLabel={periodLabel} />
    </div>
  );
}

function Reveal({ i, className, children }: { i: number; className?: string; children: React.ReactNode }) {
  return (
    <div className={cn("app-reveal", className)} style={{ "--i": i } as React.CSSProperties}>
      {children}
    </div>
  );
}

type Placed = { key: SectionKey; i: number };

/** Rows of visible sections, each with its reveal index (the KPI row uses four). */
function placed(layout: HomeLayout): Placed[][] {
  let i = 0;
  return rows(layout).map((row) => row.map((key) => ({ key, i: (i += key === "kpis" ? 4 : 1) - (key === "kpis" ? 4 : 1) })));
}

/**
 * Feed, "Why they buy" and the experiment share a row on big screens when
 * they sit next to each other: the feed takes a tall third, the others stack.
 */
function SmallRow({ row, render }: { row: Placed[]; render: (k: SectionKey) => React.ReactNode }) {
  const feedAt = row.findIndex((c) => c.key === "feed");
  const hasFeed = feedAt >= 0;
  const three = row.length === 3;
  return (
    <div className={cn("grid gap-4 sm:gap-6", hasFeed ? "lg:grid-cols-3" : "lg:grid-cols-2")}>
      {row.map((c) => (
        <Reveal
          key={c.key}
          i={c.i}
          className={cn(
            c.key === "feed"
              ? cn(three && "lg:row-span-2", three && feedAt > 0 && "lg:col-start-3 lg:row-start-1")
              : cn(hasFeed && "lg:col-span-2", three && feedAt > 0 && "lg:col-start-1"),
          )}
        >
          {render(c.key)}
        </Reveal>
      ))}
    </div>
  );
}

/** Skeletons in the merchant's own order, so nothing jumps when the numbers arrive. */
export function HomeSkeleton({ layout }: { layout: HomeLayout }) {
  const first = rows(layout).flat().slice(0, 4);
  return (
    <div className="mt-4 space-y-4 sm:space-y-6" role="status" aria-label="Loading your numbers">
      {first.map((k) =>
        k === "brief" ? (
          <BriefSkeleton key={k} />
        ) : k === "northStar" ? (
          <NorthStarSkeleton key={k} />
        ) : k === "kpis" ? (
          <ul key={k} className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            {[0, 1, 2, 3].map((i) => (
              <li key={i}>
                <KpiSkeleton />
              </li>
            ))}
          </ul>
        ) : k === "funnel" ? (
          <FunnelSkeleton key={k} />
        ) : null,
      )}
    </div>
  );
}
