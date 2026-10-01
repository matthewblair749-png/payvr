import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

/**
 * Placeholders shaped exactly like the sections that will replace them, so nothing moves
 * when real content arrives. Each later step swaps one of these for the real widget.
 */
export function BriefSkeleton() {
  return (
    <Card className="p-6" aria-hidden>
      <Skeleton className="h-4 w-28" />
      <Skeleton className="mt-4 h-6 w-[92%]" />
      <Skeleton className="mt-2 h-6 w-[64%]" />
      <div className="mt-5 flex gap-2">
        <Skeleton className="h-10 w-40 rounded-[var(--radius-control)]" />
        <Skeleton className="h-10 w-32 rounded-[var(--radius-control)]" />
      </div>
    </Card>
  );
}

export function NorthStarSkeleton() {
  return (
    <Card className="p-6" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-[60px] w-64" />
      <Skeleton className="mt-3 h-4 w-48" />
      <Skeleton className="mt-6 h-[240px] w-full" />
    </Card>
  );
}

export function KpiSkeleton() {
  return (
    <Card className="p-5" aria-hidden>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-9 w-28" />
      <Skeleton className="mt-2 h-4 w-32" />
      <Skeleton className="mt-4 h-10 w-full" />
    </Card>
  );
}

export function FunnelSkeleton() {
  return (
    <Card className="p-6" aria-hidden>
      <Skeleton className="h-4 w-36" />
      <div className="mt-6 grid grid-cols-5 items-end gap-3">
        {[100, 72, 54, 40, 33].map((h) => (
          <Skeleton key={h} className="w-full" style={{ height: `${h * 1.6}px` }} />
        ))}
      </div>
    </Card>
  );
}

export function ListSkeleton({ rows = 5 }: { rows?: number }) {
  return (
    <Card className="p-6" aria-hidden>
      <Skeleton className="h-4 w-28" />
      <div className="mt-5 flex flex-col gap-4">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="size-8 rounded-full" />
            <Skeleton className="h-4 flex-1" />
            <Skeleton className="h-4 w-14" />
          </div>
        ))}
      </div>
    </Card>
  );
}
