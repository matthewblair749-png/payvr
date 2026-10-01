import { FlaskConical, Home, LineChart, type LucideIcon, Palette, Receipt, Settings, Users } from 'lucide-react';

/** The sidebar is organized by jobs, not by data tables. */
export type NavItem = { href: string; label: string; icon: LucideIcon; job: string };

export const NAV: NavItem[] = [
  { href: '/', label: 'Home', icon: Home, job: 'See how the business is doing' },
  { href: '/payments', label: 'Payments', icon: Receipt, job: 'Find, refund and resolve payments' },
  { href: '/customers', label: 'Customers', icon: Users, job: 'Know who buys and who comes back' },
  { href: '/insights', label: 'Insights', icon: LineChart, job: 'Understand what is changing and why' },
  { href: '/experiments', label: 'Experiments', icon: FlaskConical, job: 'Test prices and checkout ideas' },
  { href: '/checkout-studio', label: 'Checkout Studio', icon: Palette, job: 'Design and publish your checkout' },
];

export const NAV_FOOTER: NavItem[] = [{ href: '/settings', label: 'Settings', icon: Settings, job: 'Payouts, team and account' }];

export const ALL_NAV = [...NAV, ...NAV_FOOTER];
