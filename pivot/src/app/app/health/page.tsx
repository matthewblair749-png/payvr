import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { HealthPage } from "@/components/pages/health";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Business Health" };

export default async function Page() {
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <HealthPage ws={ws} />
    </WorkspaceProvider>
  );
}
