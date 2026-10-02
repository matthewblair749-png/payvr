"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Card, PageHeader } from "@/components/app-shell/page-header";
import { withRange } from "@/components/app-shell/nav";
import { parseRange, RANGES } from "@/lib/date-range";
import { LEAK_TITLES, STAGES, type StageKey } from "@/lib/tracking/events";
import { cn } from "@/lib/utils";
import type { FunnelDrilldown as Data, SegmentRow } from "@/server/dal/funnel";
import { DeltaBadge } from "./delta-badge";
import { count, delta, money, pct, roughMoney } from "./format";

const stageLabel = (k: StageKey) => STAGES.find((s) => s.key === k)!.label;

export function FunnelDrilldownView({ step }: { step: Exclude<StageKey, "visit"> }) {
  const range = parseRange(useSearchParams().get("range"));
  const periodLabel = RANGES.find((r) => r.value === range)!.long;
  const { data, isPending, isError, isPlaceholderData, refetch } = useQuery({
    queryKey: ["funnel", step, range],
    placeholderData: keepPreviousData,
    queryFn: async ({ signal }): Promise<Data> => {
      const res = await fetch(`/api/app/funnel/${step}?range=${range}`, { signal });
      if (!res.ok) throw new Error("unavailable");
      return res.json();
    },
  });
  const fromKey = STAGES[STAGES.findIndex((s) => s.key === step) - 1].key;

  return (
    <>
      <Link
        href={withRange("/studio", range)}
        className="mb-4 inline-flex items-center gap-1.5 rounded-control text-ui font-semibold text-app-muted hover:text-app-fg"
      >
        <ArrowLeft size={16} aria-hidden="true" /> Home
      </Link>
      <PageHeader title={LEAK_TITLES[step]} description={`Shoppers who reached ${stageLabel(fromKey)} but not ${stageLabel(step)} · ${periodLabel}`} />

      <nav aria-label="Funnel steps" className="mt-6 flex flex-wrap gap-1 rounded-control border border-app-hairline bg-app-card p-1 sm:w-max">
        {STAGES.slice(1).map((s, i) => (
          <Link
            key={s.key}
            href={withRange(`/studio/funnel/${s.key}`, range)}
            aria-current={s.key === step ? "page" : undefined}
            className="rounded-[8px] px-3 py-1.5 text-ui font-medium text-app-muted hover:text-app-fg aria-[current=page]:bg-app-fg aria-[current=page]:font-semibold aria-[current=page]:text-app-page"
          >
            {STAGES[i].label} → {s.label}
          </Link>
        ))}
      </nav>

      {isPending ? (
        <DrilldownSkeleton />
      ) : isError && !data ? (
        <Card role="alert" className="mt-6 p-8">
          <h2 className="font-display text-title font-bold">This breakdown didn&apos;t load</h2>
          <p className="mt-2 text-body text-app-muted">
            Your data is fine; lumen couldn&apos;t reach it just now.{" "}
            <button type="button" onClick={() => refetch()} className="font-semibold text-app-fg underline underline-offset-4">
              Try again
            </button>
          </p>
        </Card>
      ) : (
        <div className={cn("mt-6 space-y-4 transition-opacity duration-200 sm:space-y-6", isPlaceholderData && "opacity-60")} aria-busy={isPlaceholderData || undefined}>
          <Summary data={data} periodLabel={periodLabel} />
          <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
            {data.dimensions.map((d) => (
              <SegmentCard key={d.key} title={d.label} rows={d.rows} worst={data.worst?.dimension === d.key ? data.worst.value : null} />
            ))}
          </div>
          <LastFields data={data} />
        </div>
      )}
    </>
  );
}

