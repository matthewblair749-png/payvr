import type { Metadata } from "next";
import { OpportunitiesPage } from "@/components/pages/opportunities";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Opportunities" };

export default async function Page() {
  return <OpportunitiesPage ws={await demoWorkspace()} />;
}
