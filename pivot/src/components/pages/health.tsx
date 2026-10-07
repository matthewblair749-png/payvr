import { ArrowDownRight, ArrowRight, ArrowUpRight, Minus } from "lucide-react";
import { LineChart } from "@/components/charts/line-chart";
import { NoData } from "@/components/app/no-data";
import { PageHeader } from "@/components/app/shell";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ScoreRing } from "@/components/ui/score-ring";
import type { ChartSeries } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { getAnalysis } from "@/server/analysis/get";
import type { Workspace } from "@/server/workspace";

function last12(periods: string[], s: (number | null)[] | undefined) {
  return s ? s.slice(Math.max(0, periods.length - 12)) : [];
}

export async function HealthPage({ ws }: { ws: Workspace }) {
  const { analysis: a, data, hasData } = await getAnalysis(ws);
  const header = <PageHeader title="Business Health" subtitle={`How healthy ${ws.company.name} is right now, across six areas.`} />;
  if (!hasData || !a.health.dimensions.length) {
    return (
      <>
        {header}
        <NoData page="health" base={ws.basePath} />
      </>
    );
  }
  const h = a.health;
  const weakest = [...h.dimensions].sort((x, y) => x.score - y.score)[0];
  const periods = data.periods.slice(Math.max(0, data.periods.indexOf(a.period) - 11), data.periods.indexOf(a.period) + 1);
  const end = data.periods.indexOf(a.period) + 1;
  const m = data.metrics;
  const slice = (s: (number | null)[] | undefined) => (s ? last12(data.periods.slice(0, end), s.slice(0, end)) : []);
  const profit = (() => {
    if (m.profit) return slice(m.profit);
    if (!m.revenue || (!m.cogs && !m.opex)) return [];
    return slice(m.revenue.map((r, i) => (r === null ? null : r - (m.cogs?.[i] ?? 0) - (m.opex?.[i] ?? 0) - (m.marketingSpend?.[i] ?? 0))));
  })();
  const retention = (() => {
    if (m.retention) return slice(m.retention);
    if (!m.customers || !m.churnedCustomers) return [];
    return slice(m.customers.map((_, i) => (i === 0 || !m.customers![i - 1] || m.churnedCustomers![i] === null ? null : 1 - (m.churnedCustomers![i] as number) / (m.customers![i - 1] as number))));
  })();
  const charts: { title: string; series: ChartSeries[] }[] = [];
  if (m.revenue)
    charts.push({
      title: "Revenue and profit",
      series: [
        { label: "Revenue", values: slice(m.revenue), kind: "actual", format: "money" },
        ...(profit.length ? [{ label: "Profit", values: profit, kind: "baseline" as const, format: "money" as const }] : []),
      ],
    });
  if (m.customers) charts.push({ title: "Active customers", series: [{ label: "Customers", values: slice(m.customers), kind: "actual", format: "count" }] });
  if (retention.some((v) => v !== null)) charts.push({ title: "Retention", series: [{ label: "Retention", values: retention, kind: "actual", format: "percent" }] });

  return (
    <>
      {header}
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardBody className="flex flex-col items-center pt-6 text-center sm:pt-8">
            <p className="text-sm text-muted">Overall Health Score</p>
            <ScoreRing score={h.score} size={176} stroke={14} accent label="Overall Health Score" className="mt-4 text-[3.25rem]" />
            <p className="mt-4 text-2xl font-heavy tracking-tight text-ink">{h.label}</p>
            <p className="mt-2 max-w-xs text-[15px] text-ink-2">
              {weakest.label} is the area holding the score back: {weakest.reason.charAt(0).toLowerCase() + weakest.reason.slice(1)}
            </p>
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="What's changing?" description="The biggest moves this month." />
          <CardBody>
            <ul className="space-y-3">
              {a.changes.map((c) => {
                const Icon = c.direction === "up" ? ArrowUpRight : ArrowDownRight;
                return (
                  <li key={c.key} className="flex gap-4 rounded-2xl bg-canvas p-4">
                    <span className={cn("grid size-10 shrink-0 place-items-center rounded-xl", c.good ? "bg-positive-soft text-positive-text" : "bg-negative-soft text-negative-text")}>
                      <Icon size={20} strokeWidth={2.5} aria-hidden="true" />
                    </span>
                    <span>
                      <span className="block text-[17px] font-heavy tracking-tight text-ink">&ldquo;{c.title}&rdquo;</span>
                      <span className="mt-0.5 block text-[15px] text-ink-2">{c.detail}</span>
                    </span>
                  </li>
                );
              })}
              {!a.changes.length && <li className="text-[15px] text-muted">No big changes this month.</li>}
            </ul>
          </CardBody>
        </Card>
      </div>

      <section aria-label="Health by area" className="stagger mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {h.dimensions.map((d) => {
          const tone = d.score < 60 ? "negative" : d.score < 75 ? "caution" : "ink";
          const Trend = d.trend === "up" ? ArrowUpRight : d.trend === "down" ? ArrowDownRight : Minus;
          return (
            <div key={d.key} className="rounded-2xl border border-line bg-surface p-5 shadow-card">
              <div className="flex items-center justify-between">
                <p className="text-[15px] font-heavy text-ink">{d.label}</p>
                <span className="inline-flex items-center gap-1 text-xs text-muted">
                  <Trend size={14} aria-hidden="true" /> {d.trend === "up" ? "Improving" : d.trend === "down" ? "Slipping" : "Steady"}
                </span>
              </div>
              <p className="mt-3 text-[2.25rem] font-heavy leading-none tracking-tighter text-ink">
                {d.score}
                <span className="ml-1 text-base font-normal text-muted">/100</span>
              </p>
              <Meter value={d.score} tone={tone} className="mt-4" label={`${d.label} score`} />
              <p className="mt-3 text-sm leading-relaxed text-ink-2">{d.reason}</p>
            </div>
          );
        })}
      </section>

      {h.missing.length > 0 && (
        <Card className="mt-4">
          <CardHeader title="Unlock the rest of your score" description="PIVOT scores an area once your data includes what it needs." />
          <CardBody>
            <ul className="grid gap-2 sm:grid-cols-2">
              {h.missing.map((x) => (
                <li key={x.label} className="flex items-center gap-2 text-[15px] text-ink-2">
                  <ArrowRight size={15} className="text-muted" aria-hidden="true" />
                  <span>
                    <span className="font-heavy text-ink">{x.label}:</span> add {x.needs}
                  </span>
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {charts.map((c, i) => (
          <Card key={c.title} className={cn(i === 0 && charts.length % 2 === 1 && "lg:col-span-2")}>
            <CardHeader title={c.title} description="Last 12 months" />
            <CardBody>
              <LineChart periods={periods} series={c.series} currency={a.company.currency} title={c.title} height={220} />
            </CardBody>
          </Card>
        ))}
      </div>
    </>
  );
}
