"use client";

import { HelpCircle } from "lucide-react";
import { useState } from "react";
import { Delta } from "@/components/ui/delta";
import { Dialog } from "@/components/ui/dialog";
import type { Kpi } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { FourAnswers } from "./explain";

/** A KPI tile. "Explain" opens the four answers for this number. */
export function KpiCard({ kpi, spark, ring, className }: { kpi: Kpi; spark?: React.ReactNode; ring?: React.ReactNode; className?: string }) {
  const [open, setOpen] = useState(false);
  const isScore = kpi.key === "score";
  return (
    <div className={cn("anim-card flex min-w-0 flex-col rounded-2xl border border-line bg-surface p-4 shadow-card sm:p-5", className)}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm text-muted">{kpi.label}</p>
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="-m-1.5 grid size-8 shrink-0 place-items-center rounded-full text-muted hover:bg-sunken hover:text-ink"
          aria-label={`Explain ${kpi.label}`}
        >
          <HelpCircle size={17} aria-hidden="true" />
        </button>
      </div>
      {isScore && ring ? (
        <div className="mt-2 flex items-center gap-3">{ring}</div>
      ) : (
        <>
          <p className="mt-2 truncate text-[1.75rem] font-heavy leading-none tracking-tighter text-ink sm:text-[2rem]">{kpi.display}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            {kpi.changeDisplay && (
              <Delta label={kpi.changeDisplay} direction={(kpi.change ?? 0) > 0 ? "up" : (kpi.change ?? 0) < 0 ? "down" : "flat"} good={kpi.good} />
            )}
            <span className="text-xs text-muted">vs last month</span>
          </div>
        </>
      )}
      {spark && <div className="mt-auto pt-4">{spark}</div>}
      <Dialog open={open} onClose={() => setOpen(false)} title={`${kpi.label}: ${kpi.display}`} description={kpi.changeDisplay ? `${kpi.changeDisplay} vs last month` : undefined}>
        <div className="p-6">
          <FourAnswers e={kpi.explain} compact />
        </div>
      </Dialog>
    </div>
  );
}
