import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { FunnelDrilldownView } from "@/components/home/funnel-drilldown";
import { LEAK_TITLES } from "@/lib/tracking/events";
import { isStageKey } from "@/server/dal/funnel";
import { requireMerchant } from "@/server/dal/session";

export async function generateMetadata({ params }: PageProps<"/studio/funnel/[step]">): Promise<Metadata> {
  const { step } = await params;
  return { title: isStageKey(step) ? LEAK_TITLES[step] : "Funnel" };
}

export default async function FunnelStepPage({ params }: PageProps<"/studio/funnel/[step]">) {
  const { step } = await params;
  if (!isStageKey(step)) notFound();
  await requireMerchant(`/studio/funnel/${step}`);
  return (
    <Suspense>
      <FunnelDrilldownView step={step} />
    </Suspense>
  );
}
