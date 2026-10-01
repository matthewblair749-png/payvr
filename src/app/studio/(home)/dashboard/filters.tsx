"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * The page's own filters (the date range is global, in the top bar). Changing a filter keeps the
 * current charts on screen (dimmed) until the new data arrives: no skeletons.
 */
export function DashboardFilters({
  pageId,
  pages,
}: {
  pageId: string | null;
  pages: { id: string; name: string }[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [pending, start] = useTransition();

  function set(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString());
    if (value) next.set(key, value);
    else next.delete(key);
    start(() => router.push(`${pathname}?${next.toString()}`, { scroll: false }));
  }

  return (
    <div className="sticky top-0 z-20 -mx-5 mt-8 mb-6 flex flex-wrap items-center gap-3 bg-surface/90 px-5 py-3 backdrop-blur sm:-mx-8 sm:px-8" data-pending={pending || undefined}>
      <label htmlFor="page-filter" className="sr-only">
        Checkout
      </label>
      <select
        id="page-filter"
        value={pageId ?? ""}
        onChange={(e) => set("page", e.target.value || null)}
        className="rounded-full border-0 bg-white px-4 py-2 text-sm font-semibold shadow-soft ring-1 ring-black/5"
      >
        <option value="">All checkouts</option>
        {pages.map((p) => (
          <option key={p.id} value={p.id}>
            {p.name}
          </option>
        ))}
      </select>
      <span className="text-xs text-muted-strong">Days in UTC</span>
      {pending && (
        <span role="status" className="text-xs font-semibold text-muted-strong">
          Updating…
        </span>
      )}
      {/* Dim the charts below while the new slice loads. */}
      <style>{`[data-pending] ~ [data-dashboard]{opacity:.55;transition:opacity .2s}`}</style>
    </div>
  );
}
