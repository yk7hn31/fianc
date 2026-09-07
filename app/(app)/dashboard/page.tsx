import { Suspense } from "react";
import { Plus } from "lucide-react";
import { requireUser } from "@/lib/auth/guard";
import { monthTotals, spendByCategory, listTransactions, normaliseFilters } from "@/lib/queries/transactions";
import { getBudgetMonth } from "@/lib/queries/budgets";
import { listActiveAccounts } from "@/lib/queries/accounts";
import { listCategories } from "@/lib/queries/categories";
import { monthKey } from "@/lib/budgets";
import { formatAmount } from "@/lib/money";
import { AppHeader } from "@/components/app-shell/app-header";
import { MonthSwitcher } from "@/components/month-switcher";
import { StatBlock } from "@/components/stat-block";
import { AddFabTrigger } from "@/components/app-shell/add-fab";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { BudgetProgressBar } from "@/components/budget-progress-bar";
import { TransactionForm } from "../transactions/transaction-form";
import { TransactionList } from "../transactions/transaction-list";
import { TransactionTable } from "../transactions/transaction-table";
import { SpendDonut } from "./spend-donut";

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const user = await requireUser();
  const { month: raw } = await searchParams;
  const month = raw && /^\d{4}-\d{2}$/.test(raw) ? raw : monthKey(new Date());
  const currency = user.baseCurrency;

  const [totals, byCategory, budgetRows, recent, accounts, categories] =
    await Promise.all([
      monthTotals(user.id, month),
      spendByCategory(user.id, month),
      getBudgetMonth(user.id, month),
      listTransactions(user.id, normaliseFilters({ pageSize: "10" })),
      listActiveAccounts(user.id),
      listCategories(user.id),
    ]);

  const net = totals.incomeMinor - totals.expenseMinor;
  // A category with no budget row this month (and no carry from a rollover
  // month) reads remainingMinor as -spentMinor — real spend, but not an
  // overrun of anything the user actually budgeted. Summing that into
  // "Budget left" and rendering it as a destructive bar under "Budgets"
  // reported ordinary unbudgeted spend as a budget overrun for anyone who
  // hasn't set a budget yet. `availableMinor > 0` isn't the right guard
  // either — that would silently drop a category that's genuinely carrying
  // negative debt into this month.
  const budgeted = (r: (typeof budgetRows)[number]) =>
    r.budgetMinor !== 0 || r.carryMinor !== 0;
  const budgetRemaining = budgetRows
    .filter(budgeted)
    .reduce((sum, r) => sum + r.remainingMinor, 0);

  return (
    <>
      <AppHeader title="Dashboard" />
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <MonthSwitcher month={month} basePath="/dashboard" />
        <div className="hidden md:block">
          <TransactionForm
            accounts={accounts}
            categories={categories}
            trigger={
              <Button>
                <Plus className="size-4" strokeWidth={1.5} />
                New transaction
              </Button>
            }
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-5 md:grid-cols-4 mb-8">
        <StatBlock label="Income" value={formatAmount(totals.incomeMinor, currency)} />
        <StatBlock label="Expense" value={formatAmount(totals.expenseMinor, currency)} />
        <StatBlock label="Net" value={formatAmount(net, currency)} />
        <StatBlock
          label="Budget left"
          value={formatAmount(budgetRemaining, currency)}
        />
      </div>

      <div className="grid gap-5 md:grid-cols-2 mb-8">
        <Card>
          <CardContent className="p-5">
            <p className="text-caption uppercase text-muted-foreground mb-3">
              Spend by category
            </p>
            <SpendDonut data={byCategory} currency={currency} />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <p className="text-caption uppercase text-muted-foreground mb-3">
              Budgets
            </p>
            <ul className="space-y-3">
              {budgetRows
                .filter(budgeted)
                .slice(0, 6)
                .map((r) => {
                  const over = r.remainingMinor < 0;
                  return (
                    <li key={r.categoryId}>
                      <div className="flex justify-between mb-1">
                        <span>{r.name}</span>
                        <span
                          className={
                            over ? "text-destructive tabular-nums" : "tabular-nums"
                          }
                        >
                          {formatAmount(r.remainingMinor, currency)} left
                        </span>
                      </div>
                      <BudgetProgressBar
                        spentMinor={r.spentMinor}
                        availableMinor={r.availableMinor}
                      />
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-subheading font-medium mb-3">Recent</h2>
      {/*
        TransactionTable's sortable headers read the URL with useSearchParams,
        which Next.js requires a Suspense boundary above — the transactions
        page (also a consumer of these two components) needs the same wrapper.
      */}
      <Suspense>
        <TransactionList
          rows={recent.rows}
          currency={currency}
          accounts={accounts}
          categories={categories}
        />
        <TransactionTable
          rows={recent.rows}
          currency={currency}
          accounts={accounts}
          categories={categories}
        />
      </Suspense>

      <div className="md:hidden">
        <TransactionForm
          accounts={accounts}
          categories={categories}
          trigger={<AddFabTrigger />}
        />
      </div>
    </>
  );
}
