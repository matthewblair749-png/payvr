import type { Metadata } from "next";
import { OpportunityDetailPage } from "@/components/pages/opportunities";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Opportunity" };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  return <OpportunityDetailPage ws={await demoWorkspace()} oppKey={key} />;
}
