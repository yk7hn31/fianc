"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function Pagination({
  page,
  pageSize,
  total,
}: {
  page: number;
  pageSize: number;
  total: number;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const lastPage = Math.max(1, Math.ceil(total / pageSize));
  if (lastPage === 1) return null;

  function go(to: number) {
    const next = new URLSearchParams(params);
    next.set("page", String(to));
    router.push(`/transactions?${next.toString()}`);
  }

  return (
    <div className="mt-4 flex items-center justify-between gap-3">
      <Button
        variant="outline"
        className="h-11"
        disabled={page <= 1}
        onClick={() => go(page - 1)}
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
        Previous
      </Button>
      <span className="text-muted-foreground tabular-nums">
        Page {page} of {lastPage}
      </span>
      <Button
        variant="outline"
        className="h-11"
        disabled={page >= lastPage}
        onClick={() => go(page + 1)}
      >
        Next
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </Button>
    </div>
  );
}
