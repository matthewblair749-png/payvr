'use client';

import { Command } from 'cmdk';
import { CornerDownLeft, MessageCircleQuestion, Receipt, Search, User } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { Kbd } from '@/components/ui/kbd';
import { ALL_NAV } from '@/lib/nav';

/** Seed results so search feels real before the data layer lands (step 2+ swaps in queries). */
const PAYMENTS = [
  { id: 'pay_8F2K', label: '$84.00 · Ada Lin · Linen tote', meta: 'Paid · 2m ago' },
  { id: 'pay_8F2J', label: '$212.50 · Marcus Bell · Bundle', meta: 'Paid · 9m ago' },
  { id: 'pay_8F1Z', label: '$46.00 · Priya Shah · Candle set', meta: 'Refunded · yesterday' },
];
const CUSTOMERS = [
  { id: 'cus_ada', label: 'Ada Lin', meta: '6 orders · $512 lifetime' },
  { id: 'cus_marcus', label: 'Marcus Bell', meta: '2 orders · $298 lifetime' },
  { id: 'cus_priya', label: 'Priya Shah', meta: 'New this week' },
];
const QUESTIONS = [
  'Why did conversion drop on mobile?',
  'Which products do returning customers buy?',
  'How did the launch day compare to a normal Tuesday?',
  'What would a $5 price increase do?',
];

export function CommandMenu({ open, onOpenChange }: { open: boolean; onOpenChange: (o: boolean) => void }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key.toLowerCase() === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault();
        onOpenChange(!open);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onOpenChange]);

  const go = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="p-0">
        <DialogTitle className="sr-only">Search Lumen</DialogTitle>
        <DialogDescription className="sr-only">Search payments, customers and pages, or ask a question about your business.</DialogDescription>
        <Command label="Search Lumen" className="flex max-h-[min(520px,70vh)] flex-col" loop>
          <div className="flex items-center gap-3 border-b border-hairline px-4">
            <Search className="size-[18px] shrink-0 text-muted" aria-hidden />
            <Command.Input
              autoFocus
              placeholder="Search payments, customers, pages, or ask a question"
              className="h-14 w-full bg-transparent text-base text-text outline-none placeholder:text-muted"
            />
            <Kbd>Esc</Kbd>
          </div>
          <Command.List className="overflow-y-auto p-2 [&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-3 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted">
            <Command.Empty className="px-3 py-8 text-center text-sm text-muted">
              Nothing matches that yet. Try a customer name, an amount like “84”, or ask a question.
            </Command.Empty>

            <Command.Group heading="Ask Lumen">
              {QUESTIONS.map((q) => (
                <Row key={q} value={`ask ${q}`} onSelect={() => go(`/?ask=${encodeURIComponent(q)}`)} icon={MessageCircleQuestion} label={q} />
              ))}
            </Command.Group>
            <Command.Group heading="Payments">
              {PAYMENTS.map((p) => (
                <Row key={p.id} value={`${p.label} ${p.id}`} onSelect={() => go('/payments')} icon={Receipt} label={p.label} meta={p.meta} />
              ))}
            </Command.Group>
            <Command.Group heading="Customers">
              {CUSTOMERS.map((c) => (
                <Row key={c.id} value={c.label} onSelect={() => go('/customers')} icon={User} label={c.label} meta={c.meta} />
              ))}
            </Command.Group>
            <Command.Group heading="Pages">
              {ALL_NAV.map((n) => (
                <Row key={n.href} value={`${n.label} ${n.job}`} onSelect={() => go(n.href)} icon={n.icon} label={n.label} meta={n.job} />
              ))}
            </Command.Group>
          </Command.List>
          <div className="flex items-center gap-4 border-t border-hairline px-4 py-2.5 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5">
              <Kbd>↑</Kbd>
              <Kbd>↓</Kbd> to move
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Kbd>
                <CornerDownLeft className="size-3" aria-hidden />
              </Kbd>{' '}
              to open
            </span>
          </div>
        </Command>
      </DialogContent>
    </Dialog>
  );
}

function Row({
  value,
  onSelect,
  icon: Icon,
  label,
  meta,
}: {
  value: string;
  onSelect: () => void;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  label: string;
  meta?: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="flex h-11 cursor-default items-center gap-3 rounded-[var(--radius-control)] px-3 text-sm text-text data-[selected=true]:bg-sunken">
      <Icon className="size-4 shrink-0 text-muted" aria-hidden />
      <span className="truncate font-medium">{label}</span>
      {meta ? <span className="ml-auto shrink-0 truncate pl-3 text-xs text-muted">{meta}</span> : null}
    </Command.Item>
  );
}
