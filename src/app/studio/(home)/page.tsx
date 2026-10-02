import type { Metadata } from "next";
import { Suspense } from "react";
import { cookies } from "next/headers";
import { greetingFor, TZ_COOKIE } from "@/components/app-shell/greeting";
import { DISMISSED_ALERTS_COOKIE } from "@/components/app-shell/nav";
import { PageHeader } from "@/components/app-shell/page-header";
import { AskLumen } from "@/components/home/ask-lumen";
import { HomeDashboard, HomeSkeleton } from "@/components/home/home-dashboard";
import { Alerts } from "@/components/home/alerts";
import { FirstRun } from "@/components/home/first-run";
import { SampleBanner } from "@/components/home/sample-banner";
import { normalizeLayout, normalizeViews } from "@/lib/home-layout";
import { criticalAlerts } from "@/server/dal/alerts";
import { firstRunState, homeMode } from "@/server/dal/home-source";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Home" };

export default async function HomePage() {
  const merchant = await requireMerchant("/studio");
  const jar = await cookies();
  const hello = greetingFor(jar.get(TZ_COOKIE)?.value);
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

  const layout = normalizeLayout(merchant.homeLayout);
  // Alerts are about the merchant's own shop, never sample data, and render with the page (no late jump).
  const showAlerts = mode.kind === "live" || mode.kind === "demo";
  const alerts = showAlerts ? await criticalAlerts(merchant) : [];
  const dismissed = decodeURIComponent(jar.get(DISMISSED_ALERTS_COOKIE)?.value ?? "").split(" ").filter(Boolean).slice(0, 20);
  return (
    <>
      <PageHeader title={`${hello}, ${merchant.name}`} />
      {showAlerts && <Alerts initial={alerts} dismissed={dismissed} />}
      {(mode.kind === "sample" || mode.kind === "demo") && <SampleBanner kind={mode.kind} sampleName={mode.sampleName} />}
      {/* Bottom padding keeps the last card clear of the docked Ask bar. */}
      <div className="pb-24">
        <Suspense
          fallback={
            <>
              {/* Same height as the View / Customize row, so nothing moves when it arrives. */}
              <div aria-hidden="true" className="mt-6 h-9" />
              <HomeSkeleton layout={layout} />
            </>
          }
        >
          <HomeDashboard layout={layout} views={normalizeViews(merchant.homeViews)} />
        </Suspense>
      </div>
      <Suspense>
        <AskLumen currency={mode.currency} />
      </Suspense>
    </>
  );
}
