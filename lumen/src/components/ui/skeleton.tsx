import { cn } from '@/lib/utils';

/** Placeholder shaped like the real content. A calm opacity pulse (flat, no shimmer gradient). */
export function Skeleton({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div aria-hidden className={cn('rounded-lg bg-sunken motion-safe:animate-[breathe_1.8s_ease-in-out_infinite]', className)} {...props} />;
}
