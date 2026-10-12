import Link from "next/link";
import { Button } from "@/components/ui/button";
import { signOutAction } from "@/features/auth/actions";
import { Logo } from "@/features/brand/logo";

export function DashboardHeader({ email }: { email: string }) {
  return (
    <header className="wrap flex flex-wrap items-center justify-between gap-3 py-4">
      <Link href="/" className="press -mx-2 inline-flex min-h-11 items-center rounded-lg px-2" aria-label="babel, home">
        <Logo />
      </Link>
      <div className="flex min-w-0 items-center gap-2 sm:gap-4">
        <span className="hidden max-w-[240px] truncate text-sm font-semibold text-muted md:inline" title={email}>
          {email}
        </span>
        <Link
          href="/pricing"
          className="press inline-flex min-h-11 items-center rounded-full px-3 font-bold text-ink underline-offset-4 hover:underline"
        >
          Plans
        </Link>
        <form action={signOutAction}>
          <Button type="submit" variant="outline" className="min-h-11 px-4">
            Sign out
          </Button>
        </form>
      </div>
    </header>
  );
}
