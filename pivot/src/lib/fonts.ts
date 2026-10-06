import { Inter } from "next/font/google";

/**
 * One family, two weights: 400 for body and UI, 800 for headlines and
 * figures. Loading exactly two static weights keeps it to two font files.
 */
export const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "800"],
  variable: "--font-inter",
  display: "swap",
});
