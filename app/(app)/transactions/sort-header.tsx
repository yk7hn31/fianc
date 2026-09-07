"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { ChevronDown, ChevronUp } from "lucide-react";

export function SortHeader({
  column,
  children,
}: {
  column: "date" | "amount" | "payee";
  children: React.ReactNode;
}) {
  const params = useSearchParams();
  const active = (params.get("sort") ?? "date") === column;
  const dir = params.get("dir") === "asc" ? "asc" : "desc";

  const next = new URLSearchParams(params);
  next.set("sort", column);
  next.set("dir", active && dir === "desc" ? "asc" : "desc");
  next.delete("page");

  return (
    <Link
      href={`/transactions?${next.toString()}`}
      className="inline-flex items-center gap-1"
      aria-sort={active ? (dir === "asc" ? "ascending" : "descending") : "none"}
    >
      {children}
      {active &&
        (dir === "asc" ? (
          <ChevronUp className="size-3" strokeWidth={1.5} />
        ) : (
          <ChevronDown className="size-3" strokeWidth={1.5} />
        ))}
    </Link>
  );
}
