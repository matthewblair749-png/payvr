import Link from "next/link";
import { LogoMark } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main id="main" className="grid min-h-dvh place-items-center px-6 text-center">
      <div className="max-w-md">
        <LogoMark size={44} className="mx-auto" />
        <h1 className="mt-6 text-3xl font-heavy tracking-tighter text-ink">This page doesn&apos;t exist</h1>
        <p className="mt-3 text-[15px] text-muted">It may have moved, or the link may be wrong.</p>
        <Link href="/" className="mt-8 inline-flex h-11 items-center rounded-full bg-ink px-5 font-heavy text-white hover:bg-ink-2">
          Go to PIVOT
        </Link>
      </div>
    </main>
  );
}
