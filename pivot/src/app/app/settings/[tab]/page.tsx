import type { Metadata } from "next";
import { WorkspaceProvider } from "@/components/app/workspace-context";
import { SettingsPage } from "@/components/pages/settings";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function Page({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const { tab } = await params;
  const { checkout } = await searchParams;
  const ws = await requireWorkspace();
  // Actions send back the company this page was rendered for (the shared layout can be stale).
  return (
    <WorkspaceProvider companyId={ws.company.id}>
      <SettingsPage ws={ws} tab={tab} checkout={checkout} />
    </WorkspaceProvider>
  );
}
