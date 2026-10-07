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
        {insight.locked ? (
          <LockedInsight insight={insight} base={base} />
        ) : (
          <FourAnswers e={insight} className="mt-5" />
        )}
        <div className="mt-6 flex flex-wrap items-center gap-2">
          {insight.locked ? null : toOpportunity ? (
            <ButtonLink href={`${base}/opportunities/${insight.related.opportunity}`} variant="primary" size="sm">
              {insight.actionLabel} <ArrowRight size={15} aria-hidden="true" />
            </ButtonLink>
          ) : (
            <Button variant="primary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${insight.key}-evidence`}>
              {insight.actionLabel}
              <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
            </Button>
          )}
          {toOpportunity && !insight.locked && (
            <Button variant="secondary" size="sm" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-controls={`${insight.key}-evidence`}>
              See the data
              <ChevronDown size={15} className={cn("transition-transform", open && "rotate-180")} aria-hidden="true" />
            </Button>
          )}
          {!insight.locked && (
            <Button variant="ghost" size="sm" onClick={() => askPivot(`Tell me more about this: ${insight.title}`)}>
              Ask PIVOT
            </Button>
          )}
          {insight.related.recommendation && !insight.locked && (
            <Link href={`${base}/recommendations#${insight.related.recommendation}`} className="px-2 text-[13px] text-ink-2 underline decoration-line-strong underline-offset-4 hover:text-ink">
              Recommended move
            </Link>
          )}
          <span className="ml-auto">
            <StatusActions kind="insight" itemKey={insight.key} status={status} demo={demo} />
          </span>
        </div>
      </div>
      {open && !insight.locked && (
        <div id={`${insight.key}-evidence`} className="border-t border-line bg-canvas/60 p-5 sm:p-6">
          {evidence}
        </div>
      )}
    </article>
  );
}

/** An insight beyond the plan's limit: the headline, and what upgrading adds. */
export function LockedInsight({ insight, base, compact = false }: { insight: Insight; base: string; compact?: boolean }) {
  return (
    <div className={compact ? "mt-1" : "mt-4 space-y-3"}>
      <p className="text-[15px] leading-relaxed text-ink-2">{insight.what}</p>
      <p className={cn("text-sm text-ink-2", !compact && "rounded-xl bg-sunken p-3")}>
        Why it happened and what to do about it are on Pro.{" "}
        <Link href={`${base}/settings/billing`} className="font-heavy text-ink underline underline-offset-4">
          See plans
        </Link>
      </p>
    </div>
  );
}
