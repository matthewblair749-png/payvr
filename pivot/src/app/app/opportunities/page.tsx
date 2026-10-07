import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { OpportunitiesPage } from "@/components/pages/opportunities";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Opportunities" };

export default async function Page() {
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <OpportunitiesPage ws={ws} />
    </WorkspaceProvider>
  );
}
