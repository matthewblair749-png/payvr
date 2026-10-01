import type { Metadata } from "next";
import { DashboardView } from "@/components/dashboard/dashboard-view";
import { dashboardData } from "@/server/dal/analytics";
import { listPages } from "@/server/dal/checkout-pages";
import { requireMerchant } from "@/server/dal/session";
import { DashboardFilters } from "./filters";

export const metadata: Metadata = { title: "Dashboard" };

const RANGES = { "7": 7, "30": 30, "90": 90 } as const;

export default async function DashboardPage({ searchParams }: PageProps<"/studio/dashboard">) {
  const merchant = await requireMerchant("/studio/dashboard");
  const sp = await searchParams;
  const rangeKey = (typeof sp.range === "string" && sp.range in RANGES ? sp.range : "30") as keyof typeof RANGES;
  const days = RANGES[rangeKey];

  const pages = await listPages(merchant.id);
  const pageId = typeof sp.page === "string" && pages.some((p) => p.id === sp.page) ? sp.page : null;

  // Whole UTC days, ending with today.
  const now = new Date();
  const to = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1));
  const from = new Date(to.getTime() - days * 86_400_000);

  const data = await dashboardData({ merchantId: merchant.id, from, to, pageId, currency: merchant.defaultCurrency });

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-figure font-bold tracking-[-0.03em]">Dashboard</h1>
          <p className="mt-1 text-body text-app-muted">How your checkouts are doing, and where people hesitate.</p>
        </div>
      </div>
      <DashboardFilters
        pageId={pageId}
        pages={pages.map((p) => ({ id: p.id, name: p.name }))}
      />
      <DashboardView data={data} currency={merchant.defaultCurrency.toUpperCase()} days={days} />
    </>
  );
}
