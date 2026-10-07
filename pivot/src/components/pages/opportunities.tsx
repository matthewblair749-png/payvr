import { ArrowLeft, SlidersHorizontal } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EvidenceView } from "@/components/app/evidence";
import { impactTone, riskTone } from "@/components/app/labels";
import { NoData } from "@/components/app/no-data";
import { OpportunityCard, simulateHref } from "@/components/app/opportunity-card";
import { PageHeader } from "@/components/app/shell";
import { StatusActions } from "@/components/app/status-actions";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Meter } from "@/components/ui/meter";
import { ScoreRing } from "@/components/ui/score-ring";
import { SCORE_WEIGHTS } from "@/lib/engine/score";
import type { ScoreFactors } from "@/lib/engine/types";
import { money } from "@/lib/format";
import { getAnalysis } from "@/server/analysis/get";
import type { Workspace } from "@/server/workspace";
import { Radar } from "lucide-react";

export async function OpportunitiesPage({ ws }: { ws: Workspace }) {
  const { analysis: a, hasData, status } = await getAnalysis(ws);
  const header = <PageHeader title="Opportunities" subtitle="Growth opportunities PIVOT found in your data, each with a PIVOT Score from 0 to 100." />;
  if (!hasData) {
    return (
      <>
        {header}
        <NoData page="opportunities" base={ws.basePath} />
      </>
    );
  }
  const list = [...a.opportunities].sort((x, y) => Number((status[x.key] ?? "OPEN") !== "OPEN") - Number((status[y.key] ?? "OPEN") !== "OPEN") || y.score - x.score);
  return (
    <>
      {header}
      {list.length ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {list.map((o) => (
            <OpportunityCard key={o.key} o={o} base={ws.basePath} currency={a.company.currency} dimmed={(status[o.key] ?? "OPEN") !== "OPEN"} />
          ))}
        </div>
      ) : (
        <EmptyState icon={Radar} title="No clear opportunities yet" description="PIVOT finds opportunities in product, channel and segment breakdowns. Add them to your data to see more." />
      )}
    </>
  );
}

const FACTORS: { key: keyof ScoreFactors; label: string; help: string; lowerIsBetter?: boolean }[] = [
  { key: "impact", label: "Potential impact", help: "Size of the gain relative to your revenue." },
  { key: "revenue", label: "Revenue opportunity", help: "The dollar amount at stake." },
  { key: "demand", label: "Customer demand", help: "How strongly your data shows customers want this." },
  { key: "market", label: "Market conditions", help: "Your recent growth momentum." },
  { key: "confidence", label: "Confidence", help: "How much data supports the estimate." },
  { key: "cost", label: "Cost efficiency", help: "Higher means cheaper to do relative to the payoff." },
  { key: "risk", label: "Risk", help: "Lower is better. Counts against the score above 35.", lowerIsBetter: true },
  { key: "difficulty", label: "Difficulty", help: "Lower is better. Counts against the score above 50.", lowerIsBetter: true },
];

