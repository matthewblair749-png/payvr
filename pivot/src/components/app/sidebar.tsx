"use client";

import { ChevronsUpDown, LogOut, Menu, Settings, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Logo } from "@/components/brand/logo";
import { Avatar } from "@/components/ui/avatar";
import { ButtonLink } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { logout } from "@/server/auth/actions";
import { switchWorkspace } from "@/server/workspace-actions";
import { NAV, isActive } from "./nav";

export interface ShellInfo {
  mode: "app" | "demo";
  basePath: string;
  companyName: string;
  companies: { id: string; name: string }[];
  companyId: string;
  planLabel: string;
  user: { name: string; email: string } | null;
  badges: { insights: number };
}

function NavList({ info, onNavigate }: { info: ShellInfo; onNavigate?: () => void }) {
  const pathname = usePathname();
  return (
    <ul className="space-y-0.5">
      {NAV.map((item) => {
        const active = isActive(pathname, info.basePath, item.href);
        const badge = item.badge ? info.badges[item.badge] : 0;
        return (
          <li key={item.label}>
            <Link
              href={info.basePath + item.href}
              onClick={onNavigate}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex h-10 items-center gap-3 rounded-xl px-3 text-[15px] transition-colors",
                active ? "bg-sunken font-heavy text-ink" : "text-ink-2 hover:bg-sunken/70 hover:text-ink",
              )}
            >
              <item.icon size={18} strokeWidth={active ? 2.4 : 2} aria-hidden="true" />
              <span className="flex-1">{item.label}</span>
              {badge > 0 && (
                <span className="grid h-5 min-w-5 place-items-center rounded-full bg-negative px-1.5 text-[11px] font-heavy text-white" aria-label={`${badge} need action`}>
                  {badge}
                </span>
              )}
            </Link>
          </li>
        );
      })}
    </ul>
  );
}

