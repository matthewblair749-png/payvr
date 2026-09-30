import Link from "next/link";
import { Logo, LogoMark } from "@/components/brand/logo";

export function ClosingCta() {
  return (
    <section aria-labelledby="closing-title" className="on-orange bg-orange py-24 text-center sm:py-28">
      <div className="mx-auto flex max-w-3xl flex-col items-center px-5">
        <LogoMark variant="inverted" size={72} title="" />
        <h2
          id="closing-title"
          className="mt-6 font-display text-[clamp(2.5rem,7vw,5rem)] font-bold leading-[0.95] tracking-[-0.05em] text-white"
        >
          Make it yours.
        </h2>
        <p className="mt-4 text-lg text-ink">Five minutes to a checkout you&apos;re proud of. Free while you&apos;re in test mode.</p>
        <Link
          href="/studio"
          className="mt-8 rounded-full bg-ink px-8 py-4 text-lg font-semibold text-white shadow-lift transition-transform duration-200 ease-[var(--ease-spring)] hover:-translate-y-1"
        >
          Open the studio
        </Link>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="bg-white">
      <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-4 px-5 py-10 text-sm text-muted sm:flex-row sm:items-center sm:px-8">
        <Logo size={28} wordmarkClassName="text-[1.4rem] text-ink" />
        <p>Payments processed by Stripe. lumen never sees your customers&apos; card numbers.</p>
        <p>© {new Date().getFullYear()} lumen</p>
      </div>
    </footer>
  );
}
