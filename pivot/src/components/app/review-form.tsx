"use client";

import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/field";
import type { ImportSummary } from "@/lib/csv/aggregate";
import { TARGETS, type DetectedColumn, type Target } from "@/lib/csv/detect";
import { monthLabel } from "@/lib/format";
import { cn } from "@/lib/utils";
import { confirmImport, deleteDataset, previewImport } from "@/server/data/upload-actions";

const TYPE_LABEL: Record<DetectedColumn["type"], string> = { date: "Dates", number: "Numbers", percent: "Percentages", category: "Categories", id: "IDs", text: "Text", empty: "Empty" };

export function ReviewForm({ id, columns, preview, initial, ready }: { id: string; columns: DetectedColumn[]; preview: { header: string[]; rows: string[][] }; initial: Record<string, Target>; ready: boolean }) {
  const [mapping, setMapping] = useState(initial);
  const [summary, setSummary] = useState<ImportSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [checking, startCheck] = useTransition();
  const [saving, startSave] = useTransition();

  useEffect(() => {
    const t = setTimeout(
      () =>
        startCheck(async () => {
          const res = await previewImport(id, mapping);
          if (res.ok) {
            setSummary(res.summary);
            setError(null);
          } else {
            setSummary(null);
            setError(res.error);
          }
        }),
      250,
    );
    return () => clearTimeout(t);
  }, [id, mapping]);

  const mapped = columns.filter((c) => mapping[c.name] !== "ignore");
  return (
    <div className="grid gap-4 xl:grid-cols-3">
      <div className="space-y-4 xl:col-span-2">
        <section className="rounded-2xl border border-line bg-surface shadow-card">
          <div className="px-5 pt-5 sm:px-6">
            <h2 className="text-[15px] font-heavy text-ink">Detected columns</h2>
            <p className="mt-1 text-sm text-muted">PIVOT matched {mapped.length} of {columns.length} columns. Change anything that looks wrong.</p>
          </div>
          <ul className="mt-4 divide-y divide-line border-t border-line">
            {columns.map((c) => (
              <li key={c.name} className="grid gap-2 px-5 py-3.5 sm:grid-cols-[1fr_15rem] sm:items-center sm:px-6">
                <div className="min-w-0">
                  <p className="truncate text-[15px] text-ink">{c.name}</p>
                  <p className="truncate text-xs text-muted">
                    {TYPE_LABEL[c.type]}
                    {c.samples.length ? ` · e.g. ${c.samples.join(", ")}` : ""}
                  </p>
                </div>
                <label className="sr-only" htmlFor={`map-${c.name}`}>
                  What {c.name} holds
                </label>
                <Select
                  id={`map-${c.name}`}
                  value={mapping[c.name] ?? "ignore"}
                  onChange={(e) => setMapping((m) => ({ ...m, [c.name]: e.target.value as Target }))}
                  className={cn("h-10 text-sm", mapping[c.name] === "ignore" && "text-muted")}
                >
                  {(Object.entries(TARGETS) as [Target, string][]).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </Select>
              </li>
            ))}
          </ul>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6">
          <h2 className="text-[15px] font-heavy text-ink">Preview</h2>
          <p className="mt-1 text-sm text-muted">The first {preview.rows.length} rows of your file.</p>
          <div className="mt-4 overflow-x-auto rounded-xl border border-line">
            <table className="w-full text-left text-[13px]">
              <thead className="bg-canvas">
                <tr>
                  {preview.header.map((h) => (
                    <th key={h} scope="col" className="whitespace-nowrap px-3 py-2 font-normal text-muted">
                      {h}
                      <span className="block text-[11px] text-ink">{mapping[h] && mapping[h] !== "ignore" ? TARGETS[mapping[h]] : "Not imported"}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 10).map((r, i) => (
                  <tr key={i} className="border-t border-line">
                    {r.map((cell, j) => (
                      <td key={j} className={cn("max-w-48 truncate whitespace-nowrap px-3 py-2", mapping[preview.header[j]] === "ignore" ? "text-faint" : "text-ink-2")}>
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      <aside className="xl:col-span-1">
        <div className="sticky top-24 space-y-4 rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6" aria-live="polite">
          <h2 className="text-[15px] font-heavy text-ink">What PIVOT will import</h2>
          {checking && !summary && (
            <p className="inline-flex items-center gap-2 text-sm text-muted">
              <Loader2 size={15} className="animate-spin" aria-hidden="true" /> Checking…
            </p>
          )}
          {summary && (
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-muted">Months</dt>
                <dd className="mt-0.5 text-ink">
                  {summary.months.length} · {monthLabel(summary.months[0], true)} – {monthLabel(summary.months[summary.months.length - 1], true)}
                </dd>
              </div>
              <div>
                <dt className="text-muted">Useful metrics found</dt>
                <dd className="mt-1.5 flex flex-wrap gap-1.5">
                  {summary.metrics.map((m) => (
                    <span key={m} className="inline-flex items-center gap-1 rounded-full bg-positive-soft px-2.5 py-1 text-xs text-positive-text">
                      <CheckCircle2 size={12} aria-hidden="true" /> {m}
                    </span>
                  ))}
                </dd>
              </div>
              {summary.breakdowns && (
                <div>
                  <dt className="text-muted">Breakdown</dt>
                  <dd className="mt-0.5 text-ink">
                    {summary.breakdowns.values} {summary.breakdowns.kind === "product" ? "products" : summary.breakdowns.kind === "channel" ? "channels" : "segments"}
                  </dd>
                </div>
              )}
              <div>
                <dt className="text-muted">File type</dt>
                <dd className="mt-0.5 text-ink">{summary.shape === "transactions" ? "Order-level (rolled up by month)" : "Period totals"}</dd>
              </div>
            </dl>
          )}
          {summary?.warnings.map((w) => (
            <p key={w} className="flex gap-2 rounded-xl bg-caution-soft p-3 text-[13px] text-ink-2">
              <AlertTriangle size={15} className="mt-0.5 shrink-0 text-caution-text" aria-hidden="true" />
              {w}
            </p>
          ))}
          {error && <FormMessage tone="error">{error}</FormMessage>}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              variant="accent"
              disabled={!summary || saving || checking}
              onClick={() =>
                startSave(async () => {
                  const res = await confirmImport(id, mapping);
                  if (res?.error) setError(res.error);
                })
              }
            >
              {saving && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
              {saving ? "Analyzing…" : ready ? "Save mapping and re-analyze" : "Import and analyze"}
            </Button>
            {!ready && (
              <Button
                variant="ghost"
                disabled={saving}
                onClick={() =>
                  startSave(async () => {
                    const res = await deleteDataset(id);
                    if (res?.error) setError(res.error);
                  })
                }
              >
                Discard upload
              </Button>
            )}
          </div>
          <p className="text-xs text-muted">Your file is stored only in this workspace and is deleted when you delete the dataset.</p>
        </div>
      </aside>
    </div>
  );
}
