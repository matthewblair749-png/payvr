import { cn } from '@/lib/utils';

/**
 * Lumen mark: an orange disc with a small spark, the brand's one use of spark yellow.
 * Wordmark in Sora 700.
 */
export function LumenMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={cn('size-8 shrink-0', className)} aria-hidden>
      <rect width="32" height="32" rx="9" fill="var(--accent)" />
      <circle cx="16" cy="16" r="7.5" fill="none" stroke="var(--lumen-ink)" strokeWidth="2.6" />
      <circle cx="22.4" cy="9.6" r="3.4" fill="var(--spark)" stroke="var(--lumen-ink)" strokeWidth="1.6" />
    </svg>
  );
}

export function Wordmark({ className }: { className?: string }) {
  return <span className={cn('font-display text-lg font-bold tracking-[-0.02em] text-text', className)}>Lumen</span>;
}
