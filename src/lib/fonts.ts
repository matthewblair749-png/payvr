/**
 * Font registry.
 *
 * Brand fonts (Sora + DM Sans) are preloaded. The extra checkout fonts are
 * declared but NOT preloaded: browsers only download a @font-face when text
 * actually uses it, so offering them in the editor costs nothing until picked.
 */
import { DM_Sans, Fraunces, IBM_Plex_Mono, Sora, Space_Grotesk } from "next/font/google";

export const sora = Sora({
  subsets: ["latin"],
  weight: "700",
  variable: "--font-sora",
  display: "swap",
});

export const dmSans = DM_Sans({
  subsets: ["latin"],
  variable: "--font-dm-sans",
  display: "swap",
});

export const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  display: "swap",
  preload: false,
});

export const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-space-grotesk",
  display: "swap",
  preload: false,
});

export const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--font-plex-mono",
  display: "swap",
  preload: false,
});

/** All font CSS variables, applied once on <html>. */
export const fontVariables = [sora, dmSans, fraunces, spaceGrotesk, plexMono]
  .map((f) => f.variable)
  .join(" ");
