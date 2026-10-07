import { ArrowRight, SlidersHorizontal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { ButtonLink } from "@/components/ui/button";
import { ScoreRing } from "@/components/ui/score-ring";
import type { Opportunity } from "@/lib/engine/types";
import { money } from "@/lib/format";
import { cn } from "@/lib/utils";
import { impactTone, riskTone } from "./labels";

export function simulateHref(base: string, o: Opportunity) {
  return o.simulate ? `${base}/what-if?kind=${o.simulate.kind}&value=${o.simulate.value}&from=${o.key}` : `${base}/what-if`;
}

export function OpportunityCard({ o, base, currency, compact = false, dimmed = false }: { o: Opportunity; base: string; currency: string; compact?: boolean; dimmed?: boolean }) {
  return (
    <article className={cn("anim-card flex flex-col rounded-2xl border border-line bg-surface p-5 shadow-card sm:p-6", dimmed && "opacity-70")}>
      <div className="flex items-start gap-4">
        <ScoreRing score={o.score} size={compact ? 60 : 72} stroke={compact ? 6 : 7} label="PIVOT Score" showMax={false} className="text-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-xs text-muted">
            PIVOT Score · <span className="text-ink">{o.scoreLabel}</span>
          </p>
          <h3 className="mt-1 text-[17px] font-heavy leading-snug tracking-tight text-ink sm:text-lg">{o.title}</h3>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-2 gap-x-4 gap-y-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted">Potential impact</dt>
          <dd className="mt-1">
            <Badge tone={impactTone(o.impact)}>{o.impact}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Estimated effort</dt>
          <dd className="mt-1">
            <Badge tone="neutral">{o.effort}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Risk</dt>
          <dd className="mt-1">
            <Badge tone={riskTone(o.risk)}>{o.risk}</Badge>
          </dd>
        </div>
        <div>
          <dt className="text-muted">Confidence</dt>
          <dd className="mt-1 font-heavy text-ink">{o.confidence}%</dd>
        </div>
      </dl>
      {!compact && (
        <div className="mt-5 rounded-xl bg-canvas p-4">
          <p className="text-[13px] font-heavy uppercase tracking-[0.06em] text-ink">Why PIVOT found it</p>
          <p className="mt-1.5 text-[15px] leading-relaxed text-ink-2">{o.whyFound}</p>
        </div>
      )}
      <div className="mt-5 flex flex-wrap items-center gap-2 pt-1 sm:mt-auto">
        <ButtonLink href={`${base}/opportunities/${o.key}`} variant="primary" size="sm">
          Analyze <ArrowRight size={15} aria-hidden="true" />
        </ButtonLink>
        <ButtonLink href={simulateHref(base, o)} variant="secondary" size="sm">
          <SlidersHorizontal size={15} aria-hidden="true" /> Simulate
        </ButtonLink>
        <span className="ml-auto text-sm text-muted">
          ~{money(o.annualImpact, currency)}/yr {o.impactBasis === "profit" ? "profit" : "revenue"}
        </span>
      </div>
    </article>
  );
}
