import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/auth";
import { Dashboard } from "@/features/dashboard/dashboard";
import { DashboardHeader } from "@/features/dashboard/dashboard-header";
import { getUsageSummary } from "@/features/usage/server";
import { db } from "@/server/db";

export const metadata: Metadata = { title: "Your dashboard" };

export default async function DashboardPage(props: PageProps<"/dashboard">) {
  // Protected: checked on the server for every request.
  const session = await auth();
  const userId = session?.user?.id;
  if (!userId) redirect(`/signin?callbackUrl=${encodeURIComponent("/dashboard")}`);

  const [user, usage, params] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: userId }, include: { subscription: { select: { interval: true, seats: true } } } }),
    getUsageSummary(db, userId),
    props.searchParams,
  ]);

  const noticeKey = (["checkout", "billing"] as const).find((k) => typeof params[k] === "string");
  const notice = noticeKey ? `${noticeKey}=${params[noticeKey] as string}` : undefined;

  return (
    <>
      <DashboardHeader email={user.email} />
      <Dashboard
        name={user.name}
        usage={usage}
        subscription={user.subscription}
        hasBillingAccount={Boolean(user.stripeCustomerId)}
        notice={notice}
      />
    </>
  );
}
