import { CheckCircle2 } from "lucide-react";
import { NoData } from "@/components/app/no-data";
import { RecommendationCard } from "@/components/app/recommendation-card";
import { PageHeader } from "@/components/app/shell";
import { EmptyState } from "@/components/ui/empty-state";
import { getAnalysis } from "@/server/analysis/get";
import type { Workspace } from "@/server/workspace";

export async function RecommendationsPage({ ws }: { ws: Workspace }) {
  const { analysis: a, hasData, status } = await getAnalysis(ws);
  const header = <PageHeader title="Recommended next moves" subtitle="PIVOT ranks strategic actions by expected value, discounted for difficulty and risk." />;
  if (!hasData) {
    return (
      <>
        {header}
        <NoData page="recommendations" base={ws.basePath} />
      </>
    );
  }
  const st = (k: string) => status[k] ?? "OPEN";
  const open = a.recommendations.filter((r) => st(r.key) === "OPEN");
  const closed = a.recommendations.filter((r) => st(r.key) !== "OPEN");
  const card = (r: (typeof a.recommendations)[number], first = false) => (
    <RecommendationCard key={r.key} r={r} base={ws.basePath} currency={a.company.currency} status={st(r.key)} demo={ws.mode === "demo"} defaultOpen={first} />
  );
  return (
    <>
      {header}
      {open.length ? (
        <div className="space-y-4">{open.map((r, i) => card(r, i === 0))}</div>
      ) : (
        <EmptyState icon={CheckCircle2} title="No open recommendations" description="You've acted on everything PIVOT suggested. New moves appear when your data changes." />
      )}
      {closed.length > 0 && (
        <details className="mt-8">
          <summary className="inline-flex h-9 items-center rounded-full px-1 text-sm text-ink-2 hover:text-ink">Done and dismissed ({closed.length})</summary>
          <div className="mt-4 space-y-4">{closed.map((r) => card(r))}</div>
        </details>
      )}
      <p className="mt-8 text-sm text-muted">Recommendations are ranked from your data. They&apos;re options to consider, not instructions: you decide the next move.</p>
    </>
  );
}
