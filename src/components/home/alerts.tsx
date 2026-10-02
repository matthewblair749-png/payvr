"use client";

import { useQuery } from "@tanstack/react-query";
import { ArrowRight, OctagonAlert, X } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import type { Alert } from "@/server/dal/alerts";

const KEY = "lumen:dismissed-alerts";
const read = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "[]");
  } catch {
    return [];
  }
};
const noop = () => () => {};

/** Critical alerts at the top of Home. Dismissing one hides it until something new happens. */
export function Alerts() {
  const { data } = useQuery({
    queryKey: ["home", "alerts"],
    queryFn: async (): Promise<Alert[]> => (await (await fetch("/api/app/alerts")).json()).alerts,
    refetchInterval: 60_000,
  });
  const stored = useSyncExternalStore(noop, () => localStorage.getItem(KEY) ?? "[]", () => "[]");
  const [dismissed, setDismissed] = useState<string[] | null>(null);
  const hidden = new Set(dismissed ?? (JSON.parse(stored) as string[]));
  const shown = (data ?? []).filter((a) => !hidden.has(a.id));
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
              const next = [...new Set([...read(), a.id])].slice(-50);
              try {
                localStorage.setItem(KEY, JSON.stringify(next));
              } catch {}
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
