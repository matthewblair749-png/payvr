import { LineChart } from "@/components/charts/line-chart";
import type { Evidence } from "@/lib/engine/types";
import { cn } from "@/lib/utils";

/** The data behind an insight or opportunity: a trend and/or a breakdown table. */
export function EvidenceView({ evidence, currency }: { evidence: Evidence; currency: string }) {
  if (!evidence.chart && !evidence.table) return <p className="text-sm text-muted">No breakdown available for this one.</p>;
  return (
    <div className={cn("grid gap-6", evidence.chart && evidence.table && "lg:grid-cols-2")}>
      {evidence.chart && (
        <div className="min-w-0">
          <p className="mb-3 text-sm font-heavy text-ink">{evidence.chart.title}</p>
          <LineChart periods={evidence.chart.periods} series={evidence.chart.series} height={200} currency={currency} title={evidence.chart.title} />
        </div>
      )}
      {evidence.table && (
        <div className="min-w-0">
          <p className="mb-3 text-sm font-heavy text-ink">{evidence.table.title}</p>
          <div className="relative overflow-x-auto rounded-xl border border-line" tabIndex={0} role="region" aria-label={evidence.table.title}>
            <table className="w-full min-w-[22rem] text-left text-sm">
              <thead className="bg-canvas text-muted">
                <tr>
                  {evidence.table.columns.map((c, i) => (
                    <th key={c} scope="col" className={cn("px-3.5 py-2.5 font-normal", i > 0 && "text-right")}>
                      {c}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {evidence.table.rows.map((r, ri) => (
                  <tr key={ri} className={cn("border-t border-line", ri === evidence.table!.highlightRow && "bg-caution-soft/60")}>
                    {r.map((cell, ci) =>
                      ci === 0 ? (
                        <th key={ci} scope="row" className="px-3.5 py-2.5 text-left font-normal text-ink">
                          {cell}
                          {ri === evidence.table!.highlightRow && <span className="ml-2 text-[11px] font-heavy uppercase tracking-wide text-caution-text">Driver</span>}
                        </th>
                      ) : (
                        <td key={ci} className="num-col px-3.5 py-2.5 text-right text-ink-2">
                          {cell}
                        </td>
                      ),
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
