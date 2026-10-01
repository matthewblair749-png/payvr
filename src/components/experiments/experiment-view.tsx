"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowLeft } from "lucide-react";
import { finishExperimentAction, stopExperimentAction } from "@/app/studio/experiment-actions";
import { VerdictBadge } from "@/app/studio/(home)/experiments/verdict-badge";
import { ChartCard, DataTable, fmtDay } from "@/components/dashboard/charts";
import { Button } from "@/components/ui/button";
import { answerLabel, questionPrompt } from "@/lib/survey/questions";
import { formatMoney } from "@/lib/utils";
import type { ExperimentDetail } from "@/server/dal/experiments";
import { ChanceMeter, CumulativeChart, Legend, RangeBar, SERIES } from "./charts";

const dt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

export function ExperimentView({ data }: { data: ExperimentDetail }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const running = data.status === "RUNNING";
  const isRevenue = data.metric === "revenue_per_visit";
  const money = (c: number) => formatMoney(Math.round(c), data.currency);
  const signedMoney = (c: number) => `${c >= 0 ? "+" : "−"}${formatMoney(Math.abs(Math.round(c)), data.currency)}`;
  const per100 = (x: number) => `${x >= 0 ? "+" : "−"}${Math.abs(x * 100).toFixed(1).replace(/\.0$/, "")}`;
  const chance = isRevenue ? data.revenue.chanceBBetter : data.conversion.chanceBBetter;
  const diff = isRevenue ? data.revenue.diff : data.conversion.diff;

  const days = useMemo(() => {
    const map = new Map<string, { day: string; A: { visits: number; conversions: number }; B: { visits: number; conversions: number } }>();
    for (const d of data.daily) {
      const row = map.get(d.day) ?? { day: d.day, A: { visits: 0, conversions: 0 }, B: { visits: 0, conversions: 0 } };
      row[d.key as "A" | "B"] = { visits: d.visits, conversions: d.conversions };
      map.set(d.day, row);
    }
    return [...map.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [data.daily]);

  const survey = useMemo(() => {
    const byQ = new Map<string, { answer: string; A: number; B: number }[]>();
    for (const s of data.survey) {
      const rows = byQ.get(s.question) ?? [];
      let row = rows.find((r) => r.answer === s.answer);
      if (!row) rows.push((row = { answer: s.answer, A: 0, B: 0 }));
      row[s.key as "A" | "B"] += s.count;
      byQ.set(s.question, rows);
    }
    return [...byQ.entries()].map(([q, rows]) => {
      const totA = rows.reduce((s, r) => s + r.A, 0);
      const totB = rows.reduce((s, r) => s + r.B, 0);
      return { q, totA, totB, rows: rows.sort((a, b) => b.A + b.B - (a.A + a.B)) };
    });
  }, [data.survey]);

  function act(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong");
      else router.refresh();
    });
  }

  const v = data.variants;
  const rate = (k: "A" | "B") => (v[k].visits ? v[k].conversions / v[k].visits : 0);

  return (
    <>
      <Link href="/studio/experiments" className="inline-flex items-center gap-1.5 text-sm font-semibold text-muted-strong hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> All experiments
      </Link>
      <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <p className="text-sm font-semibold uppercase tracking-wider text-muted-strong">
            <Link href={`/studio/pages/${data.checkout.id}`} className="hover:underline">
              {data.checkout.name}
            </Link>{" "}
            · {isRevenue ? "Price / revenue test" : "Conversion test"}
          </p>
          <h1 className="mt-1 font-display text-figure font-bold tracking-[-0.03em]">{data.name}</h1>
          {data.hypothesis && <p className="mt-3 text-lg text-muted-strong">{data.hypothesis}</p>}
          <p className="mt-2 text-sm text-muted-strong">
            {dt.format(new Date(data.startedAt))} – {data.endedAt ? dt.format(new Date(data.endedAt)) : "now"} · {Math.floor(data.daysRunning)} days ·{" "}
            {(v.A.visits + v.B.visits).toLocaleString()} visits
          </p>
        </div>
        <VerdictBadge status={data.verdict.status} winnerKey={data.winnerKey} ended={!running} stopped={data.status === "STOPPED"} />
      </div>

      {data.splitBroken && (
        <div role="alert" className="mt-6 flex gap-3 rounded-2xl bg-[#FFF3C4] p-4 text-sm">
          <AlertTriangle size={18} aria-hidden="true" className="mt-0.5 shrink-0" />
          <p>
            <span className="font-semibold">Traffic isn&apos;t splitting the way it should</span> ({v.A.visits.toLocaleString()} vs {v.B.visits.toLocaleString()} visits for a{" "}
            {v.A.weight}/{v.B.weight} split). Something like caching or a redirect may be sending people to one version. Treat these results with care.
          </p>
        </div>
      )}

      {/* The answer first */}
      <section aria-labelledby="verdict" className="mt-6 grid gap-6 rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-black/5 lg:grid-cols-[1.2fr_1fr] lg:p-8">
        <div>
          <h2 id="verdict" className="font-display text-3xl font-bold tracking-[-0.04em]">
            {data.verdict.headline}
          </h2>
          <p className="mt-2 text-lg leading-relaxed">{data.verdict.detail}</p>
          {running && (
            <div className="mt-6 flex flex-wrap items-center gap-3">
              <Button
                variant={data.verdict.shipB ? "primary" : "outline"}
                disabled={pending}
                onClick={() => {
                  if (confirm("Ship B to everyone? B's design (and price, for price tests) becomes your published checkout. Any unpublished edits to the original's draft will be replaced.")) {
                    act(() => finishExperimentAction({ experimentId: data.id, winner: "B" }));
                  }
                }}
              >
                Ship B to everyone
              </Button>
              <Button
                variant={data.verdict.status === "a_better" ? "ink" : "outline"}
                disabled={pending}
                onClick={() => act(() => finishExperimentAction({ experimentId: data.id, winner: "A" }))}
              >
                Keep the original
              </Button>
              <Button
                variant="ghost"
                disabled={pending}
                onClick={() => {
                  if (confirm("Stop the test without picking a winner? Everyone will see the original.")) {
                    act(() => stopExperimentAction({ experimentId: data.id }));
                  }
                }}
              >
                Stop test
              </Button>
            </div>
          )}
          {!running && (
            <p className="mt-4 text-sm font-semibold">
              {data.status === "STOPPED" ? "This test was stopped." : data.winnerKey === "B" ? "B was shipped to everyone." : "You kept the original."}
            </p>
          )}
          {error && (
            <p role="alert" className="mt-3 text-sm font-medium text-orange-deep">
              {error}
            </p>
          )}
        </div>
        <div className="space-y-6">
          <ChanceMeter chance={chance} label={isRevenue ? "Chance B earns more per visitor" : "Chance B beats your original"} />
          <RangeBar
            low={diff.low}
            mid={diff.mid}
            high={diff.high}
            format={isRevenue ? signedMoney : per100}
            unit={isRevenue ? "per visitor" : "sales per 100 visitors"}
          />
        </div>
      </section>

      {/* A vs B */}
      <section aria-label="Versions" className="mt-6 grid gap-5 lg:grid-cols-2">
        {(["A", "B"] as const).map((k) => (
          <div key={k} className="rounded-[24px] bg-white p-6 shadow-soft ring-1 ring-black/5">
            <div className="flex items-center gap-2">
              <span aria-hidden="true" className="h-3 w-3 rounded-full" style={{ background: SERIES[k] }} />
              <h3 className="font-display text-xl font-bold tracking-[-0.03em]">
                {k} · {v[k].name}
              </h3>
              {data.winnerKey === k && <span className="rounded-full bg-spark px-2 py-0.5 text-xs font-bold">Winner</span>}
            </div>
            <dl className="mt-4 grid grid-cols-3 gap-3">
              <div>
                <dt className="text-xs text-muted-strong">Visits</dt>
                <dd className="text-2xl font-semibold">{v[k].visits.toLocaleString()}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-strong">Conversion</dt>
                <dd className="text-2xl font-semibold">{(rate(k) * 100).toFixed(1)}%</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-strong">Revenue / visit</dt>
                <dd className="text-2xl font-semibold">{v[k].visits ? money(v[k].sumCents / v[k].visits) : "–"}</dd>
              </div>
            </dl>
            <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-muted-strong">{k === "A" ? "Your published checkout" : "What B changes"}</p>
            {k === "A" ? (
              <p className="mt-1 text-sm text-muted-strong">
                The checkout as it was when the test started{v.A.priceCents != null ? `, at ${money(v.A.priceCents)}` : ""}.
              </p>
            ) : (
              <ul className="mt-1 list-disc space-y-0.5 pl-5 text-sm">
                {data.changes.map((c) => (
                  <li key={c}>{c}</li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </section>

      <div className="mt-6">
        <ChartCard
          title="Conversion so far"
          subtitle="Running total for each version. Lines usually wobble early and settle as visits add up."
          action={<Legend names={{ A: v.A.name, B: v.B.name }} />}
          table={
            <DataTable
              caption="Daily visits and sales per version"
              head={["Day", "A visits", "A sales", "B visits", "B sales"]}
              rows={days.map((d) => [fmtDay(d.day), d.A.visits, d.A.conversions, d.B.visits, d.B.conversions])}
            />
          }
        >
          <CumulativeChart days={days} />
        </ChartCard>
      </div>

      {survey.length > 0 && (
        <div className="mt-6 grid gap-5 lg:grid-cols-2">
          {survey.map((s) => (
            <ChartCard key={s.q} title={questionPrompt(s.q)} subtitle={`What buyers in each version told you (${s.totA} in A, ${s.totB} in B)`} action={<Legend names={{ A: "", B: "" }} />}>
              <ul className="space-y-3">
                {s.rows.map((r) => (
                  <li key={r.answer}>
                    <p className="mb-1 text-sm font-medium">{answerLabel(s.q, r.answer)}</p>
                    {(["A", "B"] as const).map((k) => {
                      const share = (k === "A" ? r.A / Math.max(1, s.totA) : r.B / Math.max(1, s.totB)) * 100;
                      return (
                        <div key={k} className="flex items-center gap-2 text-xs">
                          <span className="w-3 font-semibold">{k}</span>
                          <div className="h-2.5 flex-1 rounded-full bg-surface/70" aria-hidden="true">
                            <div className="h-2.5 rounded-full" style={{ width: `${Math.max(0.5, share)}%`, background: SERIES[k] }} />
                          </div>
                          <span className="w-10 text-right tabular-nums">{share.toFixed(0)}%</span>
                        </div>
                      );
                    })}
                  </li>
                ))}
              </ul>
            </ChartCard>
          ))}
        </div>
      )}
    </>
  );
}
