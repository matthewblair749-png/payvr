import Link from "next/link";
import { Logo } from "@/components/brand/logo";

export function LandingFooter() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-line bg-canvas">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-12 sm:px-6 md:flex-row md:items-start md:justify-between">
        <div>
          <Logo size={28} />
          <p className="mt-3 text-sm text-muted">Find the next move.</p>
        </div>
        <nav aria-label="Footer" className="grid grid-cols-2 gap-x-14 gap-y-2.5 text-sm sm:grid-cols-3">
          <Link href="/#how-it-works" className="text-ink-2 hover:text-ink">How it works</Link>
          <Link href="/#features" className="text-ink-2 hover:text-ink">Product</Link>
          <Link href="/#pricing" className="text-ink-2 hover:text-ink">Pricing</Link>
          <Link href="/demo" className="text-ink-2 hover:text-ink">Demo</Link>
          <Link href="/#faq" className="text-ink-2 hover:text-ink">FAQ</Link>
          <Link href="/login" className="text-ink-2 hover:text-ink">Log in</Link>
        </nav>
      </div>
      <div className="mx-auto max-w-6xl border-t border-line px-4 py-6 text-xs text-muted sm:px-6">© {year} PIVOT. All rights reserved.</div>
    </footer>
  );
}
