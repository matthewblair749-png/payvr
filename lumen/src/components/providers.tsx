'use client';

import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MotionConfig } from 'framer-motion';
import { useState } from 'react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { FiltersProvider } from '@/lib/filters';
import { ThemeProvider } from '@/lib/theme';

export function Providers({ children }: { children: React.ReactNode }) {
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } }),
  );
  return (
    <QueryClientProvider client={client}>
      <ThemeProvider>
        <FiltersProvider>
          {/* Every Motion animation follows the OS "reduce motion" setting. */}
          <MotionConfig reducedMotion="user">
            <TooltipProvider delayDuration={250}>{children}</TooltipProvider>
          </MotionConfig>
        </FiltersProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}
