import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ReportView } from "@/components/pages/reports";
import { getDemo } from "@/lib/demo";
import { buildReport, reportablePeriods } from "@/lib/engine/report";

export const metadata: Metadata = { title: "Monthly Business Report" };

export default async function Page({ params }: { params: Promise<{ period: string }> }) {
  const { period } = await params;
  const { data } = getDemo();
  if (!reportablePeriods(data).includes(period)) notFound();
  const { content } = buildReport(data, period);
  return <ReportView content={content} backHref="/demo/reports" meta="Demo report for Northstar Commerce, a sample company." />;
}
