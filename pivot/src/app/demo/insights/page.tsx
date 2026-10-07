import type { Metadata } from "next";
import { InsightsPage } from "@/components/pages/insights";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Insights" };

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  return <InsightsPage ws={await demoWorkspace()} filter={filter} />;
}
