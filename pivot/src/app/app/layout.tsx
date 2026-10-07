import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: { default: "Overview", template: "%s · PIVOT" }, robots: { index: false } };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const ws = await requireWorkspace();
  return <AppShell ws={ws}>{children}</AppShell>;
}