function WorkspaceName({ info }: { info: ShellInfo }) {
  const [open, setOpen] = useState(false);
  const multi = info.companies.length > 1;
  return (
    <div className="relative">
      <button
        type="button"
        disabled={!multi}
        onClick={() => setOpen((o) => !o)}
        aria-expanded={multi ? open : undefined}
        className="flex w-full items-center gap-3 rounded-xl border border-line p-2.5 text-left enabled:hover:bg-sunken"
      >
        <Avatar name={info.companyName} size={32} className="rounded-lg" />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-heavy text-ink">{info.companyName}</span>
          <span className="block truncate text-xs text-muted">{info.planLabel}</span>
        </span>
        {multi && <ChevronsUpDown size={16} className="text-muted" aria-hidden="true" />}
      </button>
      {open && multi && (
        <ul className="absolute inset-x-0 top-full z-20 mt-1 rounded-xl border border-line bg-surface p-1 shadow-raise">
          {info.companies.map((c) => (
            <li key={c.id}>
              <form action={switchWorkspace.bind(null, c.id)}>
                <button type="submit" className={cn("w-full rounded-lg px-3 py-2 text-left text-sm hover:bg-sunken", c.id === info.companyId ? "font-heavy text-ink" : "text-ink-2")}>
                  {c.name}
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Account({ info }: { info: ShellInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", close);
    return () => document.removeEventListener("mousedown", close);
  }, [open]);

  if (info.mode === "demo") {
    return (
      <div className="rounded-2xl bg-canvas p-4">
        <p className="text-sm font-heavy text-ink">You&apos;re in the demo</p>
        <p className="mt-1 text-[13px] leading-snug text-muted">Northstar Commerce is a sample company. Try PIVOT on your own data.</p>
        <ButtonLink href={info.user ? "/app" : "/signup"} variant="primary" size="sm" className="mt-3 w-full">
          {info.user ? "Go to my workspace" : "Create your workspace"}
        </ButtonLink>
      </div>
    );
  }
  if (!info.user) return null;
  return (
    <div className="relative" ref={ref}>
      {open && (
        <div className="absolute inset-x-0 bottom-full mb-2 rounded-xl border border-line bg-surface p-1 shadow-raise" role="menu">
          <Link href="/app/settings" role="menuitem" onClick={() => setOpen(false)} className="flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
            <Settings size={16} aria-hidden="true" /> Settings
          </Link>
          <form action={logout}>
            <button type="submit" role="menuitem" className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-sm text-ink-2 hover:bg-sunken hover:text-ink">
              <LogOut size={16} aria-hidden="true" /> Log out
            </button>
          </form>
        </div>
      )}
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} aria-haspopup="menu" className="flex w-full items-center gap-3 rounded-xl p-2 text-left hover:bg-sunken">
        <Avatar name={info.user.name} size={34} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-heavy text-ink">{info.user.name}</span>
          <span className="block truncate text-xs text-muted">{info.user.email}</span>
        </span>
        <ChevronsUpDown size={16} className="text-muted" aria-hidden="true" />
      </button>
    </div>
  );
}

export function Sidebar({ info }: { info: ShellInfo }) {
  return (
    <aside className="no-print fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-line bg-surface lg:flex" aria-label="Sidebar">
      <div className="flex h-16 items-center px-5">
        <Link href={info.mode === "demo" ? "/" : "/app"} aria-label="PIVOT" className="rounded-lg">
          <Logo size={28} />
        </Link>
      </div>
      <div className="px-3">
        <WorkspaceName info={info} />
      </div>
      <nav aria-label="Main" className="mt-4 flex-1 overflow-y-auto px-3">
        <NavList info={info} />
      </nav>
      <div className="border-t border-line p-3">
        <Account info={info} />
      </div>
    </aside>
  );
}

/**
 * Phones and tablets: the sidebar becomes a menu sheet. It's a native modal
 * <dialog>, so it renders in the top layer (the blurred sticky header would
 * otherwise clip a fixed overlay to its own 64px), and the browser traps
 * focus, closes on Escape and returns focus to the menu button.
 */
export function MobileNav({ info }: { info: ShellInfo }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);
  if (pathname !== lastPath) {
    setLastPath(pathname);
    setOpen(false);
  }
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
    if (!open) return;
    document.body.style.overflow = "hidden";
    // The sheet is hidden at desktop widths: close it there so the page isn't left inert.
    const desktop = window.matchMedia("(min-width: 1024px)");
    const onWide = () => desktop.matches && setOpen(false);
    desktop.addEventListener("change", onWide);
    return () => {
      document.body.style.overflow = "";
      desktop.removeEventListener("change", onWide);
    };
  }, [open]);

  return (
    <>
      <button type="button" onClick={() => setOpen(true)} aria-label="Open menu" aria-expanded={open} aria-controls="mobile-menu" className="grid size-10 place-items-center rounded-xl text-ink hover:bg-sunken lg:hidden">
        <Menu size={22} aria-hidden="true" />
      </button>
      <dialog
        id="mobile-menu"
        ref={ref}
        aria-label="Menu"
        onClose={() => setOpen(false)}
        onClick={(e) => e.target === ref.current && setOpen(false)}
        className="anim-sheet-in fixed inset-y-0 left-0 right-auto m-0 h-dvh max-h-dvh w-[86%] max-w-80 bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/30 lg:hidden"
      >
        {open && (
          <div className="flex h-full flex-col">
            <div className="flex h-16 shrink-0 items-center justify-between px-4">
              <Logo size={28} />
              <button type="button" onClick={() => setOpen(false)} aria-label="Close menu" className="grid size-10 place-items-center rounded-xl text-ink hover:bg-sunken">
                <X size={22} aria-hidden="true" />
              </button>
            </div>
            <div className="px-3">
              <WorkspaceName info={info} />
            </div>
            <nav aria-label="Main" className="mt-4 min-h-0 flex-1 overflow-y-auto px-3">
              <NavList info={info} onNavigate={() => setOpen(false)} />
            </nav>
            <div className="border-t border-line p-3">
              <Account info={info} />
            </div>
          </div>
        )}
      </dialog>
    </>
  );
}
