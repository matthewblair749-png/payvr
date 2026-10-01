"use client";

import { RefreshCw } from "lucide-react";
import { useSearchParams } from "next/navigation";
import { Card } from "@/components/app-shell/page-header";
import { parseRange, RANGES } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import { KpiTiles } from "./kpi-tiles";
import { NorthStar } from "./north-star";
import { KpiSkeleton, NorthStarSkeleton } from "./skeletons";
import { useHomeOverview } from "./use-home";

/** Home's widgets. The global date range (top bar) scopes every one of them. */
export function HomeDashboard() {
  const range = parseRange(useSearchParams().get("range"));
  const periodLabel = RANGES.find((r) => r.value === range)!.long;
  const { data, isPending, isError, isPlaceholderData, refetch, isRefetching } = useHomeOverview(range);

  if (isPending) return <HomeSkeleton />;

  if (isError && !data) {
    return (
      <Card role="alert" className="mt-8 p-8">
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

  return (
    // While a new range loads, the old numbers stay put, dimmed: no skeleton flash, no jump.
    <div
      aria-busy={isPlaceholderData || undefined}
      className={cn("mt-8 space-y-4 transition-opacity duration-200 sm:space-y-6", isPlaceholderData && "opacity-60")}
    >
      <NorthStar data={data} periodLabel={periodLabel} />
      <KpiTiles data={data} />
    </div>
  );
}

export function HomeSkeleton() {
  return (
    <div className="mt-8 space-y-4 sm:space-y-6" role="status" aria-label="Loading your numbers">
      <NorthStarSkeleton />
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <li key={i}>
            <KpiSkeleton />
          </li>
        ))}
      </ul>
    </div>
  );
}
