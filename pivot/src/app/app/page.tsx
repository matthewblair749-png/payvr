import { OverviewPage } from "@/components/pages/overview";
import { requireWorkspace } from "@/server/workspace";

export default async function Page({ searchParams }: { searchParams: Promise<{ welcome?: string; imported?: string }> }) {
  const sp = await searchParams;
  return <OverviewPage ws={await requireWorkspace()} notice={sp.welcome ? "welcome" : sp.imported === "sample" ? "sample" : undefined} />;
}
