import "server-only";
import { db } from "../db";

/**
 * Critical alerts only: a failed-payment spike, new disputes, paused payouts.
 * Nothing else ever becomes an alert (no notification noise). Each alert has a
 * stable id so a dismissal sticks until something new happens.
 */
export type Alert = { id: string; kind: "failures" | "dispute" | "payouts"; title: string; body: string; href: string; linkLabel: string };

const money = (cents: number, currency: string) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase(), maximumFractionDigits: cents % 100 ? 2 : 0 }).format(cents / 100);

export async function criticalAlerts(
  merchant: { id: string; stripeAccountId: string | null; stripeChargesEnabled: boolean; stripePayoutsEnabled: boolean },
  now = new Date(),
): Promise<Alert[]> {
  const day = 86_400_000;
  const since24h = new Date(now.getTime() - day);
  const since14d = new Date(now.getTime() - 15 * day);
  const attempted = ["SUCCEEDED", "PARTIALLY_REFUNDED", "REFUNDED", "DISPUTED", "FAILED"] as const;

  const [recent, base, disputes] = await Promise.all([
    db.order.groupBy({ by: ["status"], where: { merchantId: merchant.id, status: { in: [...attempted] }, createdAt: { gte: since24h, lt: now } }, _count: { _all: true } }),
    db.order.groupBy({ by: ["status"], where: { merchantId: merchant.id, status: { in: [...attempted] }, createdAt: { gte: since14d, lt: since24h } }, _count: { _all: true } }),
    db.order.findMany({
      where: { merchantId: merchant.id, status: "DISPUTED", updatedAt: { gte: new Date(now.getTime() - 7 * day) } },
      orderBy: { updatedAt: "desc" },
      select: { id: true, amountCents: true, currency: true },
    }),
  ]);
  const rate = (rows: typeof recent) => {
    const total = rows.reduce((s, r) => s + r._count._all, 0);
    const failed = rows.find((r) => r.status === "FAILED")?._count._all ?? 0;
    return { total, failed, rate: total ? failed / total : 0 };
  };
  const r = rate(recent);
  const b = rate(base);
  const alerts: Alert[] = [];

  // A spike, not a bad day: enough attempts, at least double normal, and 10+ points up.
  if (r.total >= 20 && r.rate >= Math.max(2 * b.rate, b.rate + 0.1)) {
    alerts.push({
      id: `failures:${now.toISOString().slice(0, 10)}`,
      kind: "failures",
      title: "Payments are failing more than usual",
      body: `${Math.round(r.rate * 100)}% of payment attempts failed in the last 24 hours (${r.failed} of ${r.total}), against ${Math.round(b.rate * 100)}% normally. Buyers may be stuck at checkout.`,
      href: "/studio/funnel/paid",
      linkLabel: "See where payments fail",
    });
  }
  if (disputes.length) {
    const total = disputes.reduce((s, d) => s + d.amountCents, 0);
    alerts.push({
      id: `dispute:${disputes[0].id}`,
      kind: "dispute",
      title: disputes.length === 1 ? "A payment was disputed" : `${disputes.length} payments were disputed`,
      body: `${money(total, disputes[0].currency)} is on hold. Respond in Stripe before the deadline, or the money goes back to the buyer.`,
      href: `/studio/orders?q=${encodeURIComponent(disputes[0].id)}`,
      linkLabel: disputes.length === 1 ? "See the payment" : "See the latest",
    });
  }
  if (merchant.stripeAccountId && merchant.stripeChargesEnabled && !merchant.stripePayoutsEnabled) {
    alerts.push({
      id: "payouts:paused",
      kind: "payouts",
      title: "Stripe has paused your payouts",
      body: "You can still take payments, but money won't reach your bank until you finish the details Stripe asked for.",
      href: "/studio/payments",
      linkLabel: "Fix payouts",
    });
  }
  return alerts;
}
