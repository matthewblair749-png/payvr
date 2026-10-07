import { WorkspaceProvider } from "@/components/app/workspace-context";
import { OverviewPage } from "@/components/pages/overview";
import { requireWorkspace } from "@/server/workspace";

export default async function Page({ searchParams }: { searchParams: Promise<{ welcome?: string; imported?: string }> }) {
  const sp = await searchParams;
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <OverviewPage ws={ws} notice={sp.welcome ? "welcome" : sp.imported === "sample" ? "sample" : undefined} />
    </WorkspaceProvider>
  );
}
