import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-surface px-6 text-center">
      <LogoMark size={64} title="" />
      <h1 className="font-display text-4xl font-bold tracking-[-0.05em]">Nothing here</h1>
      <p className="max-w-sm text-muted-strong">That page doesn&apos;t exist, or it moved.</p>
      <Link href="/" className="rounded-full bg-ink px-6 py-3 font-semibold text-white">
        Go home
      </Link>
    </main>
  );
}