function Summary({ data, periodLabel }: { data: Data; periodLabel: string }) {
  const o = data.overall;
  const d = delta("rate", o.dropRate, o.prevDropRate ?? o.dropRate, false);
  const w = data.worst;
  const top = data.lastFields[0];
  const perWeek = Math.round((data.opportunityCents / data.days) * 7);

  if (!o.reached) {
    return (
      <Card className="p-6 sm:p-8">
        <p className="text-body text-app-muted">
          No shoppers reached {stageLabel(data.from)} in this period, so there&apos;s nothing to break down yet.
        </p>
      </Card>
    );
  }

  return (
    <Card aria-labelledby="leak-summary" className="p-6 sm:p-8">
      <h2 id="leak-summary" className="sr-only">
        Summary
      </h2>
      <div className="flex flex-wrap items-end gap-x-10 gap-y-4">
        <div>
          <p className="text-ui font-semibold text-app-muted">Left at this step</p>
          <p className="mt-1 font-display text-hero font-bold tracking-[-0.04em]">{pct(o.dropRate, 0)}</p>
          {o.prevDropRate != null ? (
            <DeltaBadge className="mt-2" delta={d} against={`vs ${pct(o.prevDropRate, 0)} in the previous ${data.days} days`} />
          ) : (
            <p className="mt-2 text-ui text-app-muted">No earlier period to compare with</p>
          )}
        </div>
        <p className="max-w-xl pb-1 text-body">
          Of {count(o.reached)} shoppers who reached {stageLabel(data.from)}, <strong>{count(o.lost)}</strong> left before{" "}
          {stageLabel(data.to)} in the {periodLabel.toLowerCase()}.
          {w && (
            <>
              {" "}
              <strong>{capital(who(w))}</strong> are where it hurts:{" "}
              {pct(w.dropRate, 0)} left, vs {pct(w.othersDropRate, 0)} for everyone else.
            </>
          )}
          {top && top.field !== "none" && (
            <>
              {" "}
              Most were last on <strong>{top.label.toLowerCase()}</strong> ({pct(top.share, 0)}).
            </>
          )}
        </p>
      </div>

      {w && data.opportunityCents > 0 && (
        <div className="mt-6 border-t border-app-hairline pt-4">
          <p className="text-body">
            {w.basis === "previous"
              ? `If ${who(w)} went back to last period's ${pct(w.targetRate, 0)} rate`
              : `If you closed half the gap between ${who(w)} and everyone else`}
            , you&apos;d likely make about <strong>{roughMoney(perWeek, data.currency)} more a week</strong>.
          </p>
          <details className="group mt-2 text-ui text-app-muted">
            <summary className="w-max cursor-pointer rounded-control font-semibold text-app-fg underline-offset-4 hover:underline">
              How this is estimated
            </summary>
            <p className="mt-2 max-w-prose">
              {w.basis === "previous"
                ? `${capital(who(w))} left at ${pct(w.dropRate, 0)} this period, up from ${pct(w.targetRate, 0)}. Getting back there keeps about ${count(Math.round(w.recoverable))} more shoppers.`
                : `${capital(who(w))} left at ${pct(w.dropRate, 0)}, vs ${pct(w.othersDropRate, 0)} for everyone else. Closing half that gap (to ${pct(w.targetRate, 0)}) keeps about ${count(Math.round(w.recoverable))} more shoppers; phones rarely match desktops, so we don't assume the whole gap.`}{" "}
              Of shoppers who got past this step, {pct(data.payRateAfter, 0)} went on to pay,
              at an average order of {money(data.aovCents, data.currency)}. That&apos;s about {roughMoney(data.opportunityCents, data.currency)} over the{" "}
              {periodLabel.toLowerCase()}, or {roughMoney(perWeek, data.currency)} a week. It&apos;s an estimate, not a promise: a test is the way to know.
            </p>
          </details>
        </div>
      )}
    </Card>
  );
}

