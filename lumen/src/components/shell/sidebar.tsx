'use client';

import { PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { useHtmlData } from '@/lib/html-attr';
import { NAV, NAV_FOOTER, type NavItem } from '@/lib/nav';
import { PREF_KEYS, writePref } from '@/lib/prefs';
import { cn } from '@/lib/utils';

import { LumenMark, Wordmark } from './logo';

/** Collapsed state lives on <html data-sidebar>, set before paint, so the width never jumps. */
function useCollapsed() {
  const collapsed = useHtmlData('sidebar') === 'collapsed';
  const toggle = () => {
    const next = !collapsed;
    if (next) document.documentElement.dataset.sidebar = 'collapsed';
    else delete document.documentElement.dataset.sidebar;
    writePref(PREF_KEYS.sidebar, next ? 'collapsed' : 'expanded');
  };
  return { collapsed, toggle };
}

export function isActive(pathname: string, href: string) {
  return href === '/' ? pathname === '/' : pathname === href || pathname.startsWith(`${href}/`);
}

/** Desktop sidebar: 240px, collapses to a 72px icon rail. Hidden below lg (see MobileNav). */
export function Sidebar() {
  const { collapsed, toggle } = useCollapsed();
  return (
    <aside className="app-sidebar sticky top-0 hidden h-dvh shrink-0 flex-col border-r border-hairline bg-surface lg:flex" aria-label="Main">
      <div className="flex h-16 items-center gap-2.5 px-5 sidebar-collapsed:justify-center sidebar-collapsed:px-0">
        <LumenMark />
        <Wordmark className="sidebar-collapsed:hidden" />
      </div>

      <NavList items={NAV} collapsed={collapsed} className="mt-2 flex-1" />

      <div className="border-t border-hairline py-3">
        <NavList items={NAV_FOOTER} collapsed={collapsed} />
        <div className="mt-2 flex items-center gap-3 px-5 sidebar-collapsed:justify-center sidebar-collapsed:px-0">
          <span className="grid size-8 shrink-0 place-items-center rounded-full bg-sunken text-xs font-semibold text-text" aria-hidden>
            JC
          </span>
          <div className="min-w-0 flex-1 sidebar-collapsed:hidden">
            <p className="truncate text-sm font-semibold">Juniper &amp; Co.</p>
            <p className="truncate text-xs text-muted">Maya Okafor · Owner</p>
          </div>
        </div>
        <div className="mt-2 px-3 sidebar-collapsed:px-0 sidebar-collapsed:text-center">
          <button
            type="button"
            onClick={toggle}
            aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-expanded={!collapsed}
            className="inline-flex h-9 items-center gap-2 rounded-lg px-2.5 text-sm text-muted hover:bg-sunken hover:text-text">
            {collapsed ? <PanelLeftOpen className="size-4" aria-hidden /> : <PanelLeftClose className="size-4" aria-hidden />}
            <span className="sidebar-collapsed:hidden">Collapse</span>
          </button>
        </div>
      </div>
    </aside>
  );
}

export function NavList({
  items,
  collapsed,
  className,
  onNavigate,
}: {
  items: NavItem[];
  collapsed?: boolean;
  className?: string;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className={className}>
      <ul className="flex flex-col gap-0.5 px-3 sidebar-collapsed:px-2">
        {items.map((item) => {
          const active = isActive(pathname, item.href);
          const link = (
            <Link
              href={item.href}
              onClick={onNavigate}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'group relative flex h-10 items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm font-medium transition-colors sidebar-collapsed:justify-center sidebar-collapsed:px-0',
                active ? 'bg-accent-soft text-text font-semibold' : 'text-muted hover:bg-sunken hover:text-text',
              )}>
              {/* Selected item: orange marker and icon (the label stays ink for contrast). */}
              {active ? <span className="absolute inset-y-2 left-0 w-[3px] rounded-full bg-accent" aria-hidden /> : null}
              <item.icon className={cn('size-[18px] shrink-0', active ? 'text-accent' : '')} aria-hidden />
              <span className="sidebar-collapsed:sr-only">{item.label}</span>
            </Link>
          );
          return (
            <li key={item.href}>
              {collapsed ? (
                <Tooltip>
                  <TooltipTrigger asChild>{link}</TooltipTrigger>
                  <TooltipContent side="right">{item.label}</TooltipContent>
                </Tooltip>
              ) : (
                link
              )}
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
