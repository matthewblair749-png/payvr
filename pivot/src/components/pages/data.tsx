import { Download, FileSpreadsheet, Plug } from "lucide-react";
import Link from "next/link";
import { DeleteDataset } from "@/components/app/dataset-row-actions";
import { Dropzone } from "@/components/app/dropzone";
import { ImportSampleButton } from "@/components/app/no-data";
import { PageHeader } from "@/components/app/shell";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card, CardBody, CardHeader } from "@/components/ui/card";
import { getDemo } from "@/lib/demo";
import { dateLabel, int, monthLabel } from "@/lib/format";
import { db } from "@/server/db";
import type { Workspace } from "@/server/workspace";

const ym = (d: Date | null) => (d ? `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` : null);
const COMING = ["Stripe", "Shopify", "QuickBooks", "HubSpot", "Google Sheets", "Snowflake"];

const COLUMNS_HELP = [
  ["Required", "A date or month column, and revenue (or order amounts)."],
  ["Recommended", "Customers, new and churned customers, cost of goods, operating expenses, marketing spend, website visitors."],
  ["Breakdowns", "One product, marketing channel or customer segment column per file, for deeper insights."],
  ["Order-level files", "One row per order with a customer ID also works. PIVOT rolls it up by month."],
];

export async function DataPage({ ws }: { ws: Workspace }) {
  const demo = ws.mode === "demo";
  const datasets = demo
    ? (() => {
        const d = getDemo().data;
        return [
          {
            id: "demo",
            name: "Northstar Commerce sample",
            fileName: "northstar-sample.csv",
            rowCount: d.periods.length,
            status: "READY" as const,
            periodStart: d.periods[0],
            periodEnd: d.periods[d.periods.length - 1],
            createdAt: new Date(),
            kind: "SAMPLE" as const,
            by: "PIVOT",
          },
        ];
      })()
    : (
        await db.uploadedDataset.findMany({
          where: { companyId: ws.company.id },
          orderBy: { createdAt: "desc" },
          select: { id: true, name: true, fileName: true, rowCount: true, status: true, periodStart: true, periodEnd: true, createdAt: true, dataSource: { select: { kind: true } }, createdBy: { select: { name: true } } },
        })
      ).map((d) => ({ ...d, periodStart: ym(d.periodStart), periodEnd: ym(d.periodEnd), kind: d.dataSource.kind, by: d.createdBy?.name ?? "—" }));

  const ready = datasets.filter((d) => d.status === "READY");
  const sources = [
    { name: "CSV uploads", count: ready.filter((d) => d.kind === "CSV_UPLOAD").length },
    { name: "Sample data", count: ready.filter((d) => d.kind === "SAMPLE").length },
  ].filter((s) => s.count > 0);
  const canUpload = !demo && ws.entitlements.limits.uploads && (ws.role === "OWNER" || ws.role === "ADMIN");
  const reason = demo
    ? "Uploads are off in the demo. Create your workspace to analyze your own data."
    : !ws.entitlements.limits.uploads
      ? "Uploading your own data is part of Pro. Upgrade in Settings → Billing."
      : "Only workspace owners and admins can upload data.";

  return (
    <>
      <PageHeader title="Data" subtitle="Bring in your business data. PIVOT analyzes it as soon as it lands." />
      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Dropzone disabled={!canUpload} disabledReason={canUpload ? undefined : reason} />
          <div className="flex flex-wrap gap-2">
            <a href="/sample-data.csv" download className={buttonVariants({ variant: "secondary", size: "sm" })}>
              <Download size={15} aria-hidden="true" /> Download a sample CSV
            </a>
          </div>
        </div>
        <Card>
          <CardHeader title="What PIVOT can read" />
          <CardBody>
            <dl className="space-y-3 text-sm">
              {COLUMNS_HELP.map(([k, v]) => (
                <div key={k}>
                  <dt className="font-heavy text-ink">{k}</dt>
                  <dd className="mt-0.5 leading-relaxed text-ink-2">{v}</dd>
                </div>
              ))}
            </dl>
          </CardBody>
        </Card>
      </div>

      <Card className="mt-4">
        <CardHeader title="Datasets" description="Each upload is checked, previewed and mapped before it's analyzed." />
        <CardBody>
          {datasets.length ? (
            <div className="relative -mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[40rem] text-left text-sm">
                <thead className="text-muted">
                  <tr className="border-b border-line">
                    <th scope="col" className="px-5 pb-3 font-normal sm:px-6">Name</th>
                    <th scope="col" className="pb-3 font-normal">Months</th>
                    <th scope="col" className="pb-3 text-right font-normal">Rows</th>
                    <th scope="col" className="pb-3 pl-6 font-normal">Status</th>
                    <th scope="col" className="pb-3 font-normal">Added</th>
                    <th scope="col" className="pb-3"><span className="sr-only">Actions</span></th>
                  </tr>
                </thead>
                <tbody>
                  {datasets.map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="px-5 py-3.5 sm:px-6">
                        <span className="flex items-center gap-3">
                          <FileSpreadsheet size={18} className="shrink-0 text-muted" aria-hidden="true" />
                          <span className="min-w-0">
                            <span className="block truncate text-ink">{d.name}</span>
                            <span className="block truncate text-xs text-muted">{d.kind === "SAMPLE" ? "Sample data" : d.fileName}</span>
                          </span>
                        </span>
                      </td>
                      <td className="py-3.5 text-ink-2">{d.periodStart && d.periodEnd ? `${monthLabel(d.periodStart, true)} – ${monthLabel(d.periodEnd, true)}` : "—"}</td>
                      <td className="num-col py-3.5 text-right text-ink-2">{int(d.rowCount)}</td>
                      <td className="py-3.5 pl-6">
                        {d.status === "READY" ? <Badge tone="positive" dot>Analyzed</Badge> : d.status === "PENDING_REVIEW" ? <Badge tone="caution" dot>Needs review</Badge> : <Badge tone="negative" dot>Failed</Badge>}
                      </td>
                      <td className="py-3.5 text-ink-2">
                        {dateLabel(d.createdAt)}
                        <span className="block text-xs text-muted">by {d.by}</span>
                      </td>
                      <td className="py-3.5 pr-5 text-right sm:pr-6">
                        {!demo && (
                          <span className="inline-flex items-center gap-1">
                            {d.kind === "CSV_UPLOAD" && (
                              <Link href={`/app/data/review/${d.id}`} className="rounded-full px-3 py-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
                                {d.status === "PENDING_REVIEW" ? "Review" : "Mapping"}
                              </Link>
                            )}
                            <DeleteDataset id={d.id} name={d.name} />
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="flex flex-col items-start gap-3 rounded-xl bg-canvas p-5">
              <p className="text-[15px] text-ink-2">No datasets yet. Upload a CSV above, or start with sample data to see PIVOT at work.</p>
              <ImportSampleButton />
            </div>
          )}
        </CardBody>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader title="Connected data sources" />
          <CardBody>
            {sources.length ? (
              <ul className="space-y-2">
                {sources.map((s) => (
                  <li key={s.name} className="flex items-center justify-between rounded-xl bg-canvas px-4 py-3 text-sm">
                    <span className="text-ink">{s.name}</span>
                    <span className="text-muted">
                      {s.count} dataset{s.count === 1 ? "" : "s"} · <span className="text-positive-text">Connected</span>
                    </span>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-muted">Nothing connected yet. Upload a CSV to get started.</p>
            )}
          </CardBody>
        </Card>
        <Card>
          <CardHeader title="Coming soon" description="Direct connections, so your data stays up to date automatically." />
          <CardBody>
            <ul className="flex flex-wrap gap-2">
              {COMING.map((c) => (
                <li key={c} className="inline-flex items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-sm text-ink-2">
                  <Plug size={13} aria-hidden="true" /> {c}
                </li>
              ))}
            </ul>
          </CardBody>
        </Card>
      </div>
    </>
  );
}
