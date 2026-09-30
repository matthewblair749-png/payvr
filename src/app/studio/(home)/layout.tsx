import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { FirstSaleCelebration } from "@/components/studio/first-sale-celebration";
import { auth, signOut } from "@/server/auth";
import { uncelebratedFirstSale } from "@/server/dal/orders";
import { requireMerchant } from "@/server/dal/session";
import { StudioNav } from "./nav";

export default async function StudioHomeLayout({ children }: { children: ReactNode }) {
  const merchant = await requireMerchant();
  const [session, firstSale] = await Promise.all([auth(), uncelebratedFirstSale(merchant.id)]);
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-black/8 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-5 sm:gap-8 sm:px-8">
          <Link href="/studio" aria-label="Studio home" className="shrink-0">
            <Logo size={30} wordmarkClassName="hidden sm:inline" />
          </Link>
          <StudioNav />
          <div className="ml-auto flex items-center gap-3">
            <span className="hidden text-sm text-muted-strong md:inline">
              {merchant.name} · {session?.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" aria-label="Sign out" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface">
                <LogOut size={15} aria-hidden="true" /> <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
      <FirstSaleCelebration initial={firstSale} watch={Boolean(merchant.stripeChargesEnabled && !merchant.firstSaleAt)} />
    </div>
  );
}
