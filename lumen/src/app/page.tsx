import { Greeting } from '@/components/home/greeting';
import { BriefSkeleton, FunnelSkeleton, KpiSkeleton, ListSkeleton, NorthStarSkeleton } from '@/components/home/home-skeleton';

export default function HomePage() {
  return (
    <div className="flex flex-col gap-6" aria-busy="true">
      <Greeting name="Maya" />
      <BriefSkeleton />
      <NorthStarSkeleton />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
        <KpiSkeleton />
      </div>
      <FunnelSkeleton />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <ListSkeleton />
        <ListSkeleton rows={4} />
      </div>
      <ListSkeleton rows={2} />
      <p className="sr-only">Loading your dashboard.</p>
    </div>
  );
}
