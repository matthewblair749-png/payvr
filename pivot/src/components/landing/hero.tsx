import { ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";
import { HERO } from "@/content/landing";
import type { Baseline } from "@/lib/engine/types";
import { HeroSimulator } from "./hero-simulator";

/**
 * The hero. The one orchestrated motion on the page happens here, in CSS:
 * the compass needle turns to the next move, the headline rises, and the
 * live simulator settles in. Everything below stays still.
 */
export function Hero({ baseline, company, currency }: { baseline: Baseline; company: string; currency: string }) {
  return (
    <section className="border-b border-line">
      <div className="mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pb-20 sm:pt-16 lg:grid lg:grid-cols-12 lg:items-center lg:gap-14 lg:pb-24 lg:pt-20">
        <div className="lg:col-span-6">
          <h1 aria-label={`PIVOT. ${HERO.tagline}`}>
            <span className="hidden items-center gap-3 sm:flex" aria-hidden="true">
              <LogoMark size={44} animate />
              <span className="text-[1.625rem] font-heavy leading-none tracking-[0.04em] text-ink">PIVOT</span>
            </span>
            <span className="block text-[3.4rem] sm:mt-6 font-heavy leading-[0.94] tracking-tightest text-ink sm:text-7xl lg:text-[5.5rem]" aria-hidden="true">
              <span className="block overflow-hidden pb-[0.06em]">
                <span className="anim-line">Find the</span>
              </span>
              <span className="block overflow-hidden pb-[0.08em]">
                <span className="anim-line" style={{ animationDelay: "90ms" }}>
                  next move.
                </span>
              </span>
            </span>
          </h1>
          <p className="anim-rise mt-6 text-[1.375rem] leading-snug text-ink sm:text-2xl" style={{ animationDelay: "160ms" }}>
            {HERO.subtitle}
          </p>
          <p className="anim-rise mt-3 max-w-xl text-[17px] leading-relaxed text-muted" style={{ animationDelay: "200ms" }}>
            {HERO.supporting}
          </p>
          <div className="anim-rise mt-8 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: "240ms" }}>
            <ButtonLink href="/signup" variant="accent" size="xl" className="w-full sm:w-auto">
              {HERO.primaryCta}
              <ArrowRight size={19} strokeWidth={2.5} aria-hidden="true" />
            </ButtonLink>
            <ButtonLink href="#how-it-works" variant="secondary" size="xl" className="h-13 w-full sm:h-[3.75rem] sm:w-auto">
              {HERO.secondaryCta}
            </ButtonLink>
          </div>
          <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-2 text-sm text-muted">
            {HERO.reassurance.map((r) => (
              <li key={r} className="inline-flex items-center gap-1.5">
                <Check size={15} strokeWidth={2.5} className="text-ink" aria-hidden="true" />
                {r}
              </li>
            ))}
            <li className="inline-flex items-center gap-1.5">
              <Check size={15} strokeWidth={2.5} className="text-ink" aria-hidden="true" />
              <span>
                <Link href="/demo" className="text-ink underline decoration-line-strong underline-offset-4 hover:decoration-ink">
                  Explore the demo
                </Link>{" "}
                without signing up
              </span>
            </li>
          </ul>
        </div>
        <div className="mt-10 lg:col-span-6 lg:mt-0">
          <HeroSimulator baseline={baseline} company={company} currency={currency} />
        </div>
      </div>
    </section>
  );
}
