import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { auth } from "@/features/auth/auth";
import { ConnectExtension } from "@/features/extension/components/connect-extension";
import { SiteHeader } from "@/features/landing/site-header";

export const metadata: Metadata = { title: "Connect the extension", robots: { index: false } };

export default async function ConnectExtensionPage() {
  const session = await auth();
  if (!session?.user) redirect(`/signin?callbackUrl=${encodeURIComponent("/extension/connect")}`);
  return (
    <>
      <SiteHeader />
      <main id="main" className="wrap py-12 sm:py-16">
        <ConnectExtension />
      </main>
    </>
  );
}
