"use client";

import { ArrowRight, ChevronDown } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { StatusLabel } from "@/components/ui/badge";
import { Button, ButtonLink } from "@/components/ui/button";
import type { Insight } from "@/lib/engine/types";
import { cn } from "@/lib/utils";
import { askPivot } from "./ask-button";
import { FourAnswers } from "./explain";
import { SEVERITY } from "./labels";
import { StatusActions } from "./status-actions";

/** A full insight: the four answers, its action button, and expandable evidence. */
export function InsightCard({
  insight,
  base,
  status,
  demo,
  evidence,
  defaultOpen = false,
}: {
  insight: Insight;
  base: string;
  status: "OPEN" | "DONE" | "DISMISSED";
  demo: boolean;
  evidence: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  const s = SEVERITY[insight.severity];
  const toOpportunity = insight.actionLabel === "Explore opportunity" && insight.related.opportunity;
  return (
    <article id={insight.key} className={cn("anim-card scroll-mt-24 rounded-2xl border bg-surface shadow-card", status === "OPEN" ? "border-line" : "border-line opacity-70")}>
      <div className="p-5 sm:p-6">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <StatusLabel tone={s.tone}>{s.label}</StatusLabel>
          {status !== "OPEN" && <span className="text-xs text-muted">{status === "DONE" ? "Resolved" : "Dismissed"}</span>}
        </div>
        <h2 className="mt-2 text-xl font-heavy tracking-tight text-ink sm:text-[1.375rem]">{insight.title}</h2>
        <FourAnswers e={insight} className="mt-5" />
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {toOpportunity ? (
            <ButtonLink href={`${base}/opportunities/${insight.related.opportunity}`} variant="primary" size="sm">
              {insight.actionLabel} <ArrowRight size={15} aria-hidden="true" />
            </ButtonLink>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${insight.key}-evidence`}>
              {insight.actionLabel}
              <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
            </Button>
          )}
          {toOpportunity && (
            <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${insight.key}-evidence`}>
              See the data
              <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={() => askPivot(`Tell me more about this: ${insight.title}`)}>
            Ask PIVOT
          </Button>
          {insight.related.recommendation && (
            <Link href={`${base}/recommendations#${insight.related.recommendation}`} className="px-2 text-[13px] text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
              Recommended move
            </Link>
          )}
          <span className="ml-auto">
            <StatusActions kind="insight" itemKey={insight.key} status={status} demo={demo} />
          </span>
        </div>
      </div>
      {open && (
        <div id={`${insight.key}-evidence`} className="border-t border-line bg-canvas/60 p-5 sm:p-6">
          {evidence}
        </div>
      )}
    </article>
  );
}
