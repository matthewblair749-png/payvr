import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function CheckoutNotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <LogoMark size={56} title="" />
      <h1 className="font-display text-3xl font-bold tracking-[-0.04em]">This checkout isn&apos;t available</h1>
      <p className="max-w-sm text-muted-strong">The link may be mistyped, or the shop hasn&apos;t published it yet.</p>
      <Link href="/" className="font-semibold text-orange-deep underline underline-offset-4">
        What is lumen?
      </Link>
    </main>
  );
}
