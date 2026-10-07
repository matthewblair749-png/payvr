import type { Metadata } from "next";
import { AppShell } from "@/components/app/shell";
import { demoWorkspace } from "@/server/workspace";

export const metadata: Metadata = {
  title: { default: "Demo: Northstar Commerce", template: "%s · PIVOT demo" },
  description: "Explore PIVOT with Northstar Commerce, a sample company. No signup needed.",
};

export default async function DemoLayout({ children }: { children: React.ReactNode }) {
  return <AppShell ws={await demoWorkspace()}>{children}</AppShell>;
}
