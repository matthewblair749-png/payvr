'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { NAV, NAV_FOOTER } from '@/lib/nav';

import { LumenMark, Wordmark } from './logo';
import { NavList } from './sidebar';

/** Below lg the sidebar becomes a drawer opened from the top bar. */
export function MobileNav({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const close = () => onOpenChange(false);
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-ink/30 data-[state=open]:animate-[fade-in_160ms_ease-out] lg:hidden" />
        <DialogPrimitive.Content className="fixed inset-y-0 left-0 z-50 flex w-[min(300px,85vw)] flex-col border-r border-hairline bg-surface shadow-pop data-[state=open]:animate-[slide-in_220ms_var(--ease-out)] lg:hidden">
          <DialogPrimitive.Title className="sr-only">Navigation</DialogPrimitive.Title>
          <div className="flex h-16 items-center gap-2.5 px-5">
            <LumenMark />
            <Wordmark />
            <DialogPrimitive.Close asChild>
              <Button variant="ghost" size="icon" className="ml-auto" aria-label="Close navigation">
                <X className="size-5" aria-hidden />
              </Button>
            </DialogPrimitive.Close>
          </div>
          <NavList items={NAV} onNavigate={close} className="mt-2 flex-1" />
          <div className="border-t border-hairline py-3">
            <NavList items={NAV_FOOTER} onNavigate={close} />
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
