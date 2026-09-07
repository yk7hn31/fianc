import "server-only";
import { and, asc, eq, lte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import { budgets, categories, transactions } from "@/lib/db/schema";
import { foldRollover, monthRange, type BudgetRow, type SpendRow } from "@/lib/budgets";

export interface CategoryBudget {
  categoryId: string;
  name: string;
  icon: string;
  budgetMinor: number;
  carryMinor: number;
  availableMinor: number;
  spentMinor: number;
  remainingMinor: number;
  rollover: boolean;
}

/**
 * Reads every budget row and every month of spend for the user up to `month`,
 * then folds rollover forward per category. Reading history is what makes the
 * carry correct without storing it.
 */
export async function getBudgetMonth(
  userId: string,
  month: string, // "YYYY-MM"
): Promise<CategoryBudget[]> {
  const monthEnd = `${month}-01`;

  const [budgetRows, spendRows, categoryRows] = await Promise.all([
    db
      .select({
        categoryId: budgets.categoryId,
        month: sql<string>`to_char(${budgets.month}, 'YYYY-MM')`,
        amountMinor: budgets.amountMinor,
        rollover: budgets.rollover,
      })
      .from(budgets)
      .where(and(eq(budgets.userId, userId), lte(budgets.month, monthEnd))),
    db
      .select({
        categoryId: transactions.categoryId,
        month: sql<string>`to_char(${transactions.date}, 'YYYY-MM')`,
        spentMinor: sql<number>`sum(${transactions.amountMinor})`,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, userId),
          eq(transactions.type, "expense"),
          sql`to_char(${transactions.date}, 'YYYY-MM') <= ${month}`,
        ),
      )
      .groupBy(transactions.categoryId, sql`to_char(${transactions.date}, 'YYYY-MM')`),
    db
      .select()
      .from(categories)
      .where(and(eq(categories.userId, userId), eq(categories.kind, "expense")))
      .orderBy(asc(categories.name)),
  ]);

  const earliest =
    budgetRows.map((b) => b.month).sort()[0] ?? month;
  const months = monthRange(earliest <= month ? earliest : month, month);

  return categoryRows
    .filter((c) => !c.archivedAt)
    .map((category) => {
      const b: BudgetRow[] = budgetRows
        .filter((r) => r.categoryId === category.id)
        .map((r) => ({
          month: r.month,
          amountMinor: Number(r.amountMinor),
          rollover: r.rollover,
        }));
      const s: SpendRow[] = spendRows
        .filter((r) => r.categoryId === category.id)
        .map((r) => ({ month: r.month, spentMinor: Number(r.spentMinor) }));

      const state = foldRollover(b, s, months).at(-1)!;
      return {
        categoryId: category.id,
        name: category.name,
        icon: category.icon,
        rollover: b.find((r) => r.month === month)?.rollover ?? false,
        ...state,
      };
    });
}
