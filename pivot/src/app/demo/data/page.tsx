import type { Metadata } from "next";
import { DataPage } from "@/components/pages/data";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Data" };

export default async function Page() {
  return <DataPage ws={await demoWorkspace()} />;
}
