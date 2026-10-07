import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { OpportunityDetailPage } from "@/components/pages/opportunities";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Opportunity" };

export default async function Page({ params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <OpportunityDetailPage ws={ws} oppKey={key} />
    </WorkspaceProvider>
  );
}
