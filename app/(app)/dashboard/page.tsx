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
  const budgetRemaining = budgetRows.reduce((sum, r) => sum + r.remainingMinor, 0);

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
                .filter((r) => r.availableMinor > 0 || r.spentMinor > 0)
                .slice(0, 6)
                .map((r) => {
                  const over = r.remainingMinor < 0;
                  const pct =
                    r.availableMinor > 0
                      ? Math.min(100, (r.spentMinor / r.availableMinor) * 100)
                      : 100;
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
                      <div className="h-1.5 rounded-pill bg-muted overflow-hidden">
                        <div
                          className={over ? "h-full bg-destructive" : "h-full bg-foreground"}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </li>
                  );
                })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <h2 className="text-subheading font-medium mb-3">Recent</h2>
      <TransactionList rows={recent.rows} currency={currency} />
      <TransactionTable rows={recent.rows} currency={currency} />

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
