import type { Metadata } from "next";
import Link from "next/link";
import { ExternalLink, FlaskConical } from "lucide-react";
import { themeToVars } from "@/lib/checkout/theme";
import { formatMoney } from "@/lib/utils";
import { listPages, parseConfig } from "@/server/dal/checkout-pages";
import { requireMerchant } from "@/server/dal/session";
import { DraftImportBanner, NewCheckoutButton } from "./client";

export const metadata: Metadata = { title: "Studio" };

const rel = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
function ago(d: Date) {
  const mins = Math.round((d.getTime() - Date.now()) / 60_000);
  if (Math.abs(mins) < 60) return rel.format(mins, "minute");
  const hrs = Math.round(mins / 60);
  if (Math.abs(hrs) < 24) return rel.format(hrs, "hour");
  return rel.format(Math.round(hrs / 24), "day");
}

export default async function StudioHome() {
  const merchant = await requireMerchant();
  const pages = await listPages(merchant.id);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-5xl font-bold tracking-[-0.05em]">Checkouts</h1>
          <p className="mt-2 text-muted-strong">Design it, publish it, learn from it.</p>
        </div>
        <NewCheckoutButton />
      </div>

      <DraftImportBanner />

      {pages.length === 0 ? (
        <div className="mt-10 flex flex-col items-center rounded-[28px] border-2 border-dashed border-black/12 bg-white px-6 py-16 text-center">
          <p className="font-display text-2xl font-bold tracking-[-0.03em]">Your first checkout is one click away</p>
          <p className="mt-2 max-w-sm text-muted-strong">Start from our template, or paste your website to match your brand.</p>
          <div className="mt-6">
            <NewCheckoutButton />
          </div>
        </div>
      ) : (
        <ul className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {pages.map((p) => {
            const config = parseConfig(p.draftConfig);
            const vars = themeToVars(config.theme);
            const live = p.status === "PUBLISHED";
            return (
              <li key={p.id} className="group relative overflow-hidden rounded-[28px] bg-white shadow-soft ring-1 ring-black/5 transition-transform duration-200 hover:-translate-y-1">
                {/* Mini theme preview built from the real theme tokens. */}
                <div aria-hidden="true" className="flex h-36 items-center justify-center" style={{ ...vars, background: "var(--co-page)" }}>
                  <div className="w-44 space-y-1.5 bg-(--co-card) p-3 shadow-sm" style={{ borderRadius: "var(--co-radius-card)", fontFamily: "var(--co-font)" }}>
                    <div className="flex items-center gap-1.5">
                      <span className="grid h-5 w-5 place-items-center text-[10px] font-bold text-(--co-accent-fg)" style={{ background: "var(--co-accent)", borderRadius: "var(--co-radius-sm)" }}>
                        {config.brand.name.charAt(0)}
                      </span>
                      <span className="truncate text-[11px] font-semibold text-(--co-fg)">{config.brand.name}</span>
                    </div>
                    <div className="h-2 rounded-full bg-(--co-border)" />
                    <div className="h-2 w-2/3 rounded-full bg-(--co-border)" />
                    <div className="h-5 bg-(--co-accent)" style={{ borderRadius: "var(--co-radius-sm)" }} />
                  </div>
                </div>
                <div className="p-5">
                  <div className="flex items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-xs font-bold ${live ? "bg-spark text-ink" : "bg-surface text-muted-strong"}`}>
                      {live ? "Live" : "Draft"}
                    </span>
                    {p.experiments.length > 0 && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-ink px-2.5 py-0.5 text-xs font-bold text-white">
                        <FlaskConical size={11} aria-hidden="true" /> A/B
                      </span>
                    )}
                  </div>
                  <h2 className="mt-3 truncate font-display text-xl font-bold tracking-[-0.03em]">
                    <Link href={`/studio/pages/${p.id}`} className="after:absolute after:inset-0">
                      {p.name}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted-strong">
                    {p.product ? `${p.product.name} · ${formatMoney(p.product.priceCents, p.product.currency.toUpperCase())}` : "No product"} · edited {ago(p.updatedAt)}
                  </p>
                  {live && (
                    <a
                      href={`/pay/${p.slug}`}
                      target="_blank"
                      rel="noreferrer"
                      className="relative z-10 mt-3 inline-flex items-center gap-1 text-sm font-semibold text-orange-deep hover:underline"
                    >
                      /pay/{p.slug} <ExternalLink size={13} aria-hidden="true" />
                    </a>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
