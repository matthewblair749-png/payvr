"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { toMetricRows } from "@/lib/data/metrics";
import { northstarCsv, northstarData } from "@/lib/demo/northstar";
import { refreshAnalysis } from "../analysis/refresh";
import { db } from "../db";
import { toActionError, UserError, type ActionResult } from "../errors";
import { LIMITS, rateLimit } from "../rate-limit";
import { requireRole, workspaceForAction } from "../workspace";

const monthDate = (p: string) => new Date(`${p}-01T00:00:00Z`);

/** Load the Northstar sample data into the caller's workspace, so they can try every feature. */
export async function importSampleData(expectedCompanyId: string): Promise<ActionResult> {
  let ok = false;
  try {
    const ws = await workspaceForAction(expectedCompanyId);
    requireRole(ws, ["OWNER", "ADMIN"], "import data");
    rateLimit(`upload:${ws.company.id}`, LIMITS.upload);
    const companyId = ws.company.id;
    const existing = await db.uploadedDataset.findFirst({ where: { companyId, status: "READY" }, select: { dataSource: { select: { kind: true } } } });
    if (existing?.dataSource.kind === "SAMPLE") throw new UserError("Sample data is already in this workspace.");
    if (existing) throw new UserError("This workspace already has your own data, and sample data would mix with it. Explore the demo instead.");

    const data = northstarData();
    const rows = toMetricRows(data);
    const csv = northstarCsv();
    await db.$transaction(async (tx) => {
      const source = await tx.dataSource.upsert({
        where: { companyId_kind: { companyId, kind: "SAMPLE" } },
        create: { companyId, kind: "SAMPLE", name: "Sample data", lastSyncedAt: new Date() },
        update: { lastSyncedAt: new Date() },
      });
      const dataset = await tx.uploadedDataset.create({
        data: {
          companyId,
          dataSourceId: source.id,
          createdById: ws.user.id,
          name: "Northstar Commerce sample",
          fileName: "northstar-sample.csv",
          fileSize: Buffer.byteLength(csv),
          rowCount: data.periods.length,
          columns: [],
          mapping: { sample: true },
          preview: [],
          rawCsv: csv,
          status: "READY",
          periodStart: monthDate(data.periods[0]),
          periodEnd: monthDate(data.periods[data.periods.length - 1]),
        },
      });
      await tx.metric.createMany({
        data: rows.map((r) => ({ companyId, datasetId: dataset.id, period: monthDate(r.period), key: r.key, dimension: r.dimension, value: r.value })),
      });
      await tx.company.update({ where: { id: companyId }, data: { dataVersion: { increment: 1 } } });
    });
    await refreshAnalysis(companyId);
    revalidatePath("/app", "layout");
    ok = true;
  } catch (e) {
    return toActionError(e, "We couldn't import the sample data. Please try again.");
  }
  if (ok) redirect("/app?imported=sample");
  return { ok: true, data: undefined };
}
