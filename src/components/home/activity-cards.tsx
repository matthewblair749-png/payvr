"use client";

import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { AnimatePresence, m } from "framer-motion";
import { ArrowRight, CircleCheck, FlaskConical, MessageCircleQuestion, OctagonAlert, Undo2 } from "lucide-react";
import Link from "next/link";
import { useState, useSyncExternalStore } from "react";
import { Card } from "@/components/app-shell/page-header";
import { experimentStatusLine } from "@/lib/experiments/plain";
import type { RangeValue } from "@/lib/date-range";
import { cn } from "@/lib/utils";
import type { ExperimentCard as Experiment, Sale, WhyTheyBuy } from "@/server/dal/activity";
import { count, money, pct } from "./format";
import { openAsk } from "./morning-brief";

// Tallest natural heights measured per breakpoint (skeletons use the same, so nothing shifts).
// The feed spans two rows on wide screens and fills them.
export const FEED_HEIGHT = "min-h-[506px] md:min-h-[514px] lg:min-h-0 lg:h-full";
export const WHY_HEIGHT = "min-h-[288px]";
export const EXPERIMENT_HEIGHT = "min-h-[376px] md:min-h-[320px]";

async function getJson<T>(url: string, key: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) throw new Error("unavailable");
  return (await res.json())[key];
}

// ---------------------------------------------------------------------------
// Live sales

const regions = typeof Intl.DisplayNames === "function" ? new Intl.DisplayNames(["en"], { type: "region" }) : null;
const country = (code: string | null) => (code ? (regions?.of(code) ?? code) : null);

/** Re-render every 30s so "2 min ago" stays true. */
function useNow(ms = 30_000) {
  return useSyncExternalStore(
    (cb) => {
      const t = setInterval(cb, ms);
      return () => clearInterval(t);
    },
    () => Math.floor(Date.now() / ms) * ms,
    () => 0,
  );
}

