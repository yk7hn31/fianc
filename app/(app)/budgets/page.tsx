import { requireUser } from "@/lib/auth/guard";
import { getBudgetMonth } from "@/lib/queries/budgets";
import { monthKey } from "@/lib/budgets";
import { AppHeader } from "@/components/app-shell/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { Button } from "@/components/ui/button";
import { BudgetRow } from "./budget-row";
import { copyLastMonth } from "./actions";

export default async function BudgetsPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : monthKey(new Date());
  const rows = await getBudgetMonth(user.id, month);

  return (
    <>
      <AppHeader title="Budgets" />
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <MonthSwitcher month={month} basePath="/budgets" />
        {/*
          Not `copyLastMonth.bind(null, month)` passed directly: the action
          returns `ActionResult`, but a form's `action` prop is typed as
          `(formData: FormData) => void | Promise<void>`. The wrapper
          discards the result to satisfy that signature — nothing here needs
          to react to failure, since a no-op copy (nothing to copy from) is
          indistinguishable from success and there is nothing to roll back.
        */}
        <form
          action={async () => {
            "use server";
            await copyLastMonth(month);
          }}
        >
          <Button variant="secondary" type="submit">
            Copy last month
          </Button>
        </form>
      </div>

      <ul className="rounded-card bg-card border border-border shadow-card divide-y divide-border">
        {rows.map((row) => (
          <BudgetRow
            key={row.categoryId}
            row={row}
            month={month}
            currency={user.baseCurrency}
          />
        ))}
      </ul>
    </>
  );
}
