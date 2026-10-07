import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ReviewForm } from "@/components/app/review-form";
import { PageHeader } from "@/components/app/shell";
import type { DatasetMeta, Target } from "@/lib/csv/detect";
import { int } from "@/lib/format";
import { db } from "@/server/db";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Review upload" };

export default async function ReviewPage({ params }: { params: Promise<{ id: string }> }) {
  const ws = await requireWorkspace();
  const { id } = await params;
  const ds = id.length <= 40 ? await db.uploadedDataset.findFirst({ where: { id, companyId: ws.company.id, dataSource: { kind: "CSV_UPLOAD" } } }) : null;
  if (!ds) notFound();
  const meta = ds.columns as unknown as DatasetMeta;
  const sample = await db.uploadedDataset.count({ where: { companyId: ws.company.id, dataSource: { kind: "SAMPLE" } } });
  return (
    <>
      <Link href="/app/data" className="mb-4 inline-flex items-center gap-1.5 text-sm text-ink-2 hover:text-ink">
        <ArrowLeft size={15} aria-hidden="true" /> Data
      </Link>
      <PageHeader title={ds.status === "READY" ? "Column mapping" : "Review your upload"} subtitle={`${ds.fileName} · ${int(ds.rowCount)} rows · ${meta.columns.length} columns`} />
      <ReviewForm
        id={ds.id}
        columns={meta.columns}
        preview={ds.preview as { header: string[]; rows: string[][] }}
        initial={(ds.mapping ?? {}) as Record<string, Target>}
        detectedFormat={{
          dayFirst: meta.format?.dayFirst ?? meta.dayFirst ?? false,
          decimalComma: meta.format?.decimalComma ?? false,
          dateOrderUnclear: meta.format?.dateOrderUnclear ?? false,
          decimalCommaPossible: meta.format?.decimalCommaPossible ?? false,
        }}
        ready={ds.status === "READY"}
        replacesSample={sample > 0}
      />
    </>
  );
}
