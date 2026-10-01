"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { FlaskConical } from "lucide-react";
import { startProposalAction } from "@/app/studio/research-actions";
import { Button } from "@/components/ui/button";
import type { ProposalView } from "@/server/research/proposals";

/** A proposed A/B test with its one-click start. */
export function ProposalCard({ proposal, tone = "light" }: { proposal: ProposalView; tone?: "light" | "dark" }) {
  const [started, setStarted] = useState(proposal.startedExperimentId);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const dark = tone === "dark";
  return (
    <div className={`rounded-2xl p-4 ${dark ? "bg-white/10 text-white" : "bg-white ring-1 ring-black/8"}`}>
      <p className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider ${dark ? "text-spark" : "text-orange-deep"}`}>
        <FlaskConical size={13} aria-hidden="true" /> Proposed A/B test · {proposal.checkoutName}
      </p>
      <p className="mt-1.5 font-semibold">{proposal.title}</p>
      <ul className={`mt-1 list-disc pl-5 text-sm ${dark ? "text-white/80" : "text-muted-strong"}`}>
        {proposal.changes.map((c) => (
          <li key={c}>Variant B: {c}</li>
        ))}
      </ul>
      <p className={`mt-2 text-sm ${dark ? "text-white/80" : "text-muted-strong"}`}>{proposal.hypothesis}</p>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        {started ? (
          <>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${dark ? "bg-spark text-ink" : "bg-[#DDF3E4] text-[#14532D]"}`}>
              <span aria-hidden="true" className="h-1.5 w-1.5 animate-pulse rounded-full bg-current" /> Running · 50/50
            </span>
            <Link href={`/studio/pages/${proposal.checkoutId}`} className="text-sm font-semibold underline underline-offset-4">
              View checkout
            </Link>
          </>
        ) : (
          <Button
            variant={dark ? "primary" : "ink"}
            size="sm"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await startProposalAction({ insightId: proposal.insightId });
                if (!res.ok) return setError(res.error);
                setStarted(res.data.experimentId);
              })
            }
          >
            {pending ? "Starting…" : "Start this test"}
          </Button>
        )}
        <span className={`text-xs ${dark ? "text-white/60" : "text-muted-strong"}`}>
          Measures {proposal.metric === "revenue_per_visit" ? "revenue per visit" : "conversion"}
        </span>
      </div>
      {error && (
        <p role="alert" className="mt-2 text-sm font-medium text-orange-deep">
          {error}
        </p>
      )}
    </div>
  );
}