function ago(iso: string, now: number) {
  if (!now) return "";
  const mins = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60_000));
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins} min ago`;
  const h = Math.round(mins / 60);
  if (h < 24) return `${h} h ago`;
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

const STATUS: Record<Sale["status"], { label: string; icon: typeof CircleCheck; cls: string }> = {
  SUCCEEDED: { label: "Paid", icon: CircleCheck, cls: "text-app-success" },
  PARTIALLY_REFUNDED: { label: "Part refunded", icon: Undo2, cls: "text-app-pending" },
  REFUNDED: { label: "Refunded", icon: Undo2, cls: "text-app-pending" },
  DISPUTED: { label: "Disputed", icon: OctagonAlert, cls: "text-app-failure" },
};

export function LiveFeed({ className }: { className?: string }) {
  const { data, isPending, isError } = useQuery({
    queryKey: ["home", "feed"],
    queryFn: () => getJson<Sale[]>("/api/app/feed", "sales"),
    refetchInterval: 15_000,
  });
  const now = useNow();
  // Only orders that arrive after the first load slide in. "Adjust state when
  // data changes" (during render), so no effect or ref is needed.
  const key = data?.map((s) => s.id).join(",") ?? null;
  const [track, setTrack] = useState<{ key: string | null; known: Set<string> | null; fresh: Sale[] }>({ key: null, known: null, fresh: [] });
  if (data && key !== track.key) {
    setTrack({ key, known: new Set(data.map((s) => s.id)), fresh: track.known ? data.filter((s) => !track.known!.has(s.id)) : [] });
  }
  const fresh = track.fresh;
  // One quiet announcement per update, never one per sale.
  const announce = !fresh.length ? "" : fresh.length === 1 ? `New sale: ${money(fresh[0].amountCents, fresh[0].currency.toUpperCase())}, ${fresh[0].product}` : `${fresh.length} new sales`;

  return (
    <Card aria-labelledby="feed-title" className={cn(FEED_HEIGHT, "flex flex-col p-5 sm:p-6", className)}>
      <h2 id="feed-title" className="text-ui font-semibold text-app-muted">
        Live sales
      </h2>
      <p className="sr-only" aria-live="polite">
        {announce}
      </p>
      {isPending ? (
        <ul aria-hidden="true" className="mt-4 space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <li key={i} className="app-skeleton h-10" />
          ))}
        </ul>
      ) : isError ? (
        <p className="mt-4 text-ui text-app-muted">Recent sales didn&apos;t load. They&apos;ll show up on the next refresh.</p>
      ) : !data.length ? (
        <p className="mt-4 text-ui text-app-muted">Your sales appear here the moment they land.</p>
      ) : (
        <ul className="mt-3 divide-y divide-app-hairline">
          <AnimatePresence initial={false}>
            {data.slice(0, 7).map((s) => {
              const st = STATUS[s.status];
              const Icon = st.icon;
              const isFresh = fresh.some((f) => f.id === s.id);
              return (
                <m.li
                  key={s.id}
                  layout="position"
                  initial={isFresh ? { opacity: 0, y: -12 } : false}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
                  className="flex items-start gap-3 py-2.5"
                >
                  <Icon size={16} aria-hidden="true" className={cn("mt-0.5 shrink-0", st.cls)} />
                  <div className="min-w-0 flex-1">
                    <p className="flex items-baseline justify-between gap-2 text-ui">
                      <span className="font-semibold">{money(s.amountCents, s.currency.toUpperCase())}</span>
                      <span className="shrink-0 text-cap text-app-muted">{ago(s.at, now)}</span>
                    </p>
                    <p className="truncate text-cap text-app-muted">
                      {s.status !== "SUCCEEDED" && <span className="font-semibold text-app-fg">{st.label} · </span>}
                      <span className="sr-only">{s.status === "SUCCEEDED" ? "Paid · " : ""}</span>
                      {s.product}
                      {country(s.country) && ` · ${country(s.country)}`}
                    </p>
                  </div>
                </m.li>
              );
            })}
          </AnimatePresence>
        </ul>
      )}
      <Link href="/studio/orders" className="mt-auto inline-flex items-center gap-1 pt-3 text-ui font-semibold text-app-muted hover:text-app-fg">
        All payments <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Why they buy

const TITLES: Record<string, string> = {
  why_bought: "Why they buy",
  nearly_stopped: "What nearly stopped them",
  heard_about: "Where they heard about you",
};

export function WhyTheyBuyCard({ range, periodLabel }: { range: RangeValue; periodLabel: string }) {
  const { data, isPending, isError, isPlaceholderData } = useQuery({
    queryKey: ["home", "why", range],
    placeholderData: keepPreviousData,
    queryFn: () => getJson<WhyTheyBuy | null>(`/api/app/why?range=${range}`, "why"),
  });
  if (isPending) return <CardSkeleton height={WHY_HEIGHT} rows={5} />;

  const title = data ? TITLES[data.question] : "Why they buy";
  const max = data ? Math.max(...data.answers.map((a) => a.share), 0.01) : 1;
  return (
    <Card aria-labelledby="why-title" className={cn(WHY_HEIGHT, "p-5 transition-opacity sm:p-6", isPlaceholderData && "opacity-60")}>
      <h2 id="why-title" className="text-ui font-semibold text-app-muted">
        {title} · {periodLabel}
      </h2>
      {isError ? (
        <p className="mt-3 text-ui text-app-muted">Buyers&apos; answers didn&apos;t load. Your other numbers are fine.</p>
      ) : !data ? (
        <p className="mt-3 max-w-prose text-body text-app-muted">
          No answers yet in this period. After paying, buyers can answer one quick question in a single tap. Choose it in{" "}
          <Link href="/studio/checkouts" className="font-semibold text-app-fg underline underline-offset-4">
            Checkout Studio
          </Link>{" "}
          under Survey.
        </p>
      ) : (
        <>
          <p className="mt-1 text-cap text-app-muted">
            {count(data.total)} answers to “{data.prompt}”
          </p>
          <ol className="mt-4 space-y-3">
            {data.answers.map((a, i) => {
              const ptsChange = a.prevShare == null ? null : Math.round((a.share - a.prevShare) * 100);
              return (
                <li key={a.key} className="grid grid-cols-[minmax(7rem,11rem)_1fr_auto] items-center gap-3 text-ui">
                  <span className={cn("truncate", i === 0 && "font-semibold")}>{a.label}</span>
                  <span aria-hidden="true" className="h-2.5 rounded-r-[4px] bg-app-sunken">
                    <span
                      className={cn("block h-2.5 rounded-r-[4px]", i === 0 ? "bg-(--app-chart-ink)" : "bg-(--app-chart-gray)")}
                      style={{ width: `${Math.max(1, (a.share / max) * 100)}%` }}
                    />
                  </span>
                  <span className="w-28 text-right">
                    <span className="font-semibold">{pct(a.share, 0)}</span>{" "}
                    <span className="text-cap text-app-muted">
                      {ptsChange == null ? "new" : ptsChange === 0 ? "no change" : `was ${pct(a.prevShare!, 0)}`}
                    </span>
                  </span>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Experiment

export function ExperimentCardView() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["home", "experiment"],
    queryFn: () => getJson<Experiment | null>("/api/app/experiment", "experiment"),
  });
  if (isPending) return <CardSkeleton height={EXPERIMENT_HEIGHT} rows={3} />;

  if (isError || !data) {
    return (
      <Card aria-labelledby="exp-title" className={cn(EXPERIMENT_HEIGHT, "flex flex-col p-5 sm:p-6")}>
        <h2 id="exp-title" className="text-ui font-semibold text-app-muted">
          Experiment
        </h2>
        <p className="mt-3 max-w-prose text-body">
          {isError ? "Your tests didn't load just now." : "No test running. A test shows half your shoppers a change, so you know what actually works."}
        </p>
        {!isError && (
          <button
            type="button"
            onClick={() => openAsk("What should I test first?")}
            className="mt-4 inline-flex h-10 w-max items-center gap-2 rounded-control border border-app-hairline px-4 text-ui font-semibold hover:bg-app-sunken"
          >
            <MessageCircleQuestion size={16} aria-hidden="true" /> Ask lumen what to test
          </button>
        )}
      </Card>
    );
  }

  const running = data.status === "RUNNING";
  const rate = (k: "A" | "B") =>
    data.metric === "revenue_per_visit"
      ? money(data.variants[k].perVisitCents, data.currency.toUpperCase())
      : pct(data.variants[k].visits ? data.variants[k].conversions / data.variants[k].visits : 0);
  const value = (k: "A" | "B") =>
    data.metric === "revenue_per_visit" ? data.variants[k].perVisitCents : data.variants[k].visits ? data.variants[k].conversions / data.variants[k].visits : 0;
  const max = Math.max(value("A"), value("B"), 1e-9);
  const metricLabel = data.metric === "revenue_per_visit" ? "per visit" : "of visits bought";
  const chance = Math.round(data.chanceBBetter * 100);

  return (
    <Card aria-labelledby="exp-title" className={cn(EXPERIMENT_HEIGHT, "flex flex-col p-5 sm:p-6")}>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="exp-title" className="text-ui font-semibold text-app-muted">
          {running ? "Running test" : "Latest test"} · {data.checkoutName}
        </h2>
        <p className="text-cap text-app-muted">
          {running
            ? `Day ${data.daysRunning} · ${count(data.variants.A.visits + data.variants.B.visits)} shoppers`
            : `Ended ${new Date(data.endedAt!).toLocaleDateString("en-US", { month: "short", day: "numeric" })}`}
        </p>
      </div>
      <p className="mt-2 font-display text-title font-bold">{data.name}</p>
      <p className="mt-1 text-body">{experimentStatusLine(data)}</p>

      <dl className="mt-4 space-y-2">
        {(["A", "B"] as const).map((k) => {
          const won = data.winnerKey === k;
          return (
            <div key={k} className="grid grid-cols-[minmax(6rem,12rem)_1fr_auto] items-center gap-3 text-ui">
              <dt className="truncate">
                <span className="font-semibold">{k}</span> <span className="text-app-muted">{data.variants[k].name}</span>
              </dt>
              <dd aria-hidden="true" className="h-2.5 rounded-r-[4px] bg-app-sunken">
                <span
                  className={cn("block h-2.5 rounded-r-[4px]", k === "B" ? "bg-(--app-chart-ink)" : "bg-(--app-chart-gray)")}
                  style={{ width: `${Math.max(1, (value(k) / max) * 100)}%` }}
                />
              </dd>
              <dd className="text-right">
                <span className="font-semibold">{rate(k)}</span> <span className="text-cap text-app-muted">{metricLabel}</span>
                {won && <span className="ml-1 text-cap font-semibold">· winner</span>}
              </dd>
            </div>
          );
        })}
      </dl>

      {running && (
        <div className="mt-4">
          <div className="flex items-baseline justify-between text-cap text-app-muted">
            <span>Chance B is better</span>
            <span className="font-semibold text-app-fg">{chance}%</span>
          </div>
          <div
            role="meter"
            aria-label="Chance B is better"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={chance}
            aria-valuetext={`${chance} percent; 95 percent is the line for shipping B`}
            className="relative mt-1 h-2 rounded-full bg-app-sunken"
          >
            <div className="h-2 rounded-full bg-(--app-chart-ink)" style={{ width: `${Math.max(1, chance)}%` }} />
            <span aria-hidden="true" className="absolute -top-1 h-4 w-0.5 rounded-full bg-app-muted" style={{ left: "95%" }} />
          </div>
          <p className="mt-1 text-right text-cap text-app-muted" aria-hidden="true">
            95%: ship it
          </p>
        </div>
      )}
      <Link href={`/studio/experiments/${data.id}`} className="mt-auto inline-flex items-center gap-1 pt-3 text-ui font-semibold text-app-muted hover:text-app-fg">
        <FlaskConical size={14} aria-hidden="true" /> {running ? "See the test" : "See the results"} <ArrowRight size={14} aria-hidden="true" />
      </Link>
    </Card>
  );
}

function CardSkeleton({ height, rows }: { height: string; rows: number }) {
  return (
    <Card aria-hidden="true" className={cn(height, "p-5 sm:p-6")}>
      <div className="app-skeleton h-5 w-40" />
      <div className="mt-5 space-y-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="app-skeleton h-4" style={{ width: `${90 - i * 12}%` }} />
        ))}
      </div>
    </Card>
  );
}
