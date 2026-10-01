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

/** Global date range, shared by every page through the `range` query param. */
export const RANGES = [
  { value: "7", label: "7d", long: "Last 7 days" },
  { value: "30", label: "30d", long: "Last 30 days" },
  { value: "90", label: "90d", long: "Last 90 days" },
] as const;
export type RangeValue = (typeof RANGES)[number]["value"];
export const DEFAULT_RANGE: RangeValue = "30";
export function parseRange(v: unknown): RangeValue {
  return RANGES.some((r) => r.value === v) ? (v as RangeValue) : DEFAULT_RANGE;
}

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
