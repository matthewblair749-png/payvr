"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, OctagonAlert, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { DISMISSED_ALERTS_COOKIE } from "@/components/app-shell/nav";
import type { Alert } from "@/server/dal/alerts";

/** Critical alerts at the top of Home. Dismissing one hides it until something new happens. */
export function Alerts({ initial, dismissed: initialDismissed }: { initial: Alert[]; dismissed: string[] }) {
  const { data } = useQuery({
    queryKey: ["home", "alerts"],
    queryFn: async (): Promise<Alert[]> => (await (await fetch("/api/app/alerts")).json()).alerts,
    initialData: initial,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
  const [dismissed, setDismissed] = useState(initialDismissed);
  const shown = data.filter((a) => !dismissed.includes(a.id));
  if (!shown.length) return null;

  return (
    <section aria-label="Needs attention" className="mt-6 space-y-2">
      {shown.map((a) => (
        <div key={a.id} className="flex items-start gap-3 rounded-card border border-app-failure/50 bg-app-failure-soft p-4">
          <OctagonAlert size={20} aria-hidden="true" className="mt-0.5 shrink-0 text-app-failure" />
          <div className="min-w-0 flex-1">
            <p className="text-ui font-semibold">
              <span className="text-app-failure-text">Needs attention: </span>
              {a.title}
            </p>
            <p className="mt-0.5 text-ui">{a.body}</p>
            <Link href={a.href} className="mt-1 inline-flex items-center gap-1 text-ui font-semibold underline-offset-4 hover:underline">
              {a.linkLabel} <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <button
            type="button"
            aria-label={`Dismiss: ${a.title}`}
            onClick={() => {
              const next = [...new Set([...dismissed, a.id])].slice(-20);
              document.cookie = `${DISMISSED_ALERTS_COOKIE}=${encodeURIComponent(next.join(" "))}; path=/studio; max-age=${60 * 60 * 24 * 180}; samesite=lax`;
              setDismissed(next);
            }}
            className="-m-1 grid size-8 shrink-0 place-items-center rounded-control hover:bg-app-card"
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ))}
    </section>
  );
}
