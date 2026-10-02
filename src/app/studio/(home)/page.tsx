import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { greetingFor, TZ_COOKIE } from "@/components/app-shell/greeting";
import { PageHeader } from "@/components/app-shell/page-header";
import { AskLumen } from "@/components/home/ask-lumen";
import { HomeDashboard, HomeSkeleton } from "@/components/home/home-dashboard";
import { Alerts } from "@/components/home/alerts";
import { FirstRun } from "@/components/home/first-run";
import { SampleBanner } from "@/components/home/sample-banner";
import { firstRunState, homeMode } from "@/server/dal/home-source";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const merchant = await requireMerchant("/studio");
  const hello = greetingFor((await cookies()).get(TZ_COOKIE)?.value);
  const mode = await homeMode(merchant);

  if (mode.kind === "first-run") {
    const state = await firstRunState(merchant.id, merchant.stripeChargesEnabled);
    const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return (
      <>
        <PageHeader title={`${hello}, ${merchant.name}`} description="Welcome to lumen." />
        <FirstRun state={{ ...state, appUrl }} />
      </>
    );
  }

  return (
    <>
      <PageHeader title={`${hello}, ${merchant.name}`} />
      {/* Alerts are about the merchant's own shop, never sample data. */}
      {(mode.kind === "live" || mode.kind === "demo") && <Alerts />}
      {(mode.kind === "sample" || mode.kind === "demo") && <SampleBanner kind={mode.kind} sampleName={mode.sampleName} />}
      {/* Bottom padding keeps the last card clear of the docked Ask bar. */}
      <div className="pb-24">
        <Suspense fallback={<HomeSkeleton />}>
          <HomeDashboard />
        </Suspense>
      </div>
      <Suspense>
        <AskLumen currency={mode.currency} />
      </Suspense>
    </>
  );
}
