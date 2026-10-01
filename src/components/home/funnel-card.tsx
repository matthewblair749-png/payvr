"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowDownRight, ArrowRight, ChevronRight } from "lucide-react";
import Link from "next/link";
import { Fragment } from "react";
import { Card } from "@/components/app-shell/page-header";
import { withRange } from "@/components/app-shell/nav";
import type { RangeValue } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import type { FunnelOverview, Transition } from "@/server/dal/funnel";
import { count, pct } from "./format";

// Tallest natural heights measured per breakpoint (the summary line wraps differently).
export const FUNNEL_HEIGHT = "min-h-[748px] sm:min-h-[720px] md:min-h-[356px] xl:min-h-[300px]";

export function useFunnel(range: RangeValue) {
  return useQuery({
    queryKey: ["home", "funnel", range],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<FunnelOverview> => {
      const res = await fetch(`/api/app/funnel?range=${range}`, { signal });
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    },
  });
}

/**
 * Visit → Start → Details → Payment → Paid. Bars are one ink series (share of
 * visits); the drop between steps is the story, and the single costliest
 * leak is the only orange on the card.
 */
export function FunnelCard({ data, range, periodLabel }: { data: FunnelOverview; range: RangeValue; periodLabel: string }) {
  const visits = data.stages[0].sessions;
  const leak = data.transitions.find((t) => t.to === data.biggestLeak) ?? null;
  const paidRate = visits ? data.stages[4].sessions / visits : 0;
  const prevVisits = data.stages[0].prevSessions;
  const prevPaidRate = prevVisits ? data.stages[4].prevSessions / prevVisits : null;
  const href = (to: string) => withRange(`/studio/funnel/${to}`, range);

  if (!visits) {
    return (
      <Card aria-labelledby="funnel-title" className="p-6 sm:p-8">
        <h2 id="funnel-title" className="text-ui font-semibold text-app-muted">
          Checkout funnel · {periodLabel}
        </h2>
        <p className="mt-3 text-body text-app-muted">
          No one has opened a checkout in this period. Share a checkout link and each step shoppers take shows up here within seconds.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="funnel-title" className={`${FUNNEL_HEIGHT} p-6 sm:p-8`}>
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-1">
        <h2 id="funnel-title" className="text-ui font-semibold text-app-muted">
          Checkout funnel · {periodLabel}
        </h2>
        <p className="text-ui text-app-muted">
          <span className="font-semibold text-app-fg">{pct(paidRate)}</span> of visits paid
          {prevPaidRate != null && <> · was {pct(prevPaidRate)}</>}
        </p>
      </div>

      <ol className="mt-6 grid gap-y-2 md:grid-cols-[1fr_auto_1fr_auto_1fr_auto_1fr_auto_1fr] md:gap-x-2">
        {data.stages.map((s, i) => {
          const t = i > 0 ? data.transitions[i - 1] : null;
          return (
            <Fragment key={s.key}>
              {t && (
                <li className="flex items-center md:justify-center" aria-label={`Between ${data.stages[i - 1].label} and ${s.label}`}>
                  <Leak t={t} isLeak={t.to === data.biggestLeak} href={href(t.to)} />
                </li>
              )}
              <li className="rounded-control md:py-1">
                {/* Phones: label left, number right. Wider: stacked columns. */}
                <div className="flex items-start justify-between gap-3 md:block">
                  <div>
                    <p className="text-ui font-semibold">{s.label}</p>
                    <p className="text-cap text-app-muted">{s.hint}</p>
                  </div>
                  <div className="text-right md:mt-2 md:text-left">
                    <p className="text-title font-semibold">{count(s.sessions)}</p>
                    <p className="text-cap text-app-muted">{i === 0 ? "visits" : `${pct(s.sessions / visits, 0)} of visits`}</p>
                  </div>
                </div>
                <div aria-hidden="true" className="mt-2 h-2 rounded-full bg-app-sunken">
                  <div className="h-2 rounded-full bg-(--app-chart-ink) opacity-80" style={{ width: `${Math.max(2, (s.sessions / visits) * 100)}%` }} />
                </div>
              </li>
            </Fragment>
          );
        })}
      </ol>

      {leak && (
        <p className="mt-6 flex flex-wrap items-center gap-x-2 gap-y-1 border-t border-app-hairline pt-4 text-ui">
          <span className="font-semibold">Biggest leak:</span>
          <span className="text-app-muted">
            {count(leak.lost)} shoppers ({pct(leak.dropRate, 0)}) got to {label(data, leak.from)} but left before {label(data, leak.to)}
            {leak.prevDropRate != null && leak.dropRate - leak.prevDropRate >= 0.02 && <>, up from {pct(leak.prevDropRate, 0)}</>}.
          </span>
          <Link href={href(leak.to)} className="inline-flex items-center gap-1 font-semibold underline-offset-4 hover:underline">
            See why <ArrowRight size={14} aria-hidden="true" />
          </Link>
        </p>
      )}
    </Card>
  );
}

const label = (d: FunnelOverview, key: string) => d.stages.find((s) => s.key === key)!.label;

/** The drop between two steps; a link to its drill-down. The costliest one is orange. */
function Leak({ t, isLeak, href }: { t: Transition; isLeak: boolean; href: string }) {
  const was = t.prevDropRate != null ? `was ${pct(t.prevDropRate, 0)}` : "no earlier data";
  return (
    <Link
      href={href}
      aria-label={`${pct(t.dropRate, 0)} left (${count(t.lost)} shoppers), ${was}.${isLeak ? " Biggest leak." : ""} See why`}
      className={cn(
        "flex w-full items-center gap-2 rounded-control border px-3 py-1.5 text-left transition-colors md:w-auto md:flex-col md:gap-0.5 md:px-2.5 md:text-center",
        isLeak
          ? "border-app-accent bg-app-accent-soft text-app-fg hover:bg-app-accent-soft/70"
          : "border-transparent text-app-muted hover:border-app-hairline hover:bg-app-sunken",
      )}
    >
      {isLeak && <span className="text-cap font-semibold text-app-accent-text md:order-first">Biggest leak</span>}
      <span className="inline-flex items-center gap-0.5 text-ui font-semibold text-app-fg">
        <ArrowDownRight size={14} aria-hidden="true" className={isLeak ? "text-app-accent" : undefined} />
        {pct(t.dropRate, 0)}
      </span>
      <span className="text-cap">{was}</span>
      <ChevronRight size={14} aria-hidden="true" className="ml-auto md:hidden" />
    </Link>
  );
}

export function FunnelSkeleton() {
  return (
    <Card aria-hidden="true" className={`${FUNNEL_HEIGHT} p-6 sm:p-8`}>
      <div className="app-skeleton h-5 w-56" />
      <div className="mt-6 grid gap-4 md:grid-cols-5">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i}>
            <div className="app-skeleton h-5 w-20" />
            <div className="app-skeleton mt-3 h-7 w-16" />
            <div className="app-skeleton mt-3 h-2 w-full" />
          </div>
        ))}
      </div>
    </Card>
  );
}
