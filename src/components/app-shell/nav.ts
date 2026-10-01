import { ChartLine, CreditCard, FlaskConical, House, LayoutTemplate, Settings, Users, type LucideIcon } from "lucide-react";

/** Sidebar navigation, organized by the merchant's jobs. */
export type NavItem = { href: string; label: string; icon: LucideIcon; match: (path: string) => boolean };

const under = (...prefixes: string[]) => (path: string) => prefixes.some((p) => path === p || path.startsWith(`${p}/`));

export const NAV: NavItem[] = [
  { href: "/studio", label: "Home", icon: House, match: (p) => p === "/studio" },
  { href: "/studio/orders", label: "Payments", icon: CreditCard, match: under("/studio/orders") },
  { href: "/studio/customers", label: "Customers", icon: Users, match: under("/studio/customers") },
  { href: "/studio/dashboard", label: "Insights", icon: ChartLine, match: under("/studio/dashboard", "/studio/research") },
  { href: "/studio/experiments", label: "Experiments", icon: FlaskConical, match: under("/studio/experiments") },
  { href: "/studio/checkouts", label: "Checkout Studio", icon: LayoutTemplate, match: under("/studio/checkouts", "/studio/pages") },
  { href: "/studio/settings", label: "Settings", icon: Settings, match: under("/studio/settings", "/studio/payments") },
];

export { DEFAULT_RANGE, parseRange, RANGES, type RangeValue } from "@/lib/date-range";
import { DEFAULT_RANGE, type RangeValue } from "@/lib/date-range";

/** Keep the global range when moving between pages. */
export function withRange(href: string, range: RangeValue) {
  return range === DEFAULT_RANGE ? href : `${href}?range=${range}`;
}

export const SIDEBAR_COOKIE = "lumen_sidebar";
export const THEME_COOKIE = "lumen_theme";
export type ThemePref = "system" | "light" | "dark";

export function setCookie(name: string, value: string) {
  document.cookie = `${name}=${value}; path=/; max-age=31536000; samesite=lax`;
}
