import { ArrowRight, BellRing, Check, ChevronRight, FileText, Gauge, HeartPulse, ListOrdered, Plus, Radar, SlidersHorizontal, Sparkles } from "lucide-react";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { StatusLabel } from "@/components/ui/badge";
import { Sparkline } from "@/components/charts/sparkline";
import { FAQ, PROOF_STATS, STEPS, TESTIMONIALS, TRUST_LOGOS } from "@/content/landing";
import { PLANS } from "@/lib/billing/plans";
import type { Facts } from "@/lib/engine/facts";
import { simulate } from "@/lib/engine/simulate";
import type { Analysis } from "@/lib/engine/types";
import { money, pctDelta } from "@/lib/format";
import { cn } from "@/lib/utils";

function SectionHeading({ eyebrow, title, body, center = false }: { eyebrow: string; title: string; body?: string; center?: boolean }) {
  return (
    <div className={cn("max-w-2xl", center && "mx-auto text-center")}>
      <p className="text-[12px] font-heavy uppercase tracking-[0.1em] text-muted">{eyebrow}</p>
      <h2 className="mt-3 text-[2.125rem] font-heavy leading-[1.05] tracking-tighter text-ink sm:text-5xl">{title}</h2>
      {body && <p className="mt-4 text-[17px] leading-relaxed text-muted sm:text-lg">{body}</p>}
    </div>
  );
}

// ---------------------------------------------------------------------------

const GLYPHS = [
  <circle key="c" cx="10" cy="10" r="7" />,
  <rect key="r" x="3" y="3" width="14" height="14" rx="3" />,
  <path key="t" d="M10 3 L17 16 H3 Z" />,
  <path key="d" d="M10 2 L18 10 L10 18 L2 10 Z" />,
  <path key="b" d="M3 15 h3 v-6 h-3z M8.5 15 h3 V5 h-3z M14 15 h3 V9 h-3z" />,
  <path key="h" d="M10 2 a8 8 0 1 0 0.01 0 M10 6 a4 4 0 1 1 -0.01 0" fillRule="evenodd" />,
];

export function TrustBar() {
  return (
    <section aria-label="Customers" className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <p className="text-center text-sm text-muted">Decisions made with PIVOT at</p>
      <ul className="mt-6 grid grid-cols-2 gap-x-6 gap-y-5 sm:grid-cols-3 lg:grid-cols-6">
        {TRUST_LOGOS.map((name, i) => (
          <li key={name} className="flex items-center justify-center gap-2 text-muted">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
              {GLYPHS[i % GLYPHS.length]}
            </svg>
            <span className="text-[1.0625rem] font-heavy tracking-tight">{name}</span>
          </li>
        ))}
      </ul>
    </section>
  );
}

