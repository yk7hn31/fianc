"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { NAV_ITEMS, isNavItemActive } from "./nav-items";
import { ResponsiveDialog } from "@/components/responsive/responsive-dialog";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const [moreOpen, setMoreOpen] = useState(false);
  const primary = NAV_ITEMS.filter((i) => i.primary);
  const secondary = NAV_ITEMS.filter((i) => !i.primary);
  const moreActive = secondary.some((i) => isNavItemActive(pathname, i.href));

  const cell =
    "flex min-h-[56px] w-full flex-col items-center justify-center gap-1 text-caption";

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-paper border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      {/*
        Derived, not a literal grid-cols-4: the cell count is the primary items
        plus "More", and flipping one NAV_ITEMS entry to primary would
        otherwise wrap a fifth cell onto its own row without a word.
      */}
      <ul
        className="grid"
        style={{
          gridTemplateColumns: `repeat(${primary.length + 1}, minmax(0, 1fr))`,
        }}
      >
        {primary.map(({ href, label, icon: Icon }) => {
          const active = isNavItemActive(pathname, href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  cell,
                  active ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <Icon className="size-5" strokeWidth={1.5} />
                {label}
              </Link>
            </li>
          );
        })}
        <li>
          {/*
            A sheet over the remaining nav items, not a link. This tab used to
            point straight at /settings — a route this branch never built, so
            one of four mobile tabs was a 404 — and the spec's bottom bar is
            "Dashboard, Transactions, Budgets, More", so collapsing to five
            flat tabs is not the fix either. "More" now does what it says and
            reveals the items that do not fit the bar.
          */}
          <ResponsiveDialog
            open={moreOpen}
            onOpenChange={setMoreOpen}
            title="More"
            description="The rest of the app."
            trigger={
              <button
                type="button"
                className={cn(
                  cell,
                  moreActive ? "text-foreground" : "text-muted-foreground",
                )}
              >
                <MoreHorizontal className="size-5" strokeWidth={1.5} />
                More
              </button>
            }
          >
            <ul className="pb-2">
              {secondary.map(({ href, label, icon: Icon }) => {
                const active = isNavItemActive(pathname, href);
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      aria-current={active ? "page" : undefined}
                      // Closing on click, not on the route change: the sheet
                      // lives outside the router's rendered tree, so nothing
                      // else would ever dismiss it and the destination page
                      // would load behind a still-open overlay.
                      onClick={() => setMoreOpen(false)}
                      className={cn(
                        "flex min-h-[56px] items-center gap-3 rounded-pill px-3",
                        active ? "text-foreground" : "text-muted-foreground",
                      )}
                    >
                      <Icon className="size-5" strokeWidth={1.5} />
                      {label}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </ResponsiveDialog>
        </li>
      </ul>
    </nav>
  );
}
