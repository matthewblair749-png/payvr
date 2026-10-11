"use client";

import clsx from "clsx";
import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { Button, ButtonLink } from "@/components/ui/button";
import {
  ANNUAL_MONTHS_CHARGED,
  TEAM_SEATS,
  annualTotal,
  effectiveMonthlyPrice,
  PLANS,
  PRICES_ARE_PLACEHOLDERS,
  type BillingInterval,
  type Plan,
} from "@/config/plans";
import { SIGNUP_HREF } from "@/config/site";
import { Mascot } from "@/features/brand/mascot";
import { describePlan, formatPrice } from "./format";

const FREE_MONTHS = 12 - ANNUAL_MONTHS_CHARGED;

function BillingToggle({ value, onChange }: { value: BillingInterval; onChange: (v: BillingInterval) => void }) {
  return (
    <div role="group" aria-label="Billing period" className="inline-grid grid-cols-2 gap-1 rounded-full border-2 border-ink bg-white p-1">
      {(["monthly", "annual"] as const).map((option) => {
        const selected = value === option;
        return (
          <button
            key={option}
            type="button"
            aria-pressed={selected}
            onClick={() => onChange(option)}
            className={clsx(
              "press relative min-h-12 rounded-full px-5 font-display font-extrabold active:scale-[0.97]",
              selected ? "text-cream" : "text-ink hover:bg-paper",
            )}
          >
            {selected && (
              <motion.span
                layoutId="billing-pill"
                className="absolute inset-0 rounded-full bg-ink"
                transition={{ type: "spring", stiffness: 420, damping: 32 }}
              />
            )}
            <span className="relative">{option === "monthly" ? "Monthly" : "Annual"}</span>
          </button>
        );
      })}
    </div>
  );
}

function PlanCard({ plan, interval }: { plan: Plan; interval: BillingInterval }) {
  const price = effectiveMonthlyPrice(plan, interval);
  const free = plan.monthlyPrice === 0;
  const dark = plan.highlighted;

  return (
    <article
      aria-labelledby={`plan-${plan.id}`}
      className={clsx(
        "flex flex-col rounded-[var(--radius-lg)] border-2 border-ink p-6",
        dark ? "on-dark bg-ink shadow-[0_6px_0_var(--coral)]" : "bg-white shadow-[0_4px_0_var(--ink)]",
      )}
    >
      <div className="flex items-center justify-between gap-2">
        <h2 id={`plan-${plan.id}`} className="text-2xl">
          {plan.name}
        </h2>
        {dark && <span className="rounded-full bg-sun px-3 py-1 text-xs font-bold text-ink">Good place to start</span>}
      </div>
      <p className="mt-2 min-h-[3.2em] text-muted">{plan.blurb}</p>

      <div className="mt-6">
        <p className="font-display text-5xl font-black tabular-nums">{formatPrice(price)}</p>
        <p className="mt-1 font-semibold">{plan.perSeat ? "per person, per month" : "per month"}</p>
        <p className="mt-1 min-h-[3.2em] text-sm text-muted">
          {free
            ? "Free for as long as you like."
            : interval === "annual"
              ? `${formatPrice(annualTotal(plan))} billed once a year${plan.perSeat ? " per person" : ""}`
              : "Billed monthly. Cancel anytime."}
        </p>
      </div>

      {free ? (
        <ButtonLink href={SIGNUP_HREF} variant="outline" className="mt-6 w-full">
          Try it free
        </ButtonLink>
      ) : (
        // A plain form post: works without JavaScript, and the server decides
        // whether to send you to sign-up, Checkout or the billing portal.
        <form action="/api/billing/checkout" method="post" className="mt-6 grid gap-3">
          <input type="hidden" name="plan" value={plan.id} />
          <input type="hidden" name="interval" value={interval} />
          {plan.perSeat && (
            <label className="flex items-center justify-between gap-3 font-semibold">
              <span>People on your team</span>
              <input
                type="number"
                name="seats"
                min={TEAM_SEATS.min}
                max={TEAM_SEATS.max}
                defaultValue={TEAM_SEATS.default}
                required
                className="min-h-11 w-24 rounded-[var(--radius-sm)] border-2 border-line-strong bg-cream px-3 text-right font-bold tabular-nums text-ink hover:border-ink focus-visible:border-ink"
              />
            </label>
          )}
          <Button type="submit" variant={dark ? "primary" : "ink"} className="w-full">
            Choose {plan.name}
          </Button>
        </form>
      )}

      <ul className="mt-6 space-y-2">
        {describePlan(plan).map((line) => (
          <li key={line} className="flex gap-2.5">
            <svg viewBox="0 0 16 16" className="mt-1 size-4 shrink-0 text-coral" aria-hidden>
              <path d="M3 8.5 6.5 12 13 4.5" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {line}
          </li>
        ))}
      </ul>
    </article>
  );
}

