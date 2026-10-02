import { Card } from "@/components/app-shell/page-header";

/**
 * Skeletons shaped like the real cards, at the same fixed heights, so the swap
 * to real content moves nothing.
 */
// Measured natural heights: 469px on phones, 453px from 640px up (stable across ranges).
export const NORTH_STAR_HEIGHT = "min-h-[480px] sm:min-h-[456px]";
export const KPI_HEIGHT = "h-[168px]";

export function NorthStarSkeleton() {
  return (
    <Card aria-hidden="true" className={`${NORTH_STAR_HEIGHT} p-6 sm:p-8`}>
      <div className="app-skeleton h-5 w-40" />
      <div className="app-skeleton mt-4 h-14 w-64" />
      <div className="app-skeleton mt-3 h-5 w-72" />
      <div className="app-skeleton mt-8 h-[220px] w-full rounded-card opacity-60" />
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card aria-hidden="true" className={`${KPI_HEIGHT} p-5`}>
      <div className="app-skeleton h-5 w-24" />
      <div className="app-skeleton mt-3 h-9 w-28" />
      <div className="app-skeleton mt-2 h-5 w-36" />
      <div className="app-skeleton mt-4 h-9 w-full opacity-60" />
    </Card>
  );
}
