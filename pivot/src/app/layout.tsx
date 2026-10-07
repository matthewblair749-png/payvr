import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { inter } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PIVOT — Find the next move.", template: "%s · PIVOT" },
  description:
    "PIVOT turns business data into decisions. Understand what is happening, discover opportunities, simulate strategic decisions, and find the moves with the biggest impact.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
  openGraph: {
    title: "PIVOT — Find the next move.",
    description: "PIVOT turns business data into decisions.",
    type: "website",
    siteName: "PIVOT",
  },
  applicationName: "PIVOT",
};

export const viewport: Viewport = {
  themeColor: "#ffffff",
  colorScheme: "light",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers opts every page into per-request rendering, which
  // is required for the CSP nonce (set in src/proxy.ts) to reach Next's scripts.
  await headers();
  return (
    <html lang="en" className={inter.variable} data-scroll-behavior="smooth">
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-[100] rounded-lg bg-ink px-4 py-2 text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
