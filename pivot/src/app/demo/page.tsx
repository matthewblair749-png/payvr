import { OverviewPage } from "@/components/pages/overview";
import { demoWorkspace } from "@/server/workspace";

export default async function Page() {
  return <OverviewPage ws={await demoWorkspace()} />;
}
