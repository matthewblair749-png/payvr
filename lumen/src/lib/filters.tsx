'use client';

import { createContext, useContext, useMemo, useState } from 'react';

/** Global filters every widget reads (date range now; channel and segment later). */
export type RangeKey = 'today' | '7d' | '30d' | '90d' | 'ytd';

export const RANGES: { key: RangeKey; label: string; compare: string }[] = [
  { key: 'today', label: 'Today', compare: 'vs yesterday' },
  { key: '7d', label: 'Last 7 days', compare: 'vs previous 7 days' },
  { key: '30d', label: 'Last 30 days', compare: 'vs previous 30 days' },
  { key: '90d', label: 'Last 90 days', compare: 'vs previous 90 days' },
  { key: 'ytd', label: 'Year to date', compare: 'vs same period last year' },
];

type Filters = { range: RangeKey; setRange: (r: RangeKey) => void; rangeInfo: (typeof RANGES)[number] };

const Ctx = createContext<Filters | null>(null);

export function FiltersProvider({ children }: { children: React.ReactNode }) {
  const [range, setRange] = useState<RangeKey>('30d');
  const value = useMemo(() => ({ range, setRange, rangeInfo: RANGES.find((r) => r.key === range)! }), [range]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useFilters() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useFilters must be used inside FiltersProvider');
  return ctx;
}
