import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { DataPage } from "@/components/pages/data";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Data" };

export default async function Page() {
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <DataPage ws={ws} />
    </WorkspaceProvider>
  );
}
