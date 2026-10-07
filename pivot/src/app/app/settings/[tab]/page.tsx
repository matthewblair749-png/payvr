import type { Metadata } from "next";
import { SettingsPage } from "@/components/pages/settings";
import { requireWorkspace } from "@/server/workspace";

export const metadata: Metadata = { title: "Settings" };

export default async function Page({ params, searchParams }: { params: Promise<{ tab: string }>; searchParams: Promise<{ checkout?: string }> }) {
  const { tab } = await params;
  const { checkout } = await searchParams;
  return <SettingsPage ws={await requireWorkspace()} tab={tab} checkout={checkout} />;
}
