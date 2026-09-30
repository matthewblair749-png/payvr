import type { Metadata } from "next";
import Link from "next/link";
import { formatMoney } from "@/lib/utils";
import { listOrders } from "@/server/dal/orders";
import { requireMerchant } from "@/server/dal/session";
import { RefundButton } from "./refund-button";

export const metadata: Metadata = { title: "Orders" };

const STATUS: Record<string, { label: string; cls: string }> = {
  SUCCEEDED: { label: "Paid", cls: "bg-[#DDF3E4] text-[#14532D]" },
  PARTIALLY_REFUNDED: { label: "Part refunded", cls: "bg-surface text-ink" },
  REFUNDED: { label: "Refunded", cls: "bg-surface text-muted-strong" },
  DISPUTED: { label: "Disputed", cls: "bg-[#FDE2DA] text-[#8A2A0B]" },
  FAILED: { label: "Failed", cls: "bg-surface text-muted-strong" },
};

const dt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

function methodLabel(m: string | null) {
  if (!m) return "—";
  return m.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

export default async function OrdersPage() {
  const merchant = await requireMerchant("/studio/orders");
  const orders = await listOrders(merchant.id);

  return (
    <>
      <h1 className="font-display text-5xl font-bold tracking-[-0.05em]">Orders</h1>
      <p className="mt-2 text-muted-strong">Every payment through your checkouts. Refunds go back to the buyer&apos;s card.</p>

      {orders.length === 0 ? (
        <div className="mt-10 rounded-[28px] border-2 border-dashed border-black/12 bg-white px-6 py-16 text-center">
          <p className="font-display text-2xl font-bold tracking-[-0.03em]">No orders yet</p>
          <p className="mt-2 text-muted-strong">
            Publish a checkout and <Link href="/studio/payments" className="font-semibold text-orange-deep underline">connect Stripe</Link>, then share the link.
          </p>
        </div>
      ) : (
        <div className="mt-10 overflow-x-auto rounded-[28px] bg-white shadow-soft ring-1 ring-black/5">
          <table className="w-full min-w-[720px] text-left text-sm">
            <caption className="sr-only">Recent orders</caption>
            <thead className="text-xs uppercase tracking-wider text-muted-strong">
              <tr>
                <th scope="col" className="px-5 py-4 font-semibold">Date</th>
                <th scope="col" className="px-5 py-4 font-semibold">Product</th>
                <th scope="col" className="px-5 py-4 font-semibold">Amount</th>
                <th scope="col" className="px-5 py-4 font-semibold">Status</th>
                <th scope="col" className="px-5 py-4 font-semibold">Method</th>
                <th scope="col" className="px-5 py-4 font-semibold">Buyer</th>
                <th scope="col" className="px-5 py-4"><span className="sr-only">Actions</span></th>
              </tr>
            </thead>
            <tbody>
              {orders.map((o) => {
                const s = STATUS[o.status] ?? { label: o.status, cls: "bg-surface" };
                return (
                  <tr key={o.id} className="border-t border-black/6">
                    <td className="whitespace-nowrap px-5 py-3.5 text-muted-strong">{dt.format(o.createdAt)}</td>
                    <td className="px-5 py-3.5">
                      <span className="font-semibold">{o.product?.name ?? "—"}</span>
                      {o.checkoutPage && <span className="block text-xs text-muted-strong">/pay/{o.checkoutPage.slug}</span>}
                    </td>
                    <td className="whitespace-nowrap px-5 py-3.5 font-semibold tabular-nums">
                      {formatMoney(o.amountCents, o.currency.toUpperCase())}
                      {o.refundedCents > 0 && o.refundedCents < o.amountCents && (
                        <span className="block text-xs font-normal text-muted-strong">
                          −{formatMoney(o.refundedCents, o.currency.toUpperCase())} refunded
                        </span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${s.cls}`}>{s.label}</span>
                      {o.status === "FAILED" && o.failureMessage && (
                        <span className="mt-1 block max-w-[16rem] text-xs text-muted-strong">{o.failureMessage}</span>
                      )}
                    </td>
                    <td className="px-5 py-3.5">{methodLabel(o.paymentMethod)}{o.country ? ` · ${o.country}` : ""}</td>
                    <td className="max-w-[12rem] truncate px-5 py-3.5 text-muted-strong">{o.customerEmail ?? "—"}</td>
                    <td className="px-5 py-3.5 text-right">
                      {(o.status === "SUCCEEDED" || o.status === "PARTIALLY_REFUNDED") && <RefundButton orderId={o.id} />}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
