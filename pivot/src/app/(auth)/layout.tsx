import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { getDemo } from "@/lib/demo";

/** Auth pages: the form on the left; on desktop, a live insight from the demo on the right. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  const { analysis } = getDemo();
  const insight = analysis.insights[0];
  const rec = analysis.recommendations[0];
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <div className="flex flex-col px-4 py-6 sm:px-8">
        <header>
          <Link href="/" aria-label="PIVOT home" className="inline-block rounded-lg">
            <Logo size={30} />
          </Link>
        </header>
        <main id="main" className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-10">
          {children}
        </main>
        <footer className="text-center text-xs text-muted lg:text-left">© {new Date().getFullYear()} PIVOT</footer>
      </div>
      <aside className="hidden bg-ink p-10 text-white lg:flex lg:flex-col lg:justify-between" aria-label="What PIVOT does">
        <p className="text-[12px] font-heavy uppercase tracking-[0.1em] text-white/60">Live from the Northstar Commerce demo</p>
        {insight && rec && (
          <div className="max-w-md">
            <p className="text-[12px] font-heavy uppercase tracking-[0.1em] text-white/60">What changed</p>
            <p className="mt-3 text-3xl font-heavy leading-tight tracking-tight">{insight.what}</p>
            <p className="mt-4 text-[15px] leading-relaxed text-white/75">{insight.why}</p>
            <div className="mt-10 rounded-2xl border border-white/15 p-5">
              <p className="text-[12px] font-heavy uppercase tracking-[0.1em] text-white/60">Recommended next move</p>
              <p className="mt-2 text-xl font-heavy">{rec.title}</p>
              <p className="mt-1 text-sm text-white/70">
                Impact {rec.impact.toLowerCase()} · Difficulty {rec.difficulty.toLowerCase()} · Risk {rec.risk.toLowerCase()}
              </p>
            </div>
          </div>
        )}
        <p className="text-sm text-white/60">Find the next move.</p>
      </aside>
    </div>
  );
}
