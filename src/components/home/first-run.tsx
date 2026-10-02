"use client";

import { Check, Copy, PartyPopper } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Card } from "@/components/app-shell/page-header";
import { cn } from "@/lib/utils";
import { ShowSampleButton } from "./sample-banner";

type State = { published: { name: string; slug: string } | null; stripeReady: boolean; visited: boolean; appUrl: string };

/** First run: no blank charts, just the four things that get a shop to its first sale. */
export function FirstRun({ state }: { state: State }) {
  const link = state.published ? `${state.appUrl}/pay/${state.published.slug}` : null;
  const steps = [
    {
      done: Boolean(state.published),
      title: "Publish your first checkout",
      body: "Make it look like your brand in Checkout Studio, then publish it.",
      action: !state.published && (
        <Link href="/studio/checkouts" className="font-semibold underline underline-offset-4">
          Open Checkout Studio
        </Link>
      ),
    },
    {
      done: state.stripeReady,
      title: "Connect Stripe to get paid",
      body: "Money goes straight to your bank. Test mode is fine to start.",
      action: !state.stripeReady && (
        <Link href="/studio/payments" className="font-semibold underline underline-offset-4">
          Connect Stripe
        </Link>
      ),
    },
    {
      done: state.visited,
      title: "Share your checkout link",
      body: link ? "Put it in your bio, a post or an email. Visits show up here within seconds." : "Once your checkout is published, its link appears here.",
      action: link && <CopyLink link={link} />,
    },
    {
      done: false,
      title: "Get your first sale",
      body: "We'll celebrate it with you, then Home fills up with your own numbers.",
      action: null,
    },
  ];
  const doneCount = steps.filter((s) => s.done).length;
  // The first step that isn't done is the one to do now.
  const current = steps.findIndex((s) => !s.done);

  return (
    <Card aria-labelledby="first-run-title" className="mt-8 p-6 sm:p-8">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="first-run-title" className="font-display text-title font-bold">
          Let&apos;s get your first sale
        </h2>
        <p className="text-ui text-app-muted">
          {doneCount} of {steps.length} done
        </p>
      </div>
      <div
        role="progressbar"
        aria-label="Setup progress"
        aria-valuemin={0}
        aria-valuemax={steps.length}
        aria-valuenow={doneCount}
        className="mt-3 h-1.5 rounded-full bg-app-sunken"
      >
        <div className="h-1.5 rounded-full bg-app-accent transition-[width] duration-500" style={{ width: `${(doneCount / steps.length) * 100}%` }} />
      </div>
      <ol className="mt-6 space-y-1">
        {steps.map((s, i) => (
          <li key={s.title} className={cn("flex gap-4 rounded-control p-3", i === current && "bg-app-sunken")}>
            <span
              aria-hidden="true"
              className={cn(
                "mt-0.5 grid size-7 shrink-0 place-items-center rounded-full border text-cap font-semibold",
                s.done ? "border-app-success bg-app-success-soft text-app-success-text" : "border-app-hairline text-app-muted",
              )}
            >
              {s.done ? <Check size={14} strokeWidth={3} /> : i === 3 ? <PartyPopper size={14} /> : i + 1}
            </span>
            <div className="min-w-0 flex-1">
              <p className={cn("text-body font-semibold", s.done && "text-app-muted line-through decoration-app-muted/50")}>
                {s.title}
                <span className="sr-only">{s.done ? " (done)" : i === current ? " (next)" : ""}</span>
              </p>
              {!s.done && <p className="mt-0.5 text-ui text-app-muted">{s.body}</p>}
              {!s.done && s.action && <div className="mt-2 text-ui">{s.action}</div>}
            </div>
          </li>
        ))}
      </ol>
      <p className="mt-6 border-t border-app-hairline pt-4 text-ui text-app-muted">
        Curious what Home looks like once sales come in? <ShowSampleButton />
      </p>
    </Card>
  );
}

function CopyLink({ link }: { link: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <code className="min-w-0 truncate rounded-control border border-app-hairline bg-app-card px-2.5 py-1.5 text-cap">{link}</code>
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(link);
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        }}
        className="inline-flex h-8 items-center gap-1.5 rounded-control bg-app-accent px-3 text-ui font-semibold text-app-accent-fg"
      >
        {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        <span aria-live="polite">{copied ? "Copied" : "Copy link"}</span>
      </button>
    </div>
  );
}
