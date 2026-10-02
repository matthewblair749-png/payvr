import type { Metadata, Viewport } from "next";
import { cookies, headers } from "next/headers";
import { MotionProvider } from "@/components/motion-provider";
import { fontVariables } from "@/lib/fonts";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "lumen — The checkout that learns", template: "%s · lumen" },
  description:
    "Design a checkout that looks exactly like your brand, take payments with Stripe, and learn why customers buy.",
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"),
};

export const viewport: Viewport = {
  themeColor: "#F04A1A",
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // Reading request headers opts every page into per-request rendering, which
  // is required for the CSP nonce (set in src/proxy.ts) to reach Next's scripts.
  await headers();
  // App theme: "light" | "dark" pins it; anything else follows the system.
  const theme = (await cookies()).get("lumen_theme")?.value;
  return (
    <html
      lang="en"
      className={fontVariables}
      data-scroll-behavior="smooth"
      data-theme={theme === "light" || theme === "dark" ? theme : undefined}
    >
      <body className="min-h-dvh">
        <a
          href="#main"
          className="sr-only z-50 rounded-full bg-ink px-4 py-2 font-semibold text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
        >
          Skip to content
        </a>
        <MotionProvider>{children}</MotionProvider>
      </body>
    </html>
  );
}
