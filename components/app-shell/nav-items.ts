import {
  LayoutDashboard,
  ArrowLeftRight,
  Target,
  Wallet,
  Tags,
  Settings,
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
  { href: "/settings", label: "Settings", icon: Settings, primary: false },
];

/**
 * Segment-aware, so /transactions/123 lights Transactions while a future
 * sibling like /settings2 cannot light Settings. A bare startsWith() is safe
 * only by coincidence of today's href list.
 */
export function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}
