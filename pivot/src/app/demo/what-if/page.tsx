import type { Metadata } from "next";
import { WhatIfPage } from "@/components/pages/what-if";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "What If?" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; value?: string }> }) {
  const { kind, value } = await searchParams;
  return <WhatIfPage ws={await demoWorkspace()} kind={kind} value={value} />;
}
