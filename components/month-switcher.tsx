import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths } from "@/lib/budgets";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function MonthSwitcher({
  month,
  basePath,
}: {
  month: string;
  basePath: string;
}) {
  const label = new Date(`${month}-01T00:00:00Z`).toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });

  return (
    <div className="flex items-center gap-1">
      {/*
        Not `<Button asChild>`: this project's Button wraps Base UI's, which
        composes via a `render` prop, not shadcn's `asChild`. The established
        pattern for a link styled as a button (see the "Add an account" link
        in transactions/page.tsx) is `buttonVariants()` applied directly to
        the anchor.
      */}
      <Link
        href={`${basePath}?month=${addMonths(month, -1)}`}
        aria-label="Previous month"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </Link>
      <span className="min-w-40 text-center">{label}</span>
      <Link
        href={`${basePath}?month=${addMonths(month, 1)}`}
        aria-label="Next month"
        className={cn(buttonVariants({ variant: "ghost", size: "icon" }))}
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
