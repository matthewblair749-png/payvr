import type { Metadata } from "next";
import { CheckCircle2, CircleDashed, KeyRound } from "lucide-react";
import { requireMerchant } from "@/server/dal/session";
import { cachedConnectStatus, refreshConnectStatus, type ConnectStatus } from "@/server/payments/connect";
import { stripeConfigured } from "@/server/stripe";
import { ConnectButton, DashboardButton } from "./client";

export const metadata: Metadata = { title: "Payments" };

const TEST_CARDS = [
  ["4242 4242 4242 4242", "Succeeds"],
  ["4000 0025 0000 3155", "Asks for 3-D Secure"],
  ["4000 0000 0000 9995", "Declined: insufficient funds"],
  ["4000 0000 0000 0259", "Succeeds, then gets disputed"],
];

export default async function PaymentsPage({ searchParams }: PageProps<"/studio/payments">) {
  const merchant = await requireMerchant("/studio/payments");
  const sp = await searchParams;
  const configured = stripeConfigured();

  const cached = await cachedConnectStatus(merchant.id);
  // Coming back from Stripe onboarding (or not yet enabled): ask Stripe for the latest.
  const shouldRefresh = configured && cached.accountId && (sp.onboarding === "done" || !cached.chargesEnabled);
  const fresh: ConnectStatus | null = shouldRefresh ? await refreshConnectStatus(merchant.id).catch(() => null) : null;
  const status = fresh ?? cached;
  const refreshError = Boolean(shouldRefresh && !fresh);

  return (
    <>
      <h1 className="font-display text-5xl font-bold tracking-[-0.05em]">Payments</h1>
      <p className="mt-2 text-muted-strong">Get paid through Stripe. Money goes straight to your bank.</p>

      <section className="mt-10 rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-black/5 sm:p-8" aria-labelledby="stripe-status">
        {!configured ? (
          <div className="flex gap-4">
            <KeyRound size={28} aria-hidden="true" className="shrink-0 text-orange-deep" />
            <div>
              <h2 id="stripe-status" className="font-display text-2xl font-bold tracking-[-0.03em]">Add your Stripe test keys</h2>
              <p className="mt-2 max-w-xl text-muted-strong">
                lumen runs in Stripe test mode. Set <code className="rounded bg-surface px-1">STRIPE_SECRET_KEY</code> (sk_test_…),{" "}
                <code className="rounded bg-surface px-1">NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY</code> (pk_test_…) and{" "}
                <code className="rounded bg-surface px-1">STRIPE_WEBHOOK_SECRET</code>, then restart. See the README.
              </p>
            </div>
          </div>
        ) : !status.accountId ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 id="stripe-status" className="font-display text-2xl font-bold tracking-[-0.03em]">Connect Stripe to start selling</h2>
              <p className="mt-2 max-w-md text-muted-strong">A few minutes on Stripe&apos;s secure form. You&apos;ll come right back here.</p>
            </div>
            <ConnectButton label="Connect with Stripe" defaultCountry={merchant.country ?? "US"} showCountry />
          </div>
        ) : status.chargesEnabled ? (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <CheckCircle2 size={28} aria-hidden="true" className="shrink-0 text-[#1F7A4D]" />
              <div>
                <h2 id="stripe-status" className="font-display text-2xl font-bold tracking-[-0.03em]">You&apos;re ready to get paid</h2>
                <p className="mt-1 text-muted-strong">
                  Payments on · Payouts {status.payoutsEnabled ? "on" : "pending bank details"} · Test mode
                </p>
              </div>
            </div>
            <DashboardButton />
          </div>
        ) : (
          <div className="flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-4">
              <CircleDashed size={28} aria-hidden="true" className="shrink-0 text-amber" />
              <div>
                <h2 id="stripe-status" className="font-display text-2xl font-bold tracking-[-0.03em]">Almost there</h2>
                <p className="mt-1 text-muted-strong">Stripe needs a few more details before you can take payments.</p>
                {status.requirementsDue.length > 0 && (
                  <ul className="mt-3 list-inside list-disc text-sm">
                    {[...new Set(status.requirementsDue)].map((r) => (
                      <li key={r}>{r}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
            <ConnectButton label="Finish setup" defaultCountry={merchant.country ?? "US"} />
          </div>
        )}
        {refreshError && <p className="mt-4 text-sm text-orange-deep">Couldn&apos;t reach Stripe just now. Showing the last known status.</p>}
      </section>

      <section className="mt-8 rounded-[28px] bg-white p-6 shadow-soft ring-1 ring-black/5 sm:p-8" aria-labelledby="test-cards">
        <h2 id="test-cards" className="font-display text-xl font-bold tracking-[-0.03em]">Test cards</h2>
        <p className="mt-1 text-sm text-muted-strong">Any future expiry, any CVC, any postal code.</p>
        <table className="mt-4 w-full text-left text-sm">
          <thead className="sr-only">
            <tr>
              <th>Card number</th>
              <th>Result</th>
            </tr>
          </thead>
          <tbody>
            {TEST_CARDS.map(([card, result]) => (
              <tr key={card} className="border-t border-black/8">
                <td className="py-2.5 font-mono">{card}</td>
                <td className="py-2.5 text-muted-strong">{result}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </>
  );
}
