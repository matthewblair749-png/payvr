import type { Metadata, Viewport } from "next";
import "@fontsource-variable/nunito";
import "@fontsource-variable/manrope";
import "./globals.css";
import { SITE } from "@/config/site";

export const metadata: Metadata = {
  title: { default: `babel · ${SITE.tagline}`, template: "%s · babel" },
  description: SITE.description,
};

export const viewport: Viewport = {
  themeColor: "#FFF6EC",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>
        <a href="#main" className="skip-link">
          Skip to content
        </a>
        {children}
      </body>
    </html>
  );
}
