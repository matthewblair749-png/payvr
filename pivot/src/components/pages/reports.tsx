import { ArrowLeft, FileText } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { LineChart } from "@/components/charts/line-chart";
import { SEVERITY } from "@/components/app/labels";
import { NoData } from "@/components/app/no-data";
import { DownloadReport, GenerateReport } from "@/components/app/report-controls";
import { PageHeader } from "@/components/app/shell";
import { StatusLabel } from "@/components/ui/badge";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { Delta } from "@/components/ui/delta";
import { Meter } from "@/components/ui/meter";
import { reportablePeriods, type ReportContent } from "@/lib/engine/report";
import { dateLabel, money, monthLabel, pct, pctDelta } from "@/lib/format";
import { getAnalysis } from "@/server/analysis/get";
import { db } from "@/server/db";
import type { Workspace } from "@/server/workspace";

export async function ReportsPage({ ws }: { ws: Workspace }) {
  const { data, hasData } = await getAnalysis(ws);
  const header = <PageHeader title="Reports" subtitle="A clean monthly business report for your team or board." />;
  if (!hasData) {
    return (
      <>
        {header}
        <NoData page="reports" base={ws.basePath} />
      </>
    );
  }
  const periods = reportablePeriods(data);
  const reports =
    ws.mode === "app"
      ? await db.report.findMany({ where: { companyId: ws.company.id }, orderBy: { createdAt: "desc" }, take: 50, select: { id: true, title: true, period: true, createdAt: true, createdBy: { select: { name: true } } } })
      : [];
  return (
    <>
      {header}
      <Card>
        <CardHeader title="Monthly Business Report" description="Executive summary, revenue and customer performance, biggest changes, risks, opportunities, recommended actions and your PIVOT Score." />
        <CardBody>
          <GenerateReport
            periods={periods}
            demo={ws.mode === "demo"}
            disabledReason={ws.mode === "app" && !ws.entitlements.limits.reports ? "Monthly reports are part of Pro. Upgrade in Settings → Billing." : undefined}
          />
        </CardBody>
      </Card>
      {ws.mode === "app" && (
        <Card className="mt-4">
          <CardHeader title="Generated reports" />
          <CardBody>
            {reports.length ? (
              <ul className="divide-y divide-line">
                {reports.map((r) => (
                  <li key={r.id}>
                    <Link href={`/app/reports/${r.id}`} className="-mx-2 flex items-center gap-3 rounded-xl px-2 py-3 hover:bg-sunken">
                      <FileText size={18} className="shrink-0 text-muted" aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[15px] text-ink">{r.title}</span>
                        <span className="block text-xs text-muted">
                          Generated {dateLabel(r.createdAt)}
                          {r.createdBy ? ` by ${r.createdBy.name}` : ""}
                        </span>
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-[15px] text-muted">No reports yet. Generate your first one above.</p>
            )}
          </CardBody>
        </Card>
      )}
    </>
  );
}

function Section({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <section className="print-avoid border-t border-line py-7">
      <h2 className="flex items-baseline gap-3 text-xl font-heavy tracking-tight text-ink">
        <span className="text-sm text-muted">{String(n).padStart(2, "0")}</span>
        {title}
      </h2>
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** The report as a document. Prints cleanly (app chrome is hidden in print). */
export function ReportView({ content: c, backHref, meta }: { content: ReportContent; backHref: string; meta?: string }) {
  const cur = c.currency;
  return (
    <>
      <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-3">
        <Link href={backHref} className="inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
          <ArrowLeft size={15} aria-hidden="true" /> Reports
        </Link>
        <DownloadReport />
      </div>
      <article className="print-plain rounded-3xl border border-line bg-surface px-5 py-8 shadow-card sm:px-12 sm:py-12">
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="inline-flex items-center gap-2 text-sm font-heavy tracking-[0.04em] text-ink">
              <LogoMark size={22} /> PIVOT
            </p>
            <h1 className="mt-5 text-[2rem] font-heavy leading-tight tracking-tighter text-ink sm:text-[2.5rem]">Monthly Business Report</h1>
            <p className="mt-1 text-lg text-ink-2">
              {c.company} · {monthLabel(c.period)}
            </p>
          </div>
          <div className="rounded-2xl bg-canvas px-5 py-4 text-center">
            <p className="text-xs text-muted">PIVOT Score</p>
            <p className="text-4xl font-heavy tracking-tighter text-accent">{c.score.value}</p>
            <p className="text-xs text-ink-2">{c.score.label}</p>
          </div>
        </header>
        {meta && <p className="mt-4 text-xs text-muted">{meta}</p>}

        <Section n={1} title="Executive summary">
          <p className="text-lg font-heavy leading-snug text-ink">{c.summary.headline}</p>
          <p className="mt-2 text-[15px] leading-relaxed text-ink-2">{c.summary.body}</p>
          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {c.kpis
              .filter((k) => k.key !== "score")
              .map((k) => (
                <div key={k.key} className="rounded-xl bg-canvas p-3">
                  <dt className="text-xs text-muted">{k.label}</dt>
                  <dd className="mt-1 text-xl font-heavy tracking-tight text-ink">{k.display}</dd>
                  {k.changeDisplay && <dd className="mt-0.5 text-xs text-ink-2">{k.changeDisplay} vs prior month</dd>}
                </div>
              ))}
          </dl>
        </Section>

        <Section n={2} title="Revenue performance">
          <ul className="space-y-1.5 text-[15px] leading-relaxed text-ink-2">
            {c.revenue.narrative.map((x) => (
              <li key={x}>{x}</li>
            ))}
          </ul>
          {c.revenue.values.length > 1 && (
            <div className="mt-5">
              <LineChart periods={c.revenue.periods} series={[{ label: "Revenue", values: c.revenue.values, kind: "actual", format: "money" }]} currency={cur} title="Monthly revenue" height={220} />
            </div>
          )}
          {c.revenue.products.length > 0 && (
            <table className="mt-5 w-full text-left text-sm">
              <thead className="text-muted">
                <tr className="border-b border-line">
                  <th scope="col" className="py-2 font-normal">Product</th>
                  <th scope="col" className="py-2 text-right font-normal">Revenue</th>
                  <th scope="col" className="py-2 text-right font-normal">Share</th>
                  <th scope="col" className="py-2 text-right font-normal">vs prior month</th>
                </tr>
              </thead>
              <tbody>
                {c.revenue.products.map((p) => (
                  <tr key={p.name} className="border-b border-line last:border-0">
                    <th scope="row" className="py-2 font-normal text-ink">{p.name}</th>
                    <td className="num-col py-2 text-right text-ink-2">{money(p.revenue, cur)}</td>
                    <td className="num-col py-2 text-right text-ink-2">{pct(p.share, 0)}</td>
                    <td className="num-col py-2 text-right text-ink-2">{p.change !== null ? pctDelta(p.change) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </Section>

        <Section n={3} title="Customer performance">
          <ul className="space-y-1.5 text-[15px] leading-relaxed text-ink-2">
            {c.customers.narrative.length ? c.customers.narrative.map((x) => <li key={x}>{x}</li>) : <li>Customer data isn&apos;t included in this workspace.</li>}
          </ul>
        </Section>

        <Section n={4} title="Biggest changes">
          <ul className="space-y-2">
            {c.changes.map((x) => (
              <li key={x.key} className="flex items-start gap-3 text-[15px]">
                <Delta label={x.direction === "up" ? "Up" : "Down"} direction={x.direction} good={x.good} />
                <span>
                  <span className="font-heavy text-ink">{x.title}.</span> <span className="text-ink-2">{x.detail}</span>
                </span>
              </li>
            ))}
            {!c.changes.length && <li className="text-[15px] text-ink-2">No major changes this month.</li>}
          </ul>
        </Section>

        <Section n={5} title="Biggest risks">
          <ul className="space-y-4">
            {c.risks.map((r) => (
              <li key={r.title}>
                <StatusLabel tone={SEVERITY[r.severity].tone}>{SEVERITY[r.severity].label}</StatusLabel>
                <p className="mt-1 font-heavy text-ink">{r.title}</p>
                <p className="mt-0.5 text-[15px] text-ink-2">
                  {r.what} {r.soWhat}
                </p>
              </li>
            ))}
            {!c.risks.length && <li className="text-[15px] text-ink-2">No risks flagged this month.</li>}
          </ul>
        </Section>

        <Section n={6} title="Opportunities">
          <ul className="space-y-4">
            {c.opportunities.map((o) => (
              <li key={o.title} className="flex gap-4">
                <span className="grid size-11 shrink-0 place-items-center rounded-full border-2 border-ink text-sm font-heavy text-ink">{o.score}</span>
                <span>
                  <span className="block font-heavy text-ink">{o.title}</span>
                  <span className="block text-sm text-muted">
                    Impact {o.impact.toLowerCase()} · about {money(o.annualImpact, cur)} a year
                  </span>
                  <span className="mt-1 block text-[15px] text-ink-2">{o.whyFound}</span>
                </span>
              </li>
            ))}
            {!c.opportunities.length && <li className="text-[15px] text-ink-2">No new opportunities this month.</li>}
          </ul>
        </Section>

        <Section n={7} title="Recommended actions">
          <ol className="space-y-4">
            {c.actions.map((a) => (
              <li key={a.title} className="flex gap-4">
                <span className="grid size-8 shrink-0 place-items-center rounded-full bg-ink text-sm font-heavy text-white">{a.rank}</span>
                <span>
                  <span className="block font-heavy text-ink">{a.title}</span>
                  <span className="block text-sm text-muted">
                    Impact {a.impact.toLowerCase()} · Difficulty {a.difficulty.toLowerCase()} · Risk {a.risk.toLowerCase()} · ~{money(a.annualImpact, cur)}/yr
                  </span>
                  <span className="mt-1 block text-[15px] text-ink-2">{a.reasoning}</span>
                </span>
              </li>
            ))}
          </ol>
        </Section>

        <Section n={8} title="PIVOT Score">
          <p className="text-[15px] text-ink-2">
            Overall business health: <span className="font-heavy text-ink">{c.score.value}/100</span> ({c.score.label.toLowerCase()}).
          </p>
          <ul className="mt-4 grid gap-4 sm:grid-cols-2">
            {c.score.dimensions.map((d) => (
              <li key={d.label}>
                <div className="flex justify-between text-sm">
                  <span className="text-ink">{d.label}</span>
                  <span className="font-heavy text-ink">{d.score}</span>
                </div>
                <Meter value={d.score} className="mt-1.5" />
                <p className="mt-1 text-xs text-muted">{d.reason}</p>
              </li>
            ))}
          </ul>
        </Section>

        <footer className="border-t border-line pt-5 text-xs text-muted">
          {c.summary.source === "ai" ? "Summary written by Claude from PIVOT's analysis." : "Written by PIVOT's analysis engine."} Estimates and projections are not guaranteed outcomes.
        </footer>
      </article>
    </>
  );
}
