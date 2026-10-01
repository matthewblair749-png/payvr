import Link from "next/link";
import type { ReactNode } from "react";
import { Logo, LogoMark } from "@/components/brand/logo";

/** Split layout for auth screens: orange brand panel + form. */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-dvh lg:grid-cols-2">
      <aside aria-label="About lumen" className="on-orange relative hidden flex-col justify-between overflow-hidden bg-orange p-10 text-white lg:flex">
        <Link href="/" aria-label="lumen home" className="w-fit">
          <Logo variant="inverted" size={36} wordmarkClassName="text-[1.75rem] text-white" />
        </Link>
        <div>
          <LogoMark variant="inverted" size={96} title="" className="anim-tile-in" />
          <p className="mt-8 max-w-md font-display text-5xl font-bold leading-[0.95] tracking-[-0.05em]">
            The checkout that learns.
          </p>
        </div>
        <p className="text-ink">Payments by Stripe. Card numbers never touch lumen.</p>
      </aside>
      <main id="main" className="flex items-center justify-center bg-white px-5 py-12">
        <div className="w-full max-w-sm">
          <Link href="/" aria-label="lumen home" className="mb-10 inline-block lg:hidden">
            <Logo size={32} />
          </Link>
          {children}
        </div>
      </main>
    </div>
  );
}
