import { cn } from "@/lib/utils";

/**
 * The spend-vs-available bar shared by the budgets list and the dashboard's
 * compact budgets card. Pulled out because the two call sites had each grown
 * their own copy of this math and the two `pct` formulas had quietly
 * diverged — the budgets page read 0% when a category had neither a budget
 * nor any spend, the dashboard read 100% for the same inputs. One
 * implementation is what keeps that from happening again.
 */
export function BudgetProgressBar({
  spentMinor,
  availableMinor,
}: {
  spentMinor: number;
  availableMinor: number;
}) {
  const over = spentMinor > availableMinor;
  const pct =
    availableMinor > 0
      ? Math.min(100, (spentMinor / availableMinor) * 100)
      : spentMinor > 0
        ? 100
        : 0;

  return (
    <div className="h-1.5 rounded-pill bg-muted overflow-hidden">
      {/*
        `.t-resize` tweens the fill between two percentages instead of
        snapping. The width is server-rendered, so this reads as motion
        exactly where it should: saving a budget amount, or toggling
        rollover, revalidates the row and the bar travels to its new
        length rather than teleporting under the number that caused it.
      */}
      <div
        className={cn(
          "t-resize h-full",
          over ? "bg-destructive" : "bg-foreground",
        )}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
