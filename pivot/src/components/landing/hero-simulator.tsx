"use client";

import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useId, useState, type CSSProperties } from "react";
import { Delta, directionOf } from "@/components/ui/delta";
import { money, moneyDelta, pctDelta } from "@/lib/format";
import { scenarioQuestion, simulate } from "@/lib/engine/simulate";
import type { Baseline } from "@/lib/engine/types";
import { useSettled } from "@/lib/use-settled";
import { useTween } from "@/lib/use-tween";

const MIN = -20;
const MAX = 20;

/**
 * The live mini What-If in the landing hero: one slider, no signup. Runs the
 * real simulator on the demo company's numbers, in the browser.
 */
export function HeroSimulator({ baseline, company, currency }: { baseline: Baseline; company: string; currency: string }) {
  const [price, setPrice] = useState(-10);
  const id = useId();
  const s = simulate(baseline, "price", price, currency);
  const revenue = useTween(s.projected.revenue);
  const dRevenue = useTween(s.deltas.revenue);
  // One announcement with the final numbers once the slider stops, not every animation frame.
  const announcement = useSettled(
    `${money(s.projected.revenue, currency)} projected monthly revenue, ${moneyDelta(s.deltas.revenue, currency)}. Profit ${moneyDelta(s.deltas.profit, currency)}. Risk ${s.risk.toLowerCase()}.`,
  );

  const pos = ((price - MIN) / (MAX - MIN)) * 100;
  const zero = ((0 - MIN) / (MAX - MIN)) * 100;
  const max = Math.max(s.baseline.revenue, s.projected.revenue) * 1.04;

  return (
    <div className="anim-rise rounded-[28px] border border-line bg-surface p-5 shadow-pop sm:p-7" style={{ animationDelay: "260ms" }}>
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2 text-[11px] font-heavy uppercase tracking-[0.08em] text-ink">
          <span className="relative flex size-2" aria-hidden="true">
            <span className="anim-pulse absolute inline-flex size-full rounded-full bg-positive" />
            <span className="relative inline-flex size-2 rounded-full bg-positive" />
          </span>
          Live demo · no signup
        </span>
        <span className="hidden truncate text-xs text-muted sm:inline">{company} · sample data</span>
      </div>

      <label htmlFor={id} className="mt-4 block text-[1.375rem] font-heavy leading-tight tracking-tight text-ink sm:text-2xl">
        {scenarioQuestion("price", price)}
      </label>

      <input
        id={id}
        type="range"
        min={MIN}
        max={MAX}
        step={1}
        value={price}
        onChange={(e) => setPrice(Number(e.target.value))}
        aria-valuetext={`${price > 0 ? "+" : ""}${price}% price change`}
        className="pv-range mt-2"
        style={{ "--lo": `${Math.min(zero, pos)}%`, "--hi": `${Math.max(zero, pos)}%` } as CSSProperties}
      />
      <div className="-mt-1 flex justify-between text-xs text-muted" aria-hidden="true">
        <span>−20%</span>
        <span>No change</span>
        <span>+20%</span>
      </div>

      <p className="sr-only" aria-live="polite" aria-atomic="true">
        {announcement}
      </p>
      <div className="mt-6 border-t border-line pt-5">
        <p className="text-sm text-muted">Projected monthly revenue</p>
        <div className="mt-1 flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <span className="text-[2.75rem] font-heavy leading-none tracking-tighter text-accent sm:text-5xl">{money(revenue, currency)}</span>
          <Delta label={moneyDelta(dRevenue, currency)} direction={directionOf(s.deltas.revenue, 500)} good={s.deltas.revenue >= 0} size="md" />
        </div>

        <div className="mt-5 space-y-2.5" role="img" aria-label={`Current revenue ${money(s.baseline.revenue, currency)}, simulated ${money(s.projected.revenue, currency)}`}>
          {[
            { label: "Current", value: s.baseline.revenue, cls: "bg-chart-2" },
            { label: "Simulated", value: s.projected.revenue, cls: "bg-ink" },
          ].map((b) => (
            <div key={b.label} className="grid grid-cols-[4.75rem_1fr_3.75rem] items-center gap-3 text-sm">
              <span className="text-muted">{b.label}</span>
              <span className="h-2.5 rounded-full bg-sunken">
                <span className={`block h-full rounded-full ${b.cls} transition-[width] duration-300 ease-out`} style={{ width: `${(b.value / max) * 100}%` }} />
              </span>
              <span className="num-col text-right text-ink">{money(b.value, currency)}</span>
            </div>
          ))}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-3 gap-y-4 rounded-2xl bg-canvas p-4 sm:grid-cols-4">
          <div>
            <dt className="text-xs text-muted">Profit</dt>
            <dd className={`mt-1 font-heavy ${s.deltas.profit >= 0 ? "text-positive-text" : "text-negative-text"}`}>{moneyDelta(s.deltas.profit, currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Customers</dt>
            <dd className="mt-1 font-heavy text-ink">{s.baseline.customers ? pctDelta(s.deltas.customersPct) : "–"}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Confidence</dt>
            <dd className="mt-1 font-heavy text-ink">{s.confidence}%</dd>
          </div>
          <div>
            <dt className="text-xs text-muted">Risk</dt>
            <dd className="mt-1 font-heavy text-ink">{s.risk}</dd>
          </div>
        </dl>
      </div>

      <div className="mt-5 flex flex-col gap-3 text-[13px] text-muted sm:flex-row sm:items-center sm:justify-between">
        <p>
          AI estimate for {company}, a sample company. Not a guaranteed outcome.
        </p>
        <Link href="/signup" className="inline-flex shrink-0 items-center gap-1 font-heavy text-ink hover:underline">
          Run it on your data <ArrowRight size={14} aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}
