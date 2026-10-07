import type { Metadata } from "next";
import { ReportsPage } from "@/components/pages/reports";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Reports" };

export default async function Page() {
  return <ReportsPage ws={await demoWorkspace()} />;
}
