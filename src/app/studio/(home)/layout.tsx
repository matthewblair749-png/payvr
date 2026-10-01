import { cookies, headers } from "next/headers";
import type { ReactNode } from "react";
import { AppShell } from "@/components/app-shell/app-shell";
import { SIDEBAR_COOKIE, THEME_COOKIE } from "@/components/app-shell/nav";
import { FirstSaleCelebration } from "@/components/studio/first-sale-celebration";
import { auth, signOut } from "@/server/auth";
import { uncelebratedFirstSale } from "@/server/dal/orders";
import { requireMerchant } from "@/server/dal/session";

export default async function MerchantAppLayout({ children }: { children: ReactNode }) {
  const merchant = await requireMerchant();
  const [session, firstSale, jar, hdrs] = await Promise.all([auth(), uncelebratedFirstSale(merchant.id), cookies(), headers()]);
  const theme = jar.get(THEME_COOKIE)?.value;

  async function signOutAction() {
    "use server";
    await signOut({ redirectTo: "/" });
  }

  return (
    <AppShell
      account={{ name: merchant.name, email: session?.user?.email ?? "" }}
      initialCollapsed={jar.get(SIDEBAR_COOKIE)?.value === "collapsed"}
      theme={theme === "light" || theme === "dark" ? theme : "system"}
      signOut={signOutAction}
      mac={/Mac|iPhone|iPad/.test(hdrs.get("user-agent") ?? "")}
    >
      {children}
      <FirstSaleCelebration initial={firstSale} watch={Boolean(merchant.stripeChargesEnabled && !merchant.firstSaleAt)} />
    </AppShell>
  );
}