/**
 * Billing toggle, mascot and plan cards share one piece of state: the
 * mascot cheers when you switch to annual.
 */
const NOTICES: Record<string, { tone: "info" | "error"; text: string }> = {
  cancelled: { tone: "info", text: "No problem, nothing was charged. Your plan hasn't changed." },
  unavailable: { tone: "error", text: "Upgrades aren't switched on yet. Please check back soon." },
  invalid: { tone: "error", text: "Something about that choice didn't add up. Pick a plan and try again?" },
  error: { tone: "error", text: "We couldn't reach our payment partner just now. Nothing was charged. Please try again in a minute." },
};

export function PricingPlans({ notice }: { notice?: string }) {
  const message = notice ? NOTICES[notice] : undefined;
  const [interval, setBillingInterval] = useState<BillingInterval>("monthly");
  const annual = interval === "annual";

  return (
    <>
      <div className="wrap grid items-end gap-8 pt-6 sm:pt-10 md:grid-cols-[minmax(0,1fr)_auto]">
        <div>
          <h1 className="text-[2.75rem] sm:text-6xl">Pick a plan. Change your mind anytime.</h1>
          <p className="mt-4 max-w-xl text-lg text-muted">
            Start free. Upgrade when you need more, drop back down when you don&rsquo;t.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-4">
            <BillingToggle value={interval} onChange={setBillingInterval} />
            <span className={clsx("text-sm font-bold transition-colors", annual ? "text-coral-text" : "text-muted")}>
              Annual: {FREE_MONTHS} months free
            </span>
          </div>
        </div>

        <div className="relative -mt-28 ml-auto mr-2 w-[96px] md:mx-auto md:mr-8 md:mt-0 md:w-[150px]" aria-live="polite">
          <AnimatePresence>
            {annual && (
              <motion.p
                key="cheer"
                initial={{ opacity: 0, scale: 0.8, y: 8 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 4 }}
                transition={{ type: "spring", stiffness: 400, damping: 22 }}
                className="absolute -left-24 top-2 z-10 rounded-2xl rounded-br-sm border-2 border-ink bg-white px-3 py-2 text-sm font-bold md:-left-32"
              >
                {FREE_MONTHS} months on us!
              </motion.p>
            )}
          </AnimatePresence>
          <Mascot mood={annual ? "happy" : "idle"} label={annual ? "The Babel mascot, cheering" : "The Babel mascot, waving"} />
        </div>
      </div>

      {message && (
        <p role="status" className="wrap mt-8 font-semibold">
          <span className={clsx("block rounded-[var(--radius)] px-4 py-3", message.tone === "error" ? "bg-coral-tint" : "bg-paper")}>
            {message.text}
          </span>
        </p>
      )}

      <section aria-label="Plans" className="wrap mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {PLANS.map((plan) => (
          <PlanCard key={plan.id} plan={plan} interval={interval} />
        ))}
      </section>

      <p className="wrap mt-6 text-sm text-muted">
        Prices in US dollars. Local taxes may apply.
        {PRICES_ARE_PLACEHOLDERS && " Prices and limits are placeholders until launch."}
      </p>
    </>
  );
}
