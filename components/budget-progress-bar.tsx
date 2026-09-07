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
      <div
        className={over ? "h-full bg-destructive" : "h-full bg-foreground"}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}
