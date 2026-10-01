'use client';

import { CalendarDays, Menu, Monitor, Moon, Search, Sun } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Kbd } from '@/components/ui/kbd';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { RANGES, type RangeKey, useFilters } from '@/lib/filters';
import { useLiveSales } from '@/lib/live';
import type { ThemePref } from '@/lib/prefs';
import { useTheme } from '@/lib/theme';

export function TopBar({ onSearch, onMenu }: { onSearch: () => void; onMenu: () => void }) {
  return (
    <header className="sticky top-0 z-30 border-b border-hairline bg-page/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1200px] items-center gap-2 px-4 sm:gap-3 sm:px-6 lg:px-10">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={onMenu} aria-label="Open navigation">
          <Menu className="size-5" aria-hidden />
        </Button>

        <button
          type="button"
          onClick={onSearch}
          aria-label="Search (Command K)"
          aria-keyshortcuts="Meta+K Control+K"
          className="group inline-flex h-10 min-w-0 flex-1 items-center gap-2.5 rounded-[var(--radius-control)] border border-hairline bg-surface px-3 text-sm text-muted shadow-card hover:text-text sm:max-w-[420px]">
          <Search className="size-4 shrink-0" aria-hidden />
          <span className="truncate">
            Search<span className="hidden sm:inline"> payments, customers or ask a question</span>
          </span>
          <Kbd className="ml-auto hidden sm:inline-flex">⌘K</Kbd>
        </button>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          <LivePulse />
          <RangePicker />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}

/** A quiet pulse that only appears when sales are actually happening. */
function LivePulse() {
  const { live, recent } = useLiveSales();
  if (!live) return null;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span
          tabIndex={0}
          role="status"
          aria-label={`Live: ${recent} sales in the last 10 minutes`}
          className="inline-flex h-8 items-center gap-2 rounded-full border-hairline bg-surface px-1.5 text-xs font-medium text-text sm:border sm:px-3">
          <span className="relative grid size-2 place-items-center" aria-hidden>
            <span className="absolute inset-0 rounded-full bg-success motion-safe:animate-[live-ping_2.4s_var(--ease-out)_infinite]" />
            <span className="relative size-2 rounded-full bg-success" />
          </span>
          <span className="hidden sm:inline">Live</span>
        </span>
      </TooltipTrigger>
      <TooltipContent>{recent} sales in the last 10 minutes</TooltipContent>
    </Tooltip>
  );
}

function RangePicker() {
  const { range, setRange } = useFilters();
  return (
    <Select value={range} onValueChange={(v) => setRange(v as RangeKey)}>
      <SelectTrigger aria-label="Date range" className="w-auto sm:min-w-[156px]">
        <CalendarDays className="text-muted" aria-hidden />
        <span className="hidden sm:inline">
          <SelectValue />
        </span>
      </SelectTrigger>
      <SelectContent align="end">
        {RANGES.map((r) => (
          <SelectItem key={r.key} value={r.key}>
            {r.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

const THEME_ICON = { system: Monitor, light: Sun, dark: Moon } as const;

function ThemeToggle() {
  const { pref, setPref } = useTheme();
  const Icon = THEME_ICON[pref];
  return (
    <Select value={pref} onValueChange={(v) => setPref(v as ThemePref)}>
      <SelectTrigger aria-label={`Theme: ${pref}`} hideChevron className="w-10 justify-center px-0">
        <Icon aria-hidden />
      </SelectTrigger>
      <SelectContent align="end" className="min-w-[160px]">
        <SelectItem value="system">System</SelectItem>
        <SelectItem value="light">Light</SelectItem>
        <SelectItem value="dark">Dark</SelectItem>
      </SelectContent>
    </Select>
  );
}
