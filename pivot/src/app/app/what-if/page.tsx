import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { WhatIfPage } from "@/components/pages/what-if";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "What If?" };

export default async function Page({ searchParams }: { searchParams: Promise<{ kind?: string; value?: string }> }) {
  const { kind, value } = await searchParams;
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <WhatIfPage ws={ws} kind={kind} value={value} />
    </WorkspaceProvider>
  );
}
