"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { ArrowRight, FlaskConical, MessageCircleQuestion, Sparkles } from "lucide-react";
import Link from "next/link";
import { Card } from "@/components/app-shell/page-header";
import { cn } from "@/lib/utils";
import type { Brief, BriefAction } from "@/server/home/brief";
import { money, pct } from "./format";

// Measured with a typical two-line brief: 359px on small phones, 213px from 640px, 185px from 1280px.
export const BRIEF_HEIGHT = "min-h-[360px] min-[390px]:min-h-[332px] sm:min-h-[214px] xl:min-h-[186px]";

/** Ask lumen listens for this (the brief's "Ask lumen what to try"). */
export function openAsk(question: string) {
  window.dispatchEvent(new CustomEvent("lumen:ask", { detail: { question } }));
}

export function MorningBrief() {
  const { data, isPending, isError } = useQuery({
    queryKey: ["home", "brief"],
    staleTime: 5 * 60_000,
    queryFn: async (): Promise<Brief | null> => {
      const res = await fetch("/api/app/brief");
      if (!res.ok) throw new Error("unavailable");
      return (await res.json()).brief;
    },
  });

  if (isPending) return <BriefSkeleton />;
  // The brief is a nice-to-have: if it fails, the numbers below still tell the story.
  if (isError || !data) return null;

  const f = data.facts;
  return (
    <Card aria-labelledby="brief-title" className={`${BRIEF_HEIGHT} p-5 sm:p-6`}>
      <h2 id="brief-title" className="flex items-center gap-1.5 text-cap font-semibold text-app-muted">
        <Sparkles size={14} aria-hidden="true" /> Morning brief
      </h2>
      <p className="mt-2 max-w-3xl text-title leading-snug text-app-fg">{data.sentence}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <BriefButton action={data.actions[0]} primary />
        <BriefButton action={data.actions[1]} />
        <details className="ml-auto text-cap text-app-muted">
          <summary className="cursor-pointer rounded-control px-1 font-semibold hover:text-app-fg">What this is based on</summary>
          <ul className="mt-2 max-w-md space-y-1">
            <li>
              Yesterday ({f.yesterday.weekday}, your time): {money(f.yesterday.revenueCents, f.currency)} from {f.yesterday.orders}{" "}
              {f.yesterday.orders === 1 ? "order" : "orders"}; the {f.yesterday.weekday} before: {money(f.yesterday.compareRevenueCents, f.currency)}.
            </li>
            {f.leak && (
              <li>
                Biggest leak in the last 30 days: before {f.leak.toLabel}
                {f.leak.who && f.leak.segmentRate != null && f.leak.othersRate != null
                  ? `; ${f.leak.who} leave at ${pct(f.leak.segmentRate, 0)} vs ${pct(f.leak.othersRate, 0)} for everyone else`
                  : ""}
                .{" "}
                {f.leak.perWeekCents > 0 &&
                  (f.leak.basis === "previous"
                    ? "The weekly figure assumes they get back to last period's rate."
                    : "The weekly figure assumes closing half the gap with everyone else.")}
              </li>
            )}
            <li>{data.source === "ai" ? "Written by lumen's AI from these numbers only." : "Written from these numbers."}</li>
          </ul>
        </details>
      </div>
    </Card>
  );
}

function BriefButton({ action, primary = false }: { action: BriefAction; primary?: boolean }) {
  const start = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/app/brief/start-test", { method: "POST" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Couldn't start the test");
      return body as { experimentId: string };
    },
  });
  const cls = cn(
    "inline-flex h-10 items-center gap-2 rounded-control px-4 text-ui font-semibold transition-colors",
    // The brief's first action is Home's primary action: the one orange button.
    primary ? "bg-app-accent text-app-accent-fg hover:brightness-105" : "border border-app-hairline bg-app-card text-app-fg hover:bg-app-sunken",
  );

  if (action.kind === "link") {
    return (
      <Link href={action.href} className={cls}>
        {action.label} <ArrowRight size={16} aria-hidden="true" />
      </Link>
    );
  }
  if (action.kind === "ask") {
    return (
      <button type="button" onClick={() => openAsk(action.question)} className={cls}>
        <MessageCircleQuestion size={16} aria-hidden="true" /> {action.label}
      </button>
    );
  }
  if (start.data) {
    return (
      <Link href={`/studio/experiments/${start.data.experimentId}`} className={cls} role="status">
        <FlaskConical size={16} aria-hidden="true" /> Test started. See it <ArrowRight size={16} aria-hidden="true" />
      </Link>
    );
  }
  return (
    <span className="inline-flex flex-col">
      <button type="button" onClick={() => start.mutate()} disabled={start.isPending} className={cn(cls, "disabled:opacity-70")}>
        <FlaskConical size={16} aria-hidden="true" /> {start.isPending ? "Starting…" : action.label}
      </button>
      {start.error && (
        <span role="alert" className="mt-1 text-cap text-app-failure-text">
          {start.error.message}
        </span>
      )}
    </span>
  );
}

export function BriefSkeleton() {
  return (
    <Card aria-hidden="true" className={`${BRIEF_HEIGHT} p-5 sm:p-6`}>
      <div className="app-skeleton h-4 w-28" />
      <div className="app-skeleton mt-3 h-6 w-full max-w-3xl" />
      <div className="app-skeleton mt-2 h-6 w-2/3 max-w-2xl" />
      <div className="mt-4 flex gap-2">
        <div className="app-skeleton h-10 w-28 rounded-control" />
        <div className="app-skeleton h-10 w-40 rounded-control" />
      </div>
    </Card>
  );
}
