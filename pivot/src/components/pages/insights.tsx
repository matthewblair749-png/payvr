import Link from "next/link";
import { EvidenceView } from "@/components/app/evidence";
import { InsightCard } from "@/components/app/insight-card";
import { NoData } from "@/components/app/no-data";
import { PageHeader } from "@/components/app/shell";
import { EmptyState } from "@/components/ui/empty-state";
import type { Severity } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { getAnalysis } from "@/server/analysis/get";
import type { Workspace } from "@/server/workspace";
import { CheckCircle2 } from "lucide-react";

const FILTERS: { id: string; label: string; severity?: Severity }[] = [
  { id: "all", label: "All" },
  { id: "action", label: "Action needed", severity: "ACTION" },
  { id: "opportunity", label: "Opportunities", severity: "OPPORTUNITY" },
  { id: "watch", label: "Watch", severity: "WATCH" },
];

export async function InsightsPage({ ws, filter = "all" }: { ws: Workspace; filter?: string }) {
  const { analysis: a, hasData, status } = await getAnalysis(ws);
  const header = <PageHeader title="AI Insights" subtitle="PIVOT automatically identifies the important changes in your business." />;
  if (!hasData) {
    return (
      <>
        {header}
        <NoData page="insights" base={ws.basePath} />
      </>
    );
  }
  const f = FILTERS.find((x) => x.id === filter) ?? FILTERS[0];
  const st = (k: string) => status[k] ?? "OPEN";
  const matching = a.insights.filter((i) => !f.severity || i.severity === f.severity);
  const open = matching.filter((i) => st(i.key) === "OPEN");
  const closed = matching.filter((i) => st(i.key) !== "OPEN");
  const countFor = (s?: Severity) => a.insights.filter((i) => (!s || i.severity === s) && st(i.key) === "OPEN").length;
  const card = (i: (typeof a.insights)[number], first = false) => (
    <InsightCard
      key={i.key}
      insight={i}
      base={ws.basePath}
      status={st(i.key)}
      demo={ws.mode === "demo"}
      defaultOpen={first && i.severity === "ACTION"}
      evidence={<EvidenceView evidence={i.evidence} currency={a.company.currency} />}
    />
  );

  return (
    <>
      {header}
      <nav aria-label="Filter insights" className="pv-scroll-x -mx-4 mb-5 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {FILTERS.map((x) => (
          <Link
            key={x.id}
            href={x.id === "all" ? `${ws.basePath}/insights` : `${ws.basePath}/insights?filter=${x.id}`}
            aria-current={x.id === f.id ? "page" : undefined}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-2 rounded-full border px-4 text-sm",
              x.id === f.id ? "border-ink bg-ink font-heavy text-white" : "border-line-strong bg-surface text-ink-2 hover:border-ink/35 hover:text-ink",
            )}
          >
            {x.label}
            <span className={x.id === f.id ? "text-white/70" : "text-muted"}>{countFor(x.severity)}</span>
          </Link>
        ))}
      </nav>
      {open.length ? (
        <div className="space-y-4">{open.map((i, k) => card(i, k === 0))}</div>
      ) : (
        <EmptyState icon={CheckCircle2} title="You're all caught up" description="Nothing in this view needs your attention. PIVOT will flag new changes when your data updates." />
      )}
      {closed.length > 0 && (
        <details className="mt-8">
          <summary className="inline-flex h-9 items-center rounded-full px-1 text-sm text-ink-2 hover:text-ink">Resolved and dismissed ({closed.length})</summary>
          <div className="mt-4 space-y-4">{closed.map((i) => card(i))}</div>
        </details>
      )}
    </>
  );
}
