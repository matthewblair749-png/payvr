"use client";

import clsx from "clsx";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ButtonLink } from "@/components/ui/button";
import { SIGNUP_HREF } from "@/config/site";
import { Logo } from "@/features/brand/logo";

/**
 * Sticky header. Flat and quiet at the top of the page; a hairline and a
 * soft shadow appear once content scrolls under it. No blur, no glass.
 */
export function SiteHeader() {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 4);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={clsx(
        "sticky top-0 z-40 border-b bg-bg transition-[border-color,box-shadow] duration-[var(--dur-base)] ease-out",
        scrolled ? "border-border shadow-soft" : "border-transparent",
      )}
    >
      <div className="wrap flex h-16 items-center justify-between gap-4">
        <Link href="/" className="press -mx-2 inline-flex min-h-11 items-center rounded-md px-2" aria-label="babel, home">
          <Logo />
        </Link>
        <nav aria-label="Main" className="flex items-center gap-1 sm:gap-2">
          <Link
            href="/pricing"
            className="press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-fg-2 hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-fg sm:px-4 sm:text-base"
          >
            Pricing
          </Link>
          <Link
            href="/signin"
            className="press inline-flex min-h-11 items-center rounded-full px-3 text-sm font-bold text-fg-2 hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] hover:text-fg sm:px-4 sm:text-base"
          >
            Sign in
          </Link>
          {/* The hero has its own button on phones; keep the header roomy there. */}
          <span className="hidden sm:block">
            <ButtonLink href={SIGNUP_HREF} size="sm">
              Try it free
            </ButtonLink>
          </span>
        </nav>
      </div>
    </header>
  );
}
