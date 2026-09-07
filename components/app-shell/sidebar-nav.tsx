"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV_ITEMS } from "./nav-items";
import { cn } from "@/lib/utils";

export function SidebarNav({ userName }: { userName: string }) {
  const pathname = usePathname();

  return (
    <aside className="hidden md:flex md:w-60 md:shrink-0 md:flex-col bg-sidebar min-h-dvh p-4">
      <div className="px-2 py-3">
        <span className="text-subheading font-semibold tracking-tight">fianc</span>
      </div>
      <nav className="flex flex-col gap-1 mt-2">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-2 rounded-pill px-3 py-2 text-body",
                active
                  ? "bg-paper text-foreground shadow-card"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icon className="size-4" strokeWidth={1.5} />
              {label}
            </Link>
          );
        })}
      </nav>
      <p className="mt-auto px-3 text-caption text-muted-foreground">{userName}</p>
    </aside>
  );
}
