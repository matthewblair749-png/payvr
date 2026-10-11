import Link from "next/link";
import { ButtonLink } from "@/components/ui/button";
import { SIGNUP_HREF } from "@/config/site";
import { Logo } from "@/features/brand/logo";

export function SiteHeader() {
  return (
    <header className="wrap flex items-center justify-between gap-4 py-4">
      <Link href="/" className="press -mx-2 inline-flex min-h-11 items-center rounded-lg px-2" aria-label="babel, home">
        <Logo />
      </Link>
      <nav aria-label="Main" className="flex items-center gap-1 sm:gap-3">
        <Link
          href="/pricing"
          className="press inline-flex min-h-11 items-center rounded-full px-3 font-bold text-ink underline-offset-4 hover:underline active:scale-[0.97]"
        >
          Pricing
        </Link>
        <Link
          href="/signin"
          className="press inline-flex min-h-11 items-center rounded-full px-3 font-bold text-ink underline-offset-4 hover:underline active:scale-[0.97]"
        >
          Sign in
        </Link>
        {/* The hero has its own button on phones; keep the header roomy there. */}
        <span className="hidden sm:block">
          <ButtonLink href={SIGNUP_HREF}>Try it free</ButtonLink>
        </span>
      </nav>
    </header>
  );
}
