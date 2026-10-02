import type { Metadata } from "next";
import Link from "next/link";
import { ChevronRight, CircleCheck, Clock, Palette } from "lucide-react";
import { Card, PageHeader } from "@/components/app-shell/page-header";
import { SampleToggle } from "@/components/home/sample-banner";
import { auth } from "@/server/auth";
import { db } from "@/server/db";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Settings" };

export default async function SettingsPage() {
  const merchant = await requireMerchant("/studio/settings");
  const session = await auth();
  const ready = merchant.stripeChargesEnabled;
  const hasSales = Boolean(
    await db.order.findFirst({ where: { merchantId: merchant.id, status: { in: ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED"] } }, select: { id: true } }),
  );

  return (
    <>
      <PageHeader title="Settings" />
      <div className="mt-8 grid max-w-3xl gap-4">
        <Card aria-labelledby="account-h" className="p-6">
          <h2 id="account-h" className="font-display text-title font-bold">Account</h2>
          <dl className="mt-4 grid gap-3 text-ui sm:grid-cols-[160px_1fr]">
            <dt className="text-app-muted">Business name</dt>
            <dd className="font-medium">{merchant.name}</dd>
            <dt className="text-app-muted">Sign-in email</dt>
            <dd className="font-medium">{session?.user?.email}</dd>
            <dt className="text-app-muted">Currency</dt>
            <dd className="font-medium">{merchant.defaultCurrency.toUpperCase()}</dd>
          </dl>
        </Card>

        <Card aria-labelledby="stripe-h">
          <Link href="/studio/payments" className="flex items-center gap-4 rounded-card p-6 hover:bg-app-sunken">
            <span className="min-w-0 flex-1">
              <span id="stripe-h" className="block font-display text-title font-bold">Stripe &amp; payouts</span>
              <span className="mt-1 flex items-center gap-1.5 text-ui">
                {ready ? (
                  <>
                    <CircleCheck size={16} aria-hidden="true" className="text-app-success" />
                    <span className="text-app-success-text">Ready to take payments</span>
                  </>
                ) : (
                  <>
                    <Clock size={16} aria-hidden="true" className="text-app-pending" />
                    <span className="text-app-pending-text">Not set up yet: connect Stripe to get paid</span>
                  </>
                )}
              </span>
            </span>
            <ChevronRight size={18} aria-hidden="true" className="text-app-muted" />
          </Link>
        </Card>

        {!merchant.isSample && (
          <Card aria-labelledby="sample-h" className="p-6">
            <h2 id="sample-h" className="font-display text-title font-bold">
              Sample data
            </h2>
            <div className="mt-3">
              <SampleToggle show={merchant.showSample} hasSales={hasSales} />
            </div>
          </Card>
        )}

        <Card aria-labelledby="look-h" className="flex items-start gap-4 p-6">
          <Palette size={20} aria-hidden="true" className="mt-1 shrink-0 text-app-muted" />
          <div>
            <h2 id="look-h" className="font-display text-title font-bold">Appearance</h2>
            <p className="mt-1 text-ui text-app-muted">
              lumen follows your device&apos;s light or dark setting. Use the theme button in the top bar to pin one.
            </p>
          </div>
        </Card>
      </div>
    </>
  );
}
