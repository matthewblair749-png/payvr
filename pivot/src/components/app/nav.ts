import { Database, FileText, HeartPulse, LayoutDashboard, Lightbulb, ListOrdered, Radar, Settings, SlidersHorizontal, type LucideIcon } from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Badge key filled in by the shell. */
  badge?: "insights";
}

export const NAV: NavItem[] = [
  { href: "", label: "Overview", icon: LayoutDashboard },
  { href: "/health", label: "Business Health", icon: HeartPulse },
  { href: "/insights", label: "Insights", icon: Lightbulb, badge: "insights" },
  { href: "/opportunities", label: "Opportunities", icon: Radar },
  { href: "/what-if", label: "What If?", icon: SlidersHorizontal },
  { href: "/recommendations", label: "Recommendations", icon: ListOrdered },
  { href: "/data", label: "Data", icon: Database },
  { href: "/reports", label: "Reports", icon: FileText },
  { href: "/settings", label: "Settings", icon: Settings },
];

export function isActive(pathname: string, base: string, href: string) {
  const full = base + href;
  return href === "" ? pathname === base : pathname === full || pathname.startsWith(full + "/");
}
