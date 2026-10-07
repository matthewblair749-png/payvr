import "server-only";
import { cache } from "react";
import { fromMetricRows } from "@/lib/data/metrics";
import type { BusinessData } from "@/lib/engine/types";
import { db } from "../db";
import type { WorkspaceCompany } from "../workspace";

const ym = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;

/** All metrics from the company's ready datasets, as engine input. Deduped per request. */
export const loadBusinessData = cache(async (company: WorkspaceCompany): Promise<BusinessData> => {
  const rows = await db.metric.findMany({
    where: { companyId: company.id, dataset: { status: "READY" } },
    select: { period: true, key: true, dimension: true, value: true },
    // Oldest dataset first, so newer uploads overwrite overlapping months.
    orderBy: [{ dataset: { createdAt: "asc" } }],
  });
  return fromMetricRows(
    rows.map((r) => ({ period: ym(r.period), key: r.key, dimension: r.dimension, value: r.value })),
    { name: company.name, currency: company.currency, industry: company.industry, marketSharePct: company.marketSharePct },
  );
});
