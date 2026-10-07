import type { Metadata } from "next";
import { HealthPage } from "@/components/pages/health";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Business Health" };

export default async function Page() {
  return <HealthPage ws={await requireWorkspace()} />;
}
