import "server-only";
import { formatMoney } from "@/lib/utils";
import { db } from "../db";
import { listCustomers } from "./orders";

/**
 * ⌘K search across one merchant's checkouts, payments and customers.
 * Every query is scoped by merchantId; the term is length-capped and only
 * ever used as a bound parameter.
 */

export type SearchHit = { kind: "page" | "payment" | "customer" | "question"; id: string; title: string; detail: string; href: string };

const dt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric" });
const STATUS: Record<string, string> = {
  SUCCEEDED: "Paid",
  PARTIALLY_REFUNDED: "Partly refunded",
  REFUNDED: "Refunded",
  DISPUTED: "Disputed",
  FAILED: "Failed",
  PENDING: "Pending",
};

/** "$24", "24.50", "2,400" → cents; null if the term isn't an amount. */
export function amountFromTerm(term: string): number | null {
  const m = /^\$?\s*(\d{1,7}(?:,\d{3})*)(?:\.(\d{1,2}))?$/.exec(term.trim());
  if (!m) return null;
  return Number(m[1].replace(/,/g, "")) * 100 + Number((m[2] ?? "0").padEnd(2, "0"));
}

export async function searchWorkspace(merchantId: string, rawTerm: string, currency: string): Promise<SearchHit[]> {
  const term = rawTerm.trim().slice(0, 80);
  if (!term) return [];
  const cents = amountFromTerm(term);
  const ci = { contains: term, mode: "insensitive" as const };

  const [pages, orders, customers, threads] = await Promise.all([
    db.checkoutPage.findMany({
      where: { merchantId, OR: [{ name: ci }, { slug: ci }] },
      select: { id: true, name: true, slug: true, status: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
    db.order.findMany({
      where: {
        merchantId,
        status: { not: "PENDING" },
        OR: [
          { customerEmail: ci },
          { id: term },
          { stripePaymentIntentId: term },
          ...(cents != null ? [{ amountCents: cents }] : []),
        ],
      },
      select: { id: true, amountCents: true, currency: true, status: true, customerEmail: true, createdAt: true },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
    listCustomers(merchantId, { q: term, take: 5 }),
    db.researchThread.findMany({
      where: { merchantId, title: ci },
      select: { id: true, title: true, updatedAt: true },
      orderBy: { updatedAt: "desc" },
      take: 5,
    }),
  ]);

  return [
    ...pages.map((p) => ({
      kind: "page" as const,
      id: p.id,
      title: p.name,
      detail: `${p.status === "PUBLISHED" ? "Live" : "Draft"} · /pay/${p.slug}`,
      href: `/studio/pages/${p.id}`,
    })),
    ...orders.map((o) => ({
      kind: "payment" as const,
      id: o.id,
      title: `${formatMoney(o.amountCents, o.currency.toUpperCase())} · ${STATUS[o.status] ?? o.status}`,
      detail: `${o.customerEmail ?? "No email"} · ${dt.format(o.createdAt)}`,
      href: `/studio/orders?q=${encodeURIComponent(o.id)}`,
    })),
    ...customers.map((c) => ({
      kind: "customer" as const,
      id: c.email,
      title: c.email,
      detail: `${c.orders} ${c.orders === 1 ? "order" : "orders"} · ${formatMoney(c.spentCents, currency.toUpperCase())}`,
      href: `/studio/customers?q=${encodeURIComponent(c.email)}`,
    })),
    ...threads.map((t) => ({
      kind: "question" as const,
      id: t.id,
      title: t.title,
      detail: `Asked ${dt.format(t.updatedAt)}`,
      href: `/studio/research?thread=${encodeURIComponent(t.id)}`,
    })),
  ];
}
