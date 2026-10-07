import "server-only";
import { cache } from "react";
import { getDemo } from "@/lib/demo";
import { analyze } from "@/lib/engine/analyze";
import type { Analysis, BusinessData } from "@/lib/engine/types";
import type { ItemStatus } from "@/generated/prisma/client";
import { loadBusinessData } from "../data/business-data";
import { db } from "../db";
import type { Workspace } from "../workspace";
import { refreshAnalysis } from "./refresh";

export interface WorkspaceAnalysis {
  data: BusinessData;
  analysis: Analysis;
  hasData: boolean;
  /** Status per item key (insights, opportunities, recommendations). */
  status: Record<string, ItemStatus>;
}

/** The analysis for the current workspace. Deduped per request. */
export const getAnalysis = cache(async (ws: Workspace): Promise<WorkspaceAnalysis> => {
  if (ws.mode === "demo") {
    const { data, analysis } = getDemo();
    return { data, analysis, hasData: true, status: {} };
  }
  const data = await loadBusinessData(ws.company);
  const analysis = analyze(data);
  const companyId = ws.company.id;

  // Safety net: persist rows if a data change happened without a refresh.
  const c = await db.company.findUnique({ where: { id: companyId }, select: { dataVersion: true, analyzedVersion: true } });
  if (c && c.analyzedVersion < c.dataVersion) await refreshAnalysis(companyId).catch((e) => console.error("[pivot] refresh failed", e));

  const [ins, opp, rec] = await Promise.all([
    db.insight.findMany({ where: { companyId }, select: { key: true, status: true } }),
    db.opportunity.findMany({ where: { companyId }, select: { key: true, status: true } }),
    db.recommendation.findMany({ where: { companyId }, select: { key: true, status: true } }),
  ]);
  const status: Record<string, ItemStatus> = {};
  for (const r of [...ins, ...opp, ...rec]) status[r.key] = r.status;
  return { data, analysis, hasData: data.periods.length > 0, status };
});
