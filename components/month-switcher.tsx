import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { addMonths } from "@/lib/budgets";
import { buttonVariants } from "@/components/ui/button";
import { MonthLabel } from "@/components/month-label";
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
        // Explicitly 44px, not `size: "icon"`: that variant is `size-8`, and
        // this is the primary control of both the dashboard and the budgets
        // page. See the note on the size variants in components/ui/button.tsx.
        className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-11 p-0")}
      >
        <ChevronLeft className="size-4" strokeWidth={1.5} />
      </Link>
      <MonthLabel label={label} className="min-w-40 text-center" />
      <Link
        href={`${basePath}?month=${addMonths(month, 1)}`}
        aria-label="Next month"
        // Explicitly 44px, not `size: "icon"`: that variant is `size-8`, and
        // this is the primary control of both the dashboard and the budgets
        // page. See the note on the size variants in components/ui/button.tsx.
        className={cn(buttonVariants({ variant: "ghost" }), "h-11 w-11 p-0")}
      >
        <ChevronRight className="size-4" strokeWidth={1.5} />
      </Link>
    </div>
  );
}
