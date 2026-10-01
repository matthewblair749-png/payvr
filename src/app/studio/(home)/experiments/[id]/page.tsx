import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExperimentView } from "@/components/experiments/experiment-view";
import { experimentDetail } from "@/server/dal/experiments";
import { NotFoundError } from "@/server/dal/checkout-pages";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Experiment" };

export default async function ExperimentPage({ params }: PageProps<"/studio/experiments/[id]">) {
  const { id } = await params;
  const merchant = await requireMerchant(`/studio/experiments/${id}`);
  const data = await experimentDetail(merchant.id, id).catch((e) => {
    if (e instanceof NotFoundError) notFound();
    throw e;
  });
  return <ExperimentView data={data} />;
}
