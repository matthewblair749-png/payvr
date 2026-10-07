import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { ButtonLink } from "@/components/ui/button";

const NAV = [
  { href: "#how-it-works", label: "How it works" },
  { href: "#features", label: "Product" },
  { href: "#pricing", label: "Pricing" },
  { href: "/demo", label: "Demo" },
];

export function LandingHeader({ signedIn }: { signedIn: boolean }) {
  return (
    <header className="sticky top-0 z-40 border-b border-line/80 bg-surface/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" aria-label="PIVOT home" className="rounded-lg">
          <Logo size={30} />
        </Link>
        <nav aria-label="Main" className="hidden items-center gap-1 md:flex">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="rounded-full px-3.5 py-2 text-[15px] text-ink-2 hover:bg-sunken hover:text-ink">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="flex items-center gap-1.5">
          {signedIn ? (
            <ButtonLink href="/app" variant="primary" size="sm">
              Open PIVOT
            </ButtonLink>
          ) : (
            <>
              <Link href="/login" className="rounded-full px-3.5 py-2 text-[15px] text-ink-2 hover:bg-sunken hover:text-ink">
                Log in
              </Link>
              <ButtonLink href="/signup" variant="primary" size="sm">
                Get started
              </ButtonLink>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
