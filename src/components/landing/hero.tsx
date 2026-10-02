import Link from "next/link";
import { ArrowDown } from "lucide-react";
import { Logo, LogoMark } from "@/components/brand/logo";

/**
 * Full-bleed orange hero. Server-rendered with CSS-only entrance animations so
 * the wordmark (our LCP element) paints immediately — no waiting on hydration.
 */
export function Hero() {
  return (
    <section className="on-orange relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-orange text-white">
      <Sparks />
      <header className="relative z-10 mx-auto flex w-full max-w-7xl items-center justify-between px-5 py-5 sm:px-8">
        <Link href="/" aria-label="lumen home" className="rounded-xl">
          <Logo variant="inverted" size={36} wordmarkClassName="text-[1.75rem] text-white" />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <a href="#try" className="hidden rounded-full px-4 py-2 font-medium text-ink hover:bg-white/15 sm:inline-block">
            Studio
          </a>
          <a href="#learns" className="hidden rounded-full px-4 py-2 font-medium text-ink hover:bg-white/15 sm:inline-block">
            Research
          </a>
          <Link
            href="/studio"
            className="rounded-full bg-ink px-5 py-2.5 font-semibold text-white transition-transform duration-200 ease-[var(--ease-spring)] hover:-translate-y-0.5"
          >
            Open studio
          </Link>
        </nav>
      </header>

      <div className="relative z-10 mx-auto flex w-full max-w-7xl flex-1 flex-col items-center justify-center px-5 pb-24 pt-6 text-center sm:px-8">
        <LogoMark variant="inverted" size={112} animated title="" className="drop-shadow-[0_18px_30px_rgb(14_14_16/0.18)] sm:h-[136px] sm:w-[136px]" />
        <h1 className="mt-6 overflow-hidden pb-[0.08em]">
          <span className="anim-rise block font-display text-[clamp(5.5rem,24vw,17rem)] font-bold leading-[0.85] tracking-[-0.06em]">
            lumen
          </span>
          <span className="sr-only"> — </span>
          <span
            className="anim-fade-up mt-3 block font-display text-[clamp(1.75rem,4.6vw,3.25rem)] font-bold leading-tight tracking-[-0.035em] text-ink"
            style={{ animationDelay: "180ms" }}
          >
            The checkout that learns.
          </span>
        </h1>
        <p
          // Rise only, never transparent: this paragraph is the mobile LCP element,
          // and an opacity-0 start would hold LCP until the fade finishes.
          className="anim-rise mt-5 max-w-xl text-lg leading-relaxed text-ink sm:text-xl"
        >
          Design a payment page that looks exactly like your brand. Take payments with Stripe. Then find out why people
          buy — and why they almost didn&apos;t.
        </p>
        <div className="anim-fade-up mt-9 flex flex-wrap items-center justify-center gap-3" style={{ animationDelay: "420ms" }}>
          <a
            href="#try"
            className="group inline-flex items-center gap-2 rounded-full bg-ink px-7 py-4 text-lg font-semibold text-white shadow-lift transition-transform duration-200 ease-[var(--ease-spring)] hover:-translate-y-1"
          >
            Design yours below
            <ArrowDown size={20} aria-hidden="true" className="transition-transform group-hover:translate-y-0.5" />
          </a>
          <span className="text-base font-medium text-ink">No signup. It&apos;s live.</span>
        </div>
      </div>
    </section>
  );
}

/** Flat decorative spark dots drifting in the hero. */
function Sparks() {
  const dots = [
    { l: "8%", t: "22%", s: 18, c: "#FFD84D", d: "0s" },
    { l: "86%", t: "18%", s: 28, c: "#FFD84D", d: "1.2s" },
    { l: "78%", t: "72%", s: 14, c: "#FFFFFF", d: "0.6s" },
    { l: "14%", t: "76%", s: 34, c: "#FFB100", d: "2s" },
    { l: "50%", t: "90%", s: 10, c: "#FFD84D", d: "1.6s" },
  ];
  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0 -z-0">
      {dots.map((d, i) => (
        <span
          key={i}
          className="anim-float absolute rounded-full"
          style={{ left: d.l, top: d.t, width: d.s, height: d.s, background: d.c, animationDelay: d.d }}
        />
      ))}
    </div>
  );
}
