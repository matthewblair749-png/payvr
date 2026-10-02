"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, Menu, PanelLeftClose, PanelLeftOpen, X } from "lucide-react";
import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { LogoMark, Wordmark } from "@/components/brand/logo";
import { cn } from "@/lib/utils";
import { CommandPalette, SearchTrigger } from "./command-palette";
import { DateRange } from "./date-range";
import { TZ_COOKIE } from "./greeting";
import { LiveIndicator } from "./live-indicator";
import { setCookie, SIDEBAR_COOKIE, type ThemePref } from "./nav";
import { NavList } from "./nav-list";
import { QueryProvider } from "./query-provider";
import { ThemeToggle } from "./theme-toggle";

type Account = { name: string; email: string };

/**
 * The merchant app frame.
 * - ≥1024px: sidebar, 240px or a 72px rail (the merchant's choice, kept in a
 *   cookie so the first paint already has the right width: no layout shift).
 * - 768–1023px: always the 72px rail.
 * - <768px: the sidebar becomes a drawer behind a menu button.
 */
export function AppShell({
  children,
  account,
  initialCollapsed,
  theme,
  signOut,
  mac,
}: {
  children: ReactNode;
  account: Account;
  initialCollapsed: boolean;
  theme: ThemePref;
  signOut: () => Promise<void>;
  /** From the request's user-agent, so the shortcut hint is right on first paint. */
  mac: boolean;
}) {
  const [collapsed, setCollapsed] = useState(initialCollapsed);
  const [drawer, setDrawer] = useState(false);
  const [search, setSearch] = useState(false);

  // Tell the server our timezone (for the greeting and "yesterday" in the brief).
  const router = useRouter();
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz && !document.cookie.includes(`${TZ_COOKIE}=${encodeURIComponent(tz)}`)) {
      setCookie(TZ_COOKIE, encodeURIComponent(tz));
      router.refresh(); // first visit: re-render the greeting in local time
    }
  }, [router]);

  function toggle() {
    setCollapsed((c) => {
      setCookie(SIDEBAR_COOKIE, c ? "open" : "collapsed");
      return !c;
    });
  }

  return (
    <QueryProvider>
      <div className="app-shell group/shell min-h-dvh" data-collapsed={collapsed}>
        {/* ---------------- Sidebar (md and up) ---------------- */}
        <aside
          aria-label="Sidebar"
          className="fixed inset-y-0 left-0 z-30 hidden w-(--app-sidebar-collapsed) flex-col border-r border-app-hairline bg-app-card transition-[width] duration-200 ease-(--app-ease-out) motion-reduce:transition-none md:flex lg:w-(--app-sidebar) lg:group-data-[collapsed=true]/shell:w-(--app-sidebar-collapsed)"
        >
          <div className="flex h-(--app-topbar) shrink-0 items-center gap-2.5 px-[18px]">
            <Link href="/studio" aria-label="lumen home" className="flex items-center gap-2.5 rounded-control">
              <LogoMark size={36} title="" />
              <Wordmark className="text-[1.375rem] max-lg:hidden lg:group-data-[collapsed=true]/shell:hidden" />
            </Link>
          </div>
          {/* No overflow clipping here: the rail's tooltips extend past the edge. */}
          <nav aria-label="Main" className="flex-1 px-[14px] py-3">
            <Suspense>
              <NavList rail="responsive" />
            </Suspense>
          </nav>
          <div className="border-t border-app-hairline p-[14px]">
            <AccountRow account={account} signOut={signOut} rail="responsive" />
            <button
              type="button"
              onClick={toggle}
              aria-expanded={!collapsed}
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              className="mt-1 hidden h-9 w-full items-center gap-3 rounded-control px-3 text-ui text-app-muted hover:bg-app-sunken hover:text-app-fg lg:flex"
            >
              {collapsed ? <PanelLeftOpen size={18} aria-hidden="true" /> : <PanelLeftClose size={18} aria-hidden="true" />}
              <span className="group-data-[collapsed=true]/shell:hidden">Collapse</span>
            </button>
          </div>
        </aside>

        <MobileDrawer open={drawer} onClose={() => setDrawer(false)} account={account} signOut={signOut} />

        {/* ---------------- Top bar + page ---------------- */}
        <div className="transition-[padding] duration-200 ease-(--app-ease-out) motion-reduce:transition-none md:pl-(--app-sidebar-collapsed) lg:pl-(--app-sidebar) lg:group-data-[collapsed=true]/shell:pl-(--app-sidebar-collapsed)">
          <header className="sticky top-0 z-20 border-b border-app-hairline bg-app-page/85 backdrop-blur supports-[backdrop-filter]:bg-app-page/75">
            <div className="mx-auto flex h-(--app-topbar) max-w-[1280px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-10">
              <button
                type="button"
                onClick={() => setDrawer(true)}
                aria-label="Open menu"
                aria-expanded={drawer}
                className="grid size-9 shrink-0 place-items-center rounded-control text-app-fg hover:bg-app-sunken md:hidden"
              >
                <Menu size={20} aria-hidden="true" />
              </button>
              <SearchTrigger onOpen={() => setSearch(true)} mac={mac} />
              <div className="ml-auto flex items-center gap-1 sm:gap-2">
                <LiveIndicator />
                <Suspense>
                  <DateRange />
                </Suspense>
                <ThemeToggle initial={theme} />
              </div>
            </div>
          </header>
          <main id="main" tabIndex={-1} className="mx-auto max-w-[1280px] px-4 py-8 outline-none sm:px-6 lg:px-10 lg:py-10">
            {children}
          </main>
        </div>
        <CommandPalette open={search} onOpenChange={setSearch} />
      </div>
    </QueryProvider>
  );
}

