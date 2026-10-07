import type { Metadata } from "next";
import { ReportsPage } from "@/components/pages/reports";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Reports" };

export default async function Page() {
  return <ReportsPage ws={await requireWorkspace()} />;
}
