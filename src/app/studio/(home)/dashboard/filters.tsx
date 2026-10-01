"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";

/**
 * One filter row above everything it scopes. Changing a filter keeps the
 * current charts on screen (dimmed) until the new data arrives: no skeletons.
 */
export function DashboardFilters({
  range,
  pageId,
  pages,
}: {
  range: string;
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
      <fieldset className="flex rounded-full bg-white p-1 shadow-soft ring-1 ring-black/5">
        <legend className="sr-only">Date range</legend>
        {[
          ["7", "7 days"],
          ["30", "30 days"],
          ["90", "90 days"],
        ].map(([v, label]) => (
          <label key={v} className="cursor-pointer">
            <input type="radio" name="range" value={v} checked={range === v} onChange={() => set("range", v)} className="peer sr-only" />
            <span className="block rounded-full px-4 py-1.5 text-sm font-semibold text-muted-strong peer-checked:bg-ink peer-checked:text-white peer-focus-visible:outline-3 peer-focus-visible:outline-ink">
              {label}
            </span>
          </label>
        ))}
      </fieldset>
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
