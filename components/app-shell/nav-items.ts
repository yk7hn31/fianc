import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  Tags,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  href: string;
  label: string;
  icon: LucideIcon;
  /** Shown in the mobile bottom bar rather than under "More". */
  primary: boolean;
}

export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, primary: true },
  { href: "/transactions", label: "Transactions", icon: ArrowLeftRight, primary: true },
  { href: "/budgets", label: "Budgets", icon: Target, primary: true },
  { href: "/accounts", label: "Accounts", icon: Wallet, primary: false },
  { href: "/categories", label: "Categories", icon: Tags, primary: false },
  // No Settings entry: `/settings` is in the spec's page list but has no
  // route on this branch, so linking it from the sidebar and from the mobile
  // "More" tab sent users to a 404 from primary navigation. It comes back
  // when the page does.
];

/**
 * Segment-aware, so /transactions/123 lights Transactions while a future
 * sibling like /categories-archive cannot light Categories. A bare
 * startsWith() is safe only by coincidence of today's href list.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
