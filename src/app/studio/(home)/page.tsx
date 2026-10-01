import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { greetingFor, TZ_COOKIE } from "@/components/app-shell/greeting";
import { PageHeader } from "@/components/app-shell/page-header";
import { HomeDashboard, HomeSkeleton } from "@/components/home/home-dashboard";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const merchant = await requireMerchant("/studio");
  const hello = greetingFor((await cookies()).get(TZ_COOKIE)?.value);
  return (
    <>
      <PageHeader title={`${hello}, ${merchant.name}`} description="Here's how your business is doing." />
      <Suspense fallback={<HomeSkeleton />}>
        <HomeDashboard />
      </Suspense>
    </>
  );
}
