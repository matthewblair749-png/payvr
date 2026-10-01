"use client";

import { useQuery } from "@tanstack/react-query";

type Live = { recent: number; lastSaleAt: string | null };

/**
 * A quiet "Live" pulse, shown only while real sales are happening (a paid
 * order in the last 15 minutes). Polls every 20s while the tab is visible.
 */
export function LiveIndicator() {
  const { data } = useQuery({
    queryKey: ["live"],
    queryFn: async (): Promise<Live> => {
      const res = await fetch("/api/app/live");
      if (!res.ok) throw new Error("live");
      return res.json();
    },
    refetchInterval: 20_000,
  });
  if (!data?.recent) return null;
  const text = `${data.recent} ${data.recent === 1 ? "sale" : "sales"} in the last 15 minutes`;
  return (
    <span className="flex shrink-0 items-center gap-2 rounded-full px-2.5 py-1 text-cap font-semibold text-app-success-text" title={text}>
      <span aria-hidden="true" className="app-live-dot size-2 rounded-full bg-app-success" />
      Live
      <span className="sr-only">: {text}</span>
    </span>
  );
}
