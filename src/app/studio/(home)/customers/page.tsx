import type { Metadata } from "next";
import Link from "next/link";
import { Card, PageHeader } from "@/components/app-shell/page-header";
import { formatMoney } from "@/lib/utils";
import { listCustomers } from "@/server/dal/orders";
import { requireMerchant } from "@/server/dal/session";

export const metadata: Metadata = { title: "Customers" };

const dt = new Intl.DateTimeFormat("en", { month: "short", day: "numeric", year: "numeric" });

export default async function CustomersPage({ searchParams }: PageProps<"/studio/customers">) {
  const merchant = await requireMerchant("/studio/customers");
  const sp = await searchParams;
  const q = typeof sp.q === "string" ? sp.q.slice(0, 80) : "";
  const customers = await listCustomers(merchant.id, { q });
  const currency = merchant.defaultCurrency.toUpperCase();

  return (
    <>
      <PageHeader title="Customers" description="Everyone who has paid you, grouped by email. Spend is after refunds." />
      <form role="search" className="mt-6 flex max-w-md gap-2">
        <label htmlFor="customer-q" className="sr-only">
          Search customers by email
        </label>
        <input
          id="customer-q"
          name="q"
          defaultValue={q}
          placeholder="Search by email"
          className="h-10 min-w-0 flex-1 rounded-control border border-app-hairline bg-app-card px-3 text-ui text-app-fg placeholder:text-app-muted"
        />
        <button type="submit" className="h-10 rounded-control border border-app-hairline bg-app-card px-4 text-ui font-semibold hover:bg-app-sunken">
          Search
        </button>
      </form>

      {customers.length === 0 ? (
        <Card className="mt-6 px-6 py-14 text-center">
          <p className="font-display text-title font-bold">{q ? `No customers match “${q}”` : "No customers yet"}</p>
          <p className="mt-2 text-ui text-app-muted">
            {q ? (
              <>
                Check the spelling, or{" "}
                <Link href="/studio/customers" className="font-semibold text-app-accent-text underline">
                  see everyone
                </Link>
                .
              </>
            ) : (
              "Your buyers appear here after their first payment, with what they've spent and when they last bought."
            )}
          </p>
        </Card>
      ) : (
        <Card className="mt-6 overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-ui">
            <caption className="sr-only">Customers, most recent purchase first</caption>
            <thead className="text-cap text-app-muted">
              <tr>
                <th scope="col" className="px-5 py-3 font-semibold">Email</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Orders</th>
                <th scope="col" className="px-5 py-3 text-right font-semibold">Spent</th>
                <th scope="col" className="px-5 py-3 font-semibold">First bought</th>
                <th scope="col" className="px-5 py-3 font-semibold">Last bought</th>
              </tr>
            </thead>
            <tbody>
              {customers.map((c) => (
                <tr key={c.email} className="border-t border-app-hairline">
                  <td className="px-5 py-3 font-medium">
                    <Link href={`/studio/orders?q=${encodeURIComponent(c.email)}`} className="hover:underline">
                      {c.email}
                    </Link>
                  </td>
                  <td className="px-5 py-3 text-right">{c.orders}</td>
                  <td className="px-5 py-3 text-right">{formatMoney(c.spentCents, currency)}</td>
                  <td className="px-5 py-3 text-app-muted">{dt.format(c.firstAt)}</td>
                  <td className="px-5 py-3 text-app-muted">{dt.format(c.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      )}
    </>
  );
}
