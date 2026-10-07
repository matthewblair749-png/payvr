import { ArrowRight, Sparkles } from "lucide-react";
import Link from "next/link";
import { LockedInsight } from "@/components/app/insight-card";
import { LineChart } from "@/components/charts/line-chart";
import { Sparkline } from "@/components/charts/sparkline";
import { FourAnswers } from "@/components/app/explain";
import { KpiCard } from "@/components/app/kpi-card";
import { greeting, SEVERITY, shortName } from "@/components/app/labels";
import { NoData } from "@/components/app/no-data";
import { OpportunityCard } from "@/components/app/opportunity-card";
import { PageHeader } from "@/components/app/shell";
import { StatusLabel } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { FormMessage } from "@/components/ui/field";
import { ScoreRing } from "@/components/ui/score-ring";
import { money, monthLabel } from "@/lib/format";
import { getSummary } from "@/server/ai";
import { getAnalysis } from "@/server/analysis/get";
import type { Workspace } from "@/server/workspace";

export async function OverviewPage({ ws, notice }: { ws: Workspace; notice?: string }) {
  const { analysis: a, data, hasData, status } = await getAnalysis(ws);
  const base = ws.basePath;
  const hello = `${greeting(ws.company.timezone)}, ${shortName(ws.company.name)}.`;

  if (!hasData) {
    return (
      <>
        <PageHeader title={hello} subtitle="Let's get your business data into PIVOT." />
        {notice === "welcome" && (
          <div className="mb-6">
            <FormMessage tone="success">Your workspace is ready, and your 14-day Pro trial has started.</FormMessage>
          </div>
        )}
        <NoData page="overview" base={base} />
      </>
    );
  }

  const summary = await getSummary(ws, a, data);
  const cur = a.company.currency;
  const open = (k: string) => status[k] !== "DONE" && status[k] !== "DISMISSED";
  const insights = a.insights.filter((i) => open(i.key)).slice(0, 3);
  const recs = a.recommendations.filter((r) => open(r.key));
  const top = recs[0];
  const scoreKpi = a.kpis.find((k) => k.key === "score");

  return (
    <>
      <PageHeader
        eyebrow={
          <>
            {monthLabel(a.period)}
            {a.previousPeriod && <span> · compared with {monthLabel(a.previousPeriod).split(" ")[0]}</span>}
          </>
        }
        title={hello}
        subtitle="Here's what changed in your business."
      />
      {notice === "sample" && (
        <div className="mb-6">
          <FormMessage tone="success">Sample data imported. Everything below was computed from it, just as it will be from yours.</FormMessage>
        </div>
      )}

      <section aria-label="Key numbers" className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        {a.kpis
          .filter((k) => k.key !== "score")
          .map((k) => (
            <KpiCard key={k.key} kpi={k} spark={k.spark.length > 1 ? <Sparkline values={k.spark} width={160} height={30} className="w-full" /> : undefined} />
          ))}
        {scoreKpi && (
          <KpiCard
            kpi={scoreKpi}
            className="col-span-2 sm:col-span-1"
            ring={
              <>
                <ScoreRing score={a.health.score} size={76} stroke={8} accent label="AI PIVOT Score" showMax={false} className="text-[1.625rem]" />
                <div>
                  <p className="text-lg font-heavy text-ink">{a.health.label}</p>
                  <Link href={`${base}/health`} className="text-sm text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
                    Business Health
                  </Link>
                </div>
              </>
            }
          />
        )}
      </section>

      <Card className="mt-4">
        <CardBody className="pt-5 sm:pt-6">
          <p className="inline-flex items-center gap-1.5 text-[12px] font-heavy uppercase tracking-[0.08em] text-muted">
            <Sparkles size={13} aria-hidden="true" /> PIVOT&apos;s read
          </p>
          <p className="mt-2 text-xl font-heavy leading-snug tracking-tight text-ink sm:text-[1.375rem]">{summary.headline}</p>
          <p className="mt-2 max-w-3xl text-[15px] leading-relaxed text-ink-2">{summary.body}</p>
          <p className="mt-3 text-xs text-muted">{summary.source === "ai" ? "Written by Claude from your numbers." : "Written by PIVOT's analysis engine from your numbers."}</p>
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <CardHeader
            title="What changed"
            description="The changes that matter most this month."
            action={
              <Link href={`${base}/insights`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
                All insights <ArrowRight size={14} aria-hidden="true" />
              </Link>
            }
          />
          <CardBody>
            {insights.length ? (
              <ul className="divide-y divide-line">
                {insights.map((i) => (
                  <li key={i.key} className="py-4 first:pt-0 last:pb-0">
                    <StatusLabel tone={SEVERITY[i.severity].tone}>{SEVERITY[i.severity].label}</StatusLabel>
                    <p className="mt-1.5 text-[17px] font-heavy tracking-tight text-ink">{i.title}</p>
                    {i.locked ? (
                      <LockedInsight insight={i} base={base} compact />
                    ) : (
                      <>
                        <p className="mt-1 text-[15px] leading-relaxed text-ink-2">{i.what}</p>
                        <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">
                          <span className="font-heavy text-ink">Now what: </span>
                          {i.nowWhat}
                        </p>
                      </>
                    )}
                    <Link
                      href={i.related.opportunity && i.actionLabel === "Explore opportunity" ? `${base}/opportunities/${i.related.opportunity}` : `${base}/insights#${i.key}`}
                      className="mt-2 inline-flex items-center gap-1 text-sm font-heavy text-ink hover:underline"
                    >
                      {i.actionLabel} <ArrowRight size={14} aria-hidden="true" />
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-muted">Nothing needs your attention right now.</p>
            )}
          </CardBody>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader title="Your next move" description="Ranked by impact, difficulty and risk." />
          <CardBody>
            {top ? (
              <>
                <div className="rounded-2xl border border-ink p-5">
                  <p className="text-xs text-muted">#1 recommended move</p>
                  <p className="mt-1 text-xl font-heavy leading-snug tracking-tight text-ink">{top.title}</p>
                  <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{top.reasoning}</p>
                  <p className="mt-3 text-sm text-muted">
                    Impact <span className="text-ink">{top.impact.toLowerCase()}</span> · Difficulty <span className="text-ink">{top.difficulty.toLowerCase()}</span> · Risk{" "}
                    <span className="text-ink">{top.risk.toLowerCase()}</span> · ~{money(top.annualImpact, cur)}/yr
                  </p>
                  <ButtonLink href={`${base}/recommendations#${top.key}`} variant="primary" size="sm" className="mt-4">
                    Explore <ArrowRight size={15} aria-hidden="true" />
                  </ButtonLink>
                </div>
                <ol className="mt-4 space-y-1">
                  {recs.slice(1, 3).map((r) => (
                    <li key={r.key}>
                      <Link href={`${base}/recommendations#${r.key}`} className="flex items-center gap-3 rounded-xl px-2 py-2.5 hover:bg-sunken">
                        <span className="grid size-7 shrink-0 place-items-center rounded-full bg-sunken text-xs font-heavy text-ink">{r.rank}</span>
                        <span className="min-w-0 flex-1 truncate text-[15px] text-ink">{r.title}</span>
                        <span className="shrink-0 text-xs text-muted">{r.impact}</span>
                      </Link>
                    </li>
                  ))}
                </ol>
              </>
            ) : (
              <p className="text-[15px] text-muted">No open recommendations. Nice work.</p>
            )}
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Revenue" description="Last 12 months, with a 3-month trend forecast (dashed)." />
        <CardBody>
          <LineChart periods={a.revenueChart.periods} series={a.revenueChart.series} currency={cur} title="Monthly revenue with forecast" height={280} />
        </CardBody>
      </Card>

      {a.opportunities.length > 0 && (
        <section className="mt-8" aria-labelledby="top-opps">
          <div className="mb-4 flex items-end justify-between gap-4">
            <h2 id="top-opps" className="text-xl font-heavy tracking-tight text-ink">
              Top opportunities
            </h2>
            <Link href={`${base}/opportunities`} className="inline-flex items-center gap-1 text-sm text-ink-2 hover:text-ink">
              All opportunities <ArrowRight size={14} aria-hidden="true" />
            </Link>
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {a.opportunities.slice(0, 2).map((o) => (
              <OpportunityCard key={o.key} o={o} base={base} currency={cur} compact />
            ))}
          </div>
        </section>
      )}

      {a.kpis[0] && (
        <Card className="mt-8">
          <CardHeader title={`Why revenue moved: ${a.kpis[0].changeDisplay ?? a.kpis[0].display}`} description="Every number in PIVOT answers four questions." />
          <CardBody>
            <FourAnswers e={a.kpis[0].explain} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
