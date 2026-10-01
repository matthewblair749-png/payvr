"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";
import { NAV, parseRange, withRange } from "./nav";

/**
 * The job-based nav. In "rail" mode labels become hover/focus tooltips; the
 * accessible name never changes. The selected item is the one orange thing
 * in the sidebar.
 */
export function NavList({ rail, onNavigate }: { rail: "never" | "responsive" | "always"; onNavigate?: () => void }) {
  const path = usePathname();
  const range = parseRange(useSearchParams().get("range"));
  // Labels: always shown in the drawer; in the sidebar, hidden on the md rail
  // and when the merchant collapsed it (data-collapsed on the shell root).
  const labelCls =
    rail === "never" ? "" : rail === "always" ? "sr-only" : "max-lg:sr-only lg:group-data-[collapsed=true]/shell:sr-only";
  const tipCls = rail === "responsive" ? "lg:group-data-[collapsed=false]/shell:hidden" : "";

  return (
    <ul className="space-y-1">
      {NAV.map((item) => {
        const active = item.match(path);
        const Icon = item.icon;
        return (
          <li key={item.href} className="group/item relative">
            <Link
              href={withRange(item.href, range)}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex h-10 items-center gap-3 rounded-control px-3 text-ui font-medium text-app-muted transition-colors hover:bg-app-sunken hover:text-app-fg",
                "aria-[current=page]:bg-app-accent-soft aria-[current=page]:font-semibold aria-[current=page]:text-app-fg",
              )}
            >
              {active && <span aria-hidden="true" className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-app-accent" />}
              <Icon size={18} aria-hidden="true" className={cn("shrink-0", active && "text-app-accent")} />
              <span className={cn("truncate", labelCls)}>{item.label}</span>
            </Link>
            {/* Visual tooltip for the collapsed rail (the link's name comes from the label above). */}
            {rail !== "never" && (
            <span
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-control bg-app-fg px-2.5 py-1.5 text-cap font-semibold text-app-page shadow-pop",
                "group-hover/item:block group-has-[:focus-visible]/item:block",
                tipCls,
              )}
            >
              {item.label}
            </span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
