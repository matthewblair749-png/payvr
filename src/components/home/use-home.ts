"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import type { HomeOverview } from "@/server/dal/home";
import type { RangeValue } from "@/lib/date-range";

export function useHomeOverview(range: RangeValue) {
  return useQuery({
    queryKey: ["home", "overview", range],
    // Changing the range keeps the old numbers on screen (dimmed) until the new ones land.
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<HomeOverview> => {
      const res = await fetch(`/api/app/home?range=${range}`, { signal });
      if (!res.ok) throw new Error(res.status === 401 ? "signed-out" : "unavailable");
      return res.json();
    },
  });
}