export async function OpportunityDetailPage({ ws, oppKey }: { ws: Workspace; oppKey: string }) {
  const { analysis: a, status } = await getAnalysis(ws);
  const o = a.opportunities.find((x) => x.key === oppKey);
  if (!o) notFound();
  const cur = a.company.currency;
  return (
    <>
      <Link href={`${ws.basePath}/opportunities`} className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> All opportunities
      </Link>
      <PageHeader
        title={o.title}
        subtitle={o.summary}
        actions={
          <>
            <ButtonLink href={simulateHref(ws.basePath, o)} variant="primary">
              <SlidersHorizontal size={16} aria-hidden="true" /> Simulate
            </ButtonLink>
            <StatusActions kind="opportunity" itemKey={o.key} status={status[o.key] ?? "OPEN"} demo={ws.mode === "demo"} />
          </>
        }
      />
      <div className="grid gap-4 lg:grid-cols-5">
        <Card className="lg:col-span-2">
          <CardBody className="flex flex-col items-center pt-6 text-center sm:pt-8">
            <p className="text-sm text-muted">PIVOT Score</p>
            <ScoreRing score={o.score} size={168} stroke={14} accent label="PIVOT Score" className="mt-4 text-[3.25rem]" />
            <p className="mt-4 text-2xl font-heavy tracking-tight text-ink">
              {o.score} — {o.scoreLabel}
            </p>
            <dl className="mt-6 grid w-full grid-cols-2 gap-3 text-left text-sm">
              {[
                ["Potential impact", <Badge key="i" tone={impactTone(o.impact)}>{o.impact}</Badge>],
                ["Estimated effort", <Badge key="e">{o.effort}</Badge>],
                ["Risk", <Badge key="r" tone={riskTone(o.risk)}>{o.risk}</Badge>],
                ["Confidence", <span key="c" className="font-heavy text-ink">{o.confidence}%</span>],
              ].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-canvas p-3">
                  <dt className="text-muted">{k}</dt>
                  <dd className="mt-1">{v}</dd>
                </div>
              ))}
            </dl>
            <p className="mt-4 text-sm text-muted">
              Estimated value: <span className="font-heavy text-ink">~{money(o.annualImpact, cur)} a year</span> in {o.impactBasis}
            </p>
          </CardBody>
        </Card>
        <Card className="lg:col-span-3">
          <CardHeader title="Score breakdown" description="Eight factors, each scored 0–100 from your data." />
          <CardBody>
            <ul className="space-y-4">
              {FACTORS.map((f) => (
                <li key={f.key}>
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="text-[15px] text-ink">
                      {f.label}
                      {f.lowerIsBetter && <span className="ml-2 text-xs text-muted">lower is better</span>}
                    </span>
                    <span className="num-col text-[15px] font-heavy text-ink">{o.factors[f.key]}</span>
                  </div>
                  <Meter value={o.factors[f.key]} tone={f.lowerIsBetter ? "gray" : "ink"} className="mt-1.5" label={f.label} />
                  <p className="mt-1 text-xs text-muted">{f.help}</p>
                </li>
              ))}
            </ul>
            <details className="mt-6 rounded-xl bg-canvas p-4 text-sm text-ink-2">
              <summary className="font-heavy text-ink">How the PIVOT Score works</summary>
              <p className="mt-2 leading-relaxed">
                Value = {SCORE_WEIGHTS.impact * 100}% impact + {SCORE_WEIGHTS.revenue * 100}% revenue opportunity + {SCORE_WEIGHTS.demand * 100}% demand + {SCORE_WEIGHTS.market * 100}% market conditions +{" "}
                {SCORE_WEIGHTS.confidence * 100}% confidence + {SCORE_WEIGHTS.cost * 100}% cost efficiency. Risk above 35 and difficulty above 50 are then subtracted. 85+ is an excellent opportunity, 70+ strong, 55+ worth exploring.
              </p>
            </details>
          </CardBody>
        </Card>
      </div>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Why PIVOT found it" />
          <CardBody>
            <p className="text-[15px] leading-relaxed text-ink-2">{o.whyFound}</p>
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="How to act on it" />
          <CardBody>
            <ol className="space-y-3">
              {o.plan.map((s, i) => (
                <li key={s} className="flex gap-3 text-[15px] text-ink-2">
                  <span className="grid size-6 shrink-0 place-items-center rounded-full bg-ink text-xs font-heavy text-white">{i + 1}</span>
                  {s}
                </li>
              ))}
            </ol>
          </CardBody>
        </Card>
      </div>
      {(o.evidence.chart || o.evidence.table) && (
        <Card className="mt-4">
          <CardHeader title="The data behind it" />
          <CardBody>
            <EvidenceView evidence={o.evidence} currency={cur} />
          </CardBody>
        </Card>
      )}
    </>
  );
}
