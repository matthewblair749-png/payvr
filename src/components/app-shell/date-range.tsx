"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { cn } from "@/lib/utils";
import { DEFAULT_RANGE, parseRange, RANGES } from "./nav";

/**
 * Global date range. It lives in the URL (?range=), so it's shareable, works
 * with back/forward, and every page reads the same value.
 */
export function DateRange() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const range = parseRange(params.get("range"));
  const [pending, start] = useTransition();

  function set(value: string) {
    const next = new URLSearchParams(params.toString());
    if (value === DEFAULT_RANGE) next.delete("range");
    else next.set("range", value);
    const qs = next.toString();
    start(() => router.push(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
  }

  return (
    <fieldset
      className={cn("flex shrink-0 rounded-control border border-app-hairline bg-app-card p-0.5", pending && "opacity-70")}
      aria-busy={pending || undefined}
    >
      <legend className="sr-only">Date range</legend>
      {RANGES.map((r) => (
        <label key={r.value} className="cursor-pointer" title={r.long}>
          <input
            type="radio"
            name="global-range"
            value={r.value}
            checked={range === r.value}
            onChange={() => set(r.value)}
            className="peer sr-only"
          />
          <span className="sr-only">{r.long}</span>
          <span
            aria-hidden="true"
            className="block rounded-[8px] px-2.5 py-1 text-ui font-medium text-app-muted peer-checked:bg-app-fg peer-checked:font-semibold peer-checked:text-app-page peer-focus-visible:outline-2 peer-focus-visible:outline-app-fg"
          >
            {r.label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}
