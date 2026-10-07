import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/pages/reports";
import type { ReportContent } from "@/lib/engine/report";
import { dateLabel } from "@/lib/format";
import { db } from "@/server/db";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Monthly Business Report" };

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const ws = await requireWorkspace();
  const { id } = await params;
  const report = id.length <= 40 ? await db.report.findFirst({ where: { id, companyId: ws.company.id }, select: { content: true, createdAt: true, createdBy: { select: { name: true } } } }) : null;
  if (!report) notFound();
  return (
    <ReportView
      content={report.content as unknown as ReportContent}
      backHref="/app/reports"
      meta={`Generated ${dateLabel(report.createdAt)}${report.createdBy ? ` by ${report.createdBy.name}` : ""}.`}
    />
  );
}