export function ProofStrip() {
  return (
    <section aria-label="PIVOT in numbers" className="border-y border-line bg-canvas">
      <ul className="mx-auto flex max-w-6xl flex-col items-center gap-3 px-4 py-5 text-center sm:flex-row sm:flex-wrap sm:justify-center sm:gap-x-8 sm:px-6">
        {PROOF_STATS.map((s, i) => (
          <li key={s.label} className="flex items-center gap-2 text-[15px] text-ink-2">
            {i > 0 && <span className="mr-6 hidden size-1 rounded-full bg-faint sm:inline-block" aria-hidden="true" />}
            <span className="font-heavy text-ink">{s.value}</span> {s.label}
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

function noise(seed: number, n = 14) {
  let x = seed;
  return Array.from({ length: n }, () => {
    x = (x * 9301 + 49297) % 233280;
    return 40 + (x / 233280) * 60;
  });
}

const NOISY = ["Sessions", "Bounce rate", "CTR", "ARPU", "Cart adds", "Refunds", "CPM", "Returns", "Signups"];

export function Problem({ analysis }: { analysis: Analysis }) {
  const top = analysis.recommendations[0];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading eyebrow="The problem" title="Data everywhere. Decisions still unclear." body="Businesses have more data than ever, but data doesn't automatically tell them what to do." />
      <div className="mt-12 grid gap-4 lg:grid-cols-2">
        <figure className="rounded-3xl border border-line bg-canvas p-5 sm:p-6">
          <figcaption className="flex items-center justify-between text-sm">
            <span className="font-heavy text-ink">A typical dashboard</span>
            <span className="text-muted">9 charts · 0 answers</span>
          </figcaption>
          <div className="mt-4 grid grid-cols-3 gap-2.5">
            {NOISY.map((m, i) => (
              <div key={m} className="rounded-xl border border-line bg-surface p-3">
                <p className="truncate text-[11px] text-muted">{m}</p>
                <Sparkline values={noise(i * 37 + 11, 12)} width={80} height={24} tone="gray" className="mt-2 w-full" />
              </div>
            ))}
          </div>
          <p className="mt-4 text-sm text-muted">Every number is technically correct. None of them says what to do on Monday.</p>
        </figure>
        <figure className="flex flex-col rounded-3xl border border-ink bg-surface p-5 shadow-raise sm:p-6">
          <figcaption className="flex items-center justify-between text-sm">
            <span className="font-heavy text-ink">PIVOT</span>
            <span className="text-muted">1 clear next move</span>
          </figcaption>
          {top && (
            <div className="mt-4 flex flex-1 flex-col justify-between rounded-2xl bg-canvas p-5 sm:p-6">
              <div>
                <p className="text-[11px] font-heavy uppercase tracking-[0.08em] text-muted">Recommended next move #1</p>
                <p className="mt-2 text-2xl font-heavy leading-tight tracking-tight text-ink sm:text-[1.75rem]">{top.title}</p>
                <p className="mt-3 text-[15px] leading-relaxed text-ink-2">{top.reasoning}</p>
              </div>
              <dl className="mt-6 grid grid-cols-3 gap-3 border-t border-line pt-4 text-sm">
                <div>
                  <dt className="text-muted">Impact</dt>
                  <dd className="font-heavy text-ink">{top.impact}</dd>
                </div>
                <div>
                  <dt className="text-muted">Difficulty</dt>
                  <dd className="font-heavy text-ink">{top.difficulty}</dd>
                </div>
                <div>
                  <dt className="text-muted">Worth</dt>
                  <dd className="font-heavy text-ink">{money(top.annualImpact)}/yr</dd>
                </div>
              </dl>
            </div>
          )}
        </figure>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Solution() {
  return (
    <section id="how-it-works" className="scroll-mt-16 border-t border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading eyebrow="The solution" title="PIVOT turns raw business information into actionable decisions." />
        <p className="mt-8 flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-heavy uppercase tracking-[0.1em] text-ink" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span key={s.name} className="inline-flex items-center gap-2">
              {s.name}
              {i < STEPS.length - 1 && <ArrowRight size={14} strokeWidth={2.5} className="text-faint" />}
            </span>
          ))}
        </p>
        <ol className="mt-10 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {STEPS.map((s, i) => (
            <li key={s.name} className={cn("rounded-2xl border bg-surface p-5", i === STEPS.length - 1 ? "border-ink" : "border-line")}>
              <span className="text-sm text-muted">0{i + 1}</span>
              <h3 className="mt-6 text-xl font-heavy tracking-tight text-ink">{s.name}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function FourQuestions({ analysis }: { analysis: Analysis }) {
  const i = analysis.insights[0];
  if (!i) return null;
  const parts = [
    { q: "What?", sub: "What changed?", a: i.what },
    { q: "Why?", sub: "Why did it change?", a: i.why },
    { q: "So what?", sub: "Why does it matter?", a: i.soWhat },
    { q: "Now what?", sub: "What should we consider?", a: i.nowWhat },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading
        eyebrow="Not another dashboard"
        title="Every number comes with a next move."
        body="PIVOT never just dumps analytics on you. Every insight answers four questions, in plain language, from your own data."
      />
      <article className="mt-12 rounded-3xl border border-line bg-surface p-5 shadow-raise sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <StatusLabel tone={i.severity === "ACTION" ? "negative" : i.severity === "OPPORTUNITY" ? "positive" : "caution"}>
            {i.severity === "ACTION" ? "Action needed" : i.severity === "OPPORTUNITY" ? "Opportunity" : "Watch"}
          </StatusLabel>
          <span className="text-sm text-muted">Live from the Northstar Commerce demo</span>
        </div>
        <h3 className="mt-3 text-2xl font-heavy tracking-tight text-ink sm:text-3xl">{i.title}</h3>
        <dl className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-4 lg:gap-8">
          {parts.map((p) => (
            <div key={p.q} className="border-t-2 border-ink pt-4">
              <dt>
                <span className="block text-lg font-heavy text-ink">{p.q}</span>
                <span className="block text-sm text-muted">{p.sub}</span>
              </dt>
              <dd className="mt-3 text-[15px] leading-relaxed text-ink-2">{p.a}</dd>
            </div>
          ))}
        </dl>
      </article>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Features({ analysis, facts }: { analysis: Analysis; facts: Facts }) {
  const cur = analysis.company.currency;
  const rev = analysis.kpis.find((k) => k.key === "revenue");
  const opp = analysis.opportunities[0];
  const rec = analysis.recommendations[0];
  const weakest = [...analysis.health.dimensions].sort((a, b) => a.score - b.score)[0];
  const cut = analysis.baseline ? simulate(analysis.baseline, "price", -10, cur) : null;
  const w = facts.worstChannel;
  const drivers = facts.customers?.change != null && facts.arpc?.change != null ? `${pctDelta(facts.customers.change).replace("+", "")} more customers, each spending ${pctDelta(facts.arpc.change).replace("+", "")} more` : "";

  const features = [
    { icon: Sparkles, name: "AI Business Analysis", body: "Reads every metric and explains what changed, in plain language.", result: rev ? `Explained Northstar's ${rev.changeDisplay} revenue jump in one line: ${drivers}.` : "" },
    { icon: Radar, name: "Opportunity Detection", body: "Finds growth you're leaving on the table, sized in dollars.", result: opp ? `Found Northstar Commerce ${money(opp.annualImpact, cur)} a year in unclaimed demand for ${facts.topMover?.name ?? "its top product"}.` : "" },
    { icon: Gauge, name: "PIVOT Score", body: "Scores every opportunity 0–100 on impact, demand, cost, risk and more.", result: opp ? `Scored "${opp.title}" ${opp.score}/100 across eight factors, before a dollar was spent.` : "" },
    { icon: SlidersHorizontal, name: "What-If Simulator", body: "Tests pricing, marketing, launches and cost moves on your own numbers.", result: cut ? `Showed that a 10% price cut adds ${money(cut.deltas.revenue, cur)} in revenue but only ${money(cut.deltas.profit, cur)} in profit.` : "" },
    { icon: ListOrdered, name: "AI Recommendations", body: "Ranks your next moves by impact, difficulty and risk.", result: rec ? `Ranked "${rec.title}" as move #1, worth ${money(rec.annualImpact, cur)} over 12 months.` : "" },
    { icon: HeartPulse, name: "Business Health", body: "One score across revenue, customers, retention, operations, marketing and products.", result: weakest ? `Scored Northstar ${analysis.health.score}/100 and named the one area holding it back: ${weakest.label.toLowerCase()}.` : "" },
    { icon: BellRing, name: "Smart Alerts", body: "Tells you when something important changes, before the monthly review.", result: w?.cacChange ? `Flagged a ${pctDelta(w.cacChange, 0).replace("+", "")} jump in ${w.name}'s cost per customer the month it happened.` : "" },
    { icon: FileText, name: "Executive Reports", body: "A clean monthly report for your team or board, ready to print.", result: `Turned ${analysis.coverage.months} months of Northstar data into a board-ready monthly report.` },
  ];

  return (
    <section id="features" className="scroll-mt-16 border-t border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading eyebrow="The product" title="Everything you need to decide, nothing you don't." />
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {features.map((f) => (
            <li key={f.name} className="flex flex-col rounded-2xl border border-line bg-surface p-5">
              <div className="flex items-center gap-3 lg:flex-col lg:items-start lg:gap-5">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-sunken text-ink">
                  <f.icon size={20} strokeWidth={2} aria-hidden="true" />
                </span>
                <h3 className="text-[17px] font-heavy tracking-tight text-ink">{f.name}</h3>
              </div>
              <p className="mt-2 text-[14px] leading-relaxed text-muted">{f.body}</p>
              <p className="mt-4 border-t border-line pt-4 text-[14px] leading-relaxed text-ink lg:mt-auto">{f.result}</p>
            </li>
          ))}
        </ul>
        <p className="mt-6 text-sm text-muted">
          Results above are from the Northstar Commerce demo, produced by the same engine that analyzes your data.{" "}
          <Link href="/demo" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
            See them live
          </Link>
          .
        </p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Testimonials() {
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading eyebrow="Customers" title="Teams that decide faster." />
      <ul className="mt-12 grid gap-4 lg:grid-cols-3">
        {TESTIMONIALS.map((t) => (
          <li key={t.name}>
            <figure className="flex h-full flex-col rounded-3xl border border-line bg-surface p-6">
              <blockquote className="flex-1 text-[1.1875rem] leading-snug text-ink">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-8 flex items-center gap-3">
                <Avatar name={t.name} size={44} />
                <span className="text-sm leading-tight">
                  <span className="block font-heavy text-ink">{t.name}</span>
                  <span className="block text-muted">
                    {t.title}, {t.company}
                  </span>
                </span>
              </figcaption>
            </figure>
          </li>
        ))}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Pricing() {
  return (
    <section id="pricing" className="scroll-mt-16 border-t border-line bg-canvas">
      <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6 sm:py-28">
        <SectionHeading eyebrow="Pricing" title="Start free. Upgrade when it pays for itself." body="Every new workspace gets 14 days of Pro, no credit card needed." />
        <ul className="mt-12 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((p) => {
            const featured = p.id === "PRO";
            return (
              <li key={p.id} className={cn("flex flex-col rounded-3xl border bg-surface p-6", featured ? "border-ink shadow-raise" : "border-line")}>
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-heavy text-ink">{p.name}</h3>
                  {featured && <span className="rounded-full bg-ink px-2.5 py-1 text-[11px] font-heavy uppercase tracking-wide text-white">Most popular</span>}
                </div>
                <p className="mt-1 text-sm text-muted">{p.tagline}</p>
                <p className="mt-6 flex items-baseline gap-1">
                  <span className="text-4xl font-heavy tracking-tighter text-ink">{p.price === null ? "Custom" : `$${p.price}`}</span>
                  {p.price !== null && <span className="text-sm text-muted">/month</span>}
                </p>
                <ul className="mt-6 flex-1 space-y-2.5 text-[15px] text-ink-2">
                  {p.features.map((f) => (
                    <li key={f} className="flex gap-2.5">
                      <Check size={17} strokeWidth={2.5} className="mt-0.5 shrink-0 text-ink" aria-hidden="true" />
                      {f}
                    </li>
                  ))}
                </ul>
                <ButtonLink
                  href={p.id === "ENTERPRISE" ? "mailto:sales@pivot.app?subject=PIVOT%20Enterprise" : `/signup?plan=${p.id.toLowerCase()}`}
                  variant={featured ? "primary" : "secondary"}
                  className="mt-8 w-full"
                >
                  {p.cta}
                </ButtonLink>
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-3xl scroll-mt-16 px-4 py-20 sm:px-6 sm:py-28">
      <SectionHeading eyebrow="Questions" title="What buyers ask us." center />
      <div className="mt-12 divide-y divide-line border-y border-line">
        {FAQ.map((f) => (
          <details key={f.q} className="group">
            <summary className="flex items-center justify-between gap-6 py-5 text-left text-[17px] font-heavy text-ink">
              {f.q}
              <Plus size={20} strokeWidth={2.5} className="pv-chevron shrink-0 text-muted transition-transform duration-200" aria-hidden="true" />
            </summary>
            <p className="-mt-1 pb-6 pr-10 text-[16px] leading-relaxed text-muted">{f.a}</p>
          </details>
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------

export function FinalCta() {
  return (
    <section className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-24 text-center sm:px-6 sm:py-32">
        <h2 className="text-[2.75rem] font-heavy leading-[0.98] tracking-tightest text-ink sm:text-7xl">Know your next move.</h2>
        <p className="mx-auto mt-5 max-w-md text-[17px] text-muted">Connect your business. PIVOT finds what matters and shows your options. You decide.</p>
        <div className="mt-9 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <ButtonLink href="/signup" variant="accent" size="xl" className="w-full sm:w-auto">
            Start with PIVOT
            <ArrowRight size={19} strokeWidth={2.5} aria-hidden="true" />
          </ButtonLink>
          <Link href="/demo" className="inline-flex h-12 items-center gap-1 rounded-full px-4 text-[15px] text-ink-2 hover:text-ink">
            or explore the demo <ChevronRight size={16} aria-hidden="true" />
          </Link>
        </div>
      </div>
    </section>
  );
}
