"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/studio", label: "Checkouts" },
  { href: "/studio/dashboard", label: "Dashboard" },
  { href: "/studio/research", label: "Research" },
  { href: "/studio/experiments", label: "Experiments" },
  { href: "/studio/orders", label: "Orders" },
  { href: "/studio/payments", label: "Payments" },
];

export function StudioNav() {
  const path = usePathname();
  return (
    <nav aria-label="Studio" className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 [scrollbar-width:none]">
      {LINKS.map((l) => {
        const active = l.href === "/studio" ? path === "/studio" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className="shrink-0 rounded-full px-3 py-2 text-sm font-semibold text-muted-strong hover:text-ink aria-[current=page]:bg-surface aria-[current=page]:text-ink"
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
