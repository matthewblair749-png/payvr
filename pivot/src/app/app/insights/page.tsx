import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { InsightsPage } from "@/components/pages/insights";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Insights" };

export default async function Page({ searchParams }: { searchParams: Promise<{ filter?: string }> }) {
  const { filter } = await searchParams;
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <InsightsPage ws={ws} filter={filter} />
    </WorkspaceProvider>
  );
}
