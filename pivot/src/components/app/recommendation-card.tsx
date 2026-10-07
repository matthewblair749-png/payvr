"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { Recommendation } from "@/lib/engine/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { impactTone, riskTone } from "./labels";
import { StatusActions } from "./status-actions";

export function RecommendationCard({ r, base, currency, status, demo, defaultOpen }: { r: Recommendation; base: string; currency: string; status: "OPEN" | "DONE" | "DISMISSED"; demo: boolean; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(Boolean(defaultOpen));
  return (
    <article id={r.key} className={cn("anim-card scroll-mt-24 rounded-2xl border bg-surface shadow-card", r.rank === 1 && status === "OPEN" ? "border-ink" : "border-line", status !== "OPEN" && "opacity-70")}>
      <div className="flex gap-4 p-5 sm:gap-5 sm:p-6">
        <span className={cn("grid size-11 shrink-0 place-items-center rounded-2xl text-lg font-heavy", r.rank === 1 ? "bg-ink text-white" : "bg-sunken text-ink")} aria-label={`Rank ${r.rank}`}>
          #{r.rank}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <h2 className="text-xl font-heavy tracking-tight text-ink">{r.title}</h2>
            {status !== "OPEN" && <span className="text-xs text-muted">{status === "DONE" ? "Done" : "Dismissed"}</span>}
          </div>
          <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            <div className="flex items-center gap-2">
              <dt className="text-muted">Impact</dt>
              <dd>
                <Badge tone={impactTone(r.impact)}>{r.impact}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted">Difficulty</dt>
              <dd>
                <Badge>{r.difficulty}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted">Risk</dt>
              <dd>
                <Badge tone={riskTone(r.risk)}>{r.risk}</Badge>
              </dd>
            </div>
            <div className="flex items-center gap-2">
              <dt className="text-muted">Worth</dt>
              <dd className="font-heavy text-ink">~{money(r.annualImpact, currency)}/yr</dd>
            </div>
          </dl>
          <p className="mt-4 text-[15px] leading-relaxed text-ink-2">
            <span className="font-heavy text-ink">Reasoning: </span>
            {r.reasoning}
          </p>
          <div className="mt-5 flex flex-wrap items-center gap-2">
            <Button variant={r.rank === 1 ? "primary" : "secondary"} size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${r.key}-plan`}>
              Explore <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
            </Button>
            <span className="ml-auto">
              <StatusActions kind="recommendation" itemKey={r.key} status={status} demo={demo} />
            </span>
          </div>
        </div>
      </div>
      {open && (
        <div id={`${r.key}-plan`} className="border-t border-line bg-canvas/60 px-5 py-5 sm:px-6 sm:pl-[5.5rem]">
          <p className="text-[13px] font-heavy uppercase tracking-[0.06em] text-ink">How to do it</p>
          <ol className="mt-3 space-y-2.5">
            {r.steps.map((s, i) => (
              <li key={s} className="flex gap-3 text-[15px] text-ink-2">
                <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface text-xs font-heavy text-ink ring-1 ring-line">{i + 1}</span>
                {s}
              </li>
            ))}
          </ol>
          <div className="mt-5 flex flex-wrap gap-x-5 gap-y-2">
            {r.links.map((l) => (
              <Link key={l.href} href={`${base}/${l.href}`} className="inline-flex items-center gap-1 text-sm font-heavy text-ink hover:underline">
                {l.label} <ArrowRight size={14} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