function AccountRow({ account, signOut, rail }: { account: Account; signOut: () => Promise<void>; rail: "never" | "responsive" }) {
  const hide = rail === "responsive" ? "max-lg:hidden lg:group-data-[collapsed=true]/shell:hidden" : "";
  return (
    <div className={cn("flex items-center gap-3 rounded-control px-1.5 py-1.5", rail === "responsive" && "max-lg:flex-col lg:group-data-[collapsed=true]/shell:flex-col")}>
      <span aria-hidden="true" className="grid size-8 shrink-0 place-items-center rounded-full bg-app-sunken text-ui font-semibold text-app-fg">
        {account.name.charAt(0).toUpperCase()}
      </span>
      <span className={cn("min-w-0 flex-1", hide)}>
        <span className="block truncate text-ui font-semibold">{account.name}</span>
        <span className="block truncate text-cap text-app-muted">{account.email}</span>
      </span>
      <form action={signOut}>
        <button
          type="submit"
          aria-label="Sign out"
          title="Sign out"
          className="grid size-8 place-items-center rounded-control text-app-muted hover:bg-app-sunken hover:text-app-fg"
        >
          <LogOut size={16} aria-hidden="true" />
        </button>
      </form>
    </div>
  );
}

function MobileDrawer({ open, onClose, account, signOut }: { open: boolean; onClose: () => void; account: Account; signOut: () => Promise<void> }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      aria-label="Menu"
      onClose={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-0 h-dvh max-h-none w-[min(300px,85vw)] border-r border-app-hairline bg-app-card p-0 text-app-fg backdrop:bg-(--app-scrim) md:hidden"
    >
      {open && (
        <div className="flex h-full flex-col">
          <div className="flex h-(--app-topbar) items-center justify-between px-[18px]">
            <span className="flex items-center gap-2.5">
              <LogoMark size={32} title="" />
              <Wordmark className="text-[1.375rem]" />
            </span>
            <button type="button" onClick={onClose} aria-label="Close menu" className="grid size-9 place-items-center rounded-control hover:bg-app-sunken">
              <X size={20} aria-hidden="true" />
            </button>
          </div>
          <nav aria-label="Main" className="flex-1 overflow-y-auto px-[14px] py-3">
            <Suspense>
              <NavList rail="never" onNavigate={onClose} />
            </Suspense>
          </nav>
          <div className="border-t border-app-hairline p-[14px]">
            <AccountRow account={account} signOut={signOut} rail="never" />
          </div>
        </div>
      )}
    </dialog>
  );
}
