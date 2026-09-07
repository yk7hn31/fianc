"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function BottomNav() {
  const pathname = usePathname();
  const primary = NAV_ITEMS.filter((i) => i.primary);

  return (
    <nav
      aria-label="Primary"
      className="md:hidden fixed inset-x-0 bottom-0 z-40 bg-paper border-t border-border pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="grid grid-cols-4">
        {primary.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-[56px] flex-col items-center justify-center gap-1 text-caption",
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
          <Link
            href="/settings"
            className="flex min-h-[56px] flex-col items-center justify-center gap-1 text-caption text-muted-foreground"
          >
            <MoreHorizontal className="size-5" strokeWidth={1.5} />
            More
          </Link>
        </li>
      </ul>
    </nav>
  );
}