/** "mobile shoppers", "returning shoppers", "shoppers from Instagram", "orders under $50". */
function who(w: NonNullable<Data["worst"]>): string {
  if (w.dimension === "device" || w.dimension === "visitor") return `${w.label.toLowerCase()} shoppers`;
  if (w.dimension === "source") return `shoppers from ${w.label}`;
  // Order value: "Under $50" → "orders under $50"; "$50 to $99" → "orders of $50 to $99".
  return w.label.startsWith("Under") ? `orders ${w.label.toLowerCase()}` : `orders of ${w.label}`;
}
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One dimension as a table with an inline bar per row (the table is the chart). */
function SegmentCard({ title, rows, worst }: { title: string; rows: SegmentRow[]; worst: string | null }) {
  const id = `seg-${title.replace(/\W+/g, "-").toLowerCase()}`;
  return (
    <Card aria-labelledby={id} className="p-5 sm:p-6">
      <h3 id={id} className="font-display text-title font-bold">
        {title}
      </h3>
      <table className="mt-3 w-full text-left text-ui">
        <caption className="sr-only">Share who left, by {title.toLowerCase()}, with the previous period</caption>
        <thead className="sr-only">
          <tr>
            <th scope="col">Segment</th>
            <th scope="col">Left</th>
            <th scope="col">Shoppers</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const isWorst = r.value === worst;
            return (
              <tr key={r.value} className="align-top">
                <th scope="row" className="w-32 py-2 pr-3 font-medium">
                  {r.label}
                  {isWorst && <span className="block text-cap font-semibold text-app-accent-text">Biggest gap</span>}
                </th>
                <td className="py-2">
                  {r.small ? (
                    <span className="text-cap text-app-muted">Too few to tell</span>
                  ) : (
                    <>
                      <div className="flex items-center gap-3">
                        {/* Shared 0–100% scale, so bars compare across cards. */}
                        <div aria-hidden="true" className="h-2.5 flex-1 rounded-r-[4px] bg-app-sunken">
                          <div
                            className={cn("app-grow h-2.5 rounded-r-[4px]", isWorst ? "bg-app-accent" : "bg-(--app-chart-gray)")}
                            style={{ width: `${Math.max(1, r.dropRate * 100)}%` }}
                          />
                        </div>
                        <span className="w-14 shrink-0 text-right font-semibold">{pct(r.dropRate, 0)}</span>
                      </div>
                      <p className="mt-0.5 text-cap text-app-muted">
                        {r.prevDropRate != null ? `was ${pct(r.prevDropRate, 0)}` : "no earlier data"}
                      </p>
                    </>
                  )}
                </td>
                <td className="w-28 whitespace-nowrap py-2 pl-3 text-right text-cap text-app-muted">{count(r.reached)} shoppers</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </Card>
  );
}

function LastFields({ data }: { data: Data }) {
  if (!data.lastFields.length) return null;
  return (
    <Card aria-labelledby="last-fields" className="p-5 sm:p-6">
      <h3 id="last-fields" className="font-display text-title font-bold">
        Where they were when they left
      </h3>
      <p className="mt-1 text-ui text-app-muted">The last part of the checkout each shopper touched before leaving.</p>
      <ul className="mt-4 space-y-3">
        {data.lastFields.map((f) => (
          <li key={f.field} className="grid grid-cols-[8rem_1fr_auto] items-center gap-3 text-ui sm:grid-cols-[12rem_1fr_auto]">
            <span className="font-medium">{f.label}</span>
            <span aria-hidden="true" className="h-2.5 rounded-r-[4px] bg-(--app-chart-gray)" style={{ width: `${Math.max(1, f.share * 100)}%` }} />
            <span className="text-right">
              <span className="font-semibold">{pct(f.share, 0)}</span> <span className="text-cap text-app-muted">({count(f.count)})</span>
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function DrilldownSkeleton() {
  return (
    <div className="mt-6 space-y-4 sm:space-y-6" role="status" aria-label="Loading the breakdown">
      <Card aria-hidden="true" className="h-[220px] p-8">
        <div className="app-skeleton h-5 w-32" />
        <div className="app-skeleton mt-3 h-14 w-28" />
        <div className="app-skeleton mt-3 h-5 w-64" />
      </Card>
      <div className="grid gap-4 sm:gap-6 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => (
          <Card key={i} aria-hidden="true" className="h-[260px] p-6">
            <div className="app-skeleton h-6 w-40" />
            <div className="app-skeleton mt-6 h-4 w-full" />
            <div className="app-skeleton mt-6 h-4 w-5/6" />
            <div className="app-skeleton mt-6 h-4 w-2/3" />
          </Card>
        ))}
      </div>
    </div>
  );
}
