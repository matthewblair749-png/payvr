import type { Metadata } from "next";
import { RecommendationsPage } from "@/components/pages/recommendations";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Recommendations" };

export default async function Page() {
  return <RecommendationsPage ws={await requireWorkspace()} />;
}
