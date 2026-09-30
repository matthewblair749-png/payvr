import Link from "next/link";
import type { ReactNode } from "react";
import { LogOut } from "lucide-react";
import { Logo } from "@/components/brand/logo";
import { auth, signOut } from "@/server/auth";
import { requireMerchant } from "@/server/dal/session";

export default async function StudioHomeLayout({ children }: { children: ReactNode }) {
  const merchant = await requireMerchant();
  const session = await auth();
  return (
    <div className="min-h-dvh bg-surface">
      <header className="border-b border-black/8 bg-white">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link href="/studio" aria-label="Studio home">
            <Logo size={30} />
          </Link>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted-strong sm:inline">
              {merchant.name} · {session?.user?.email}
            </span>
            <form
              action={async () => {
                "use server";
                await signOut({ redirectTo: "/" });
              }}
            >
              <button type="submit" className="flex items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold hover:bg-surface">
                <LogOut size={15} aria-hidden="true" /> Sign out
              </button>
            </form>
          </div>
        </div>
      </header>
      <main id="main" className="mx-auto max-w-6xl px-5 py-10 sm:px-8 sm:py-14">
        {children}
      </main>
    </div>
  );
}
