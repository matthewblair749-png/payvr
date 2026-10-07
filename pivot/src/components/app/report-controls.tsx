"use client";

import { Download, FileText, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useActionState, useState } from "react";
import { Button } from "@/components/ui/button";
import { FormMessage, Select } from "@/components/ui/field";
import { monthLabel } from "@/lib/format";
import { generateReport } from "@/server/data/report-actions";
import type { ActionResult } from "@/server/errors";

export function GenerateReport({ periods, demo, disabledReason }: { periods: string[]; demo: boolean; disabledReason?: string }) {
  const [state, action, pending] = useActionState<ActionResult | undefined, FormData>(generateReport, undefined);
  const [period, setPeriod] = useState(periods[periods.length - 1] ?? "");
  const router = useRouter();
  return (
    <form
      action={demo ? undefined : action}
      onSubmit={(e) => {
        if (demo) {
          e.preventDefault();
          router.push(`/demo/reports/${period}`);
        }
      }}
      className="flex flex-col gap-3 sm:flex-row sm:items-end"
    >
      <div className="sm:w-64">
        <label htmlFor="report-period" className="mb-1.5 block text-sm text-ink-2">
          Month
        </label>
        <Select id="report-period" name="period" value={period} onChange={(e) => setPeriod(e.target.value)}>
          {[...periods].reverse().map((p) => (
            <option key={p} value={p}>
              {monthLabel(p)}
            </option>
          ))}
        </Select>
      </div>
      <Button type="submit" variant="accent" disabled={pending || Boolean(disabledReason)}>
        {pending ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <FileText size={16} aria-hidden="true" />}
        {pending ? "Writing your report…" : "Generate report"}
      </Button>
      {(disabledReason || (state && !state.ok)) && (
        <div className="sm:basis-full">
          <FormMessage tone={disabledReason ? "info" : "error"}>{disabledReason ?? (state && !state.ok ? state.error : null)}</FormMessage>
        </div>
      )}
    </form>
  );
}

export function DownloadReport() {
  return (
    <Button variant="primary" onClick={() => window.print()}>
      <Download size={16} aria-hidden="true" /> Download report
    </Button>
  );
}
