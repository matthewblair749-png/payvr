import { NoData } from "@/components/app/no-data";
import { PageHeader } from "@/components/app/shell";
import { WhatIfStudio } from "@/components/app/what-if-studio";
import { SCENARIOS } from "@/lib/engine/simulate";
import type { ScenarioKind, ScenarioResult } from "@/lib/engine/types";
import { getAnalysis } from "@/server/analysis/get";
import { db } from "@/server/db";
import type { SavedScenario } from "@/server/data/scenario-actions";
import type { Workspace } from "@/server/workspace";

export async function WhatIfPage({ ws, kind, value }: { ws: Workspace; kind?: string; value?: string }) {
  const { analysis: a, hasData } = await getAnalysis(ws);
  const header = <PageHeader title="What If?" subtitle="Test a decision before making it." />;
  if (!hasData || !a.baseline) {
    return (
      <>
        {header}
        <NoData page="whatif" base={ws.basePath} />
      </>
    );
  }
  const k: ScenarioKind = kind && kind in SCENARIOS ? (kind as ScenarioKind) : "price";
  const v = Number(value);
  const initial = { kind: k, value: Number.isFinite(v) && value !== undefined ? v : SCENARIOS[k].defaultValue };

  let saved: SavedScenario[] = [];
  if (ws.mode === "app") {
    const rows = await db.scenario.findMany({ where: { companyId: ws.company.id }, orderBy: { createdAt: "desc" }, take: 50 });
    saved = rows.map((r) => ({
      id: r.id,
      name: r.name,
      kind: r.kind as ScenarioKind,
      value: (r.inputs as { value: number }).value,
      result: r.results as unknown as ScenarioResult,
      createdAt: r.createdAt.toISOString(),
    }));
  }
  return (
    <>
      {header}
      <WhatIfStudio
        baseline={a.baseline}
        currency={a.company.currency}
        initial={initial}
        saved={saved}
        mode={ws.mode}
        canSave={ws.entitlements.limits.simulator}
        base={ws.basePath}
      />
    </>
  );
}
