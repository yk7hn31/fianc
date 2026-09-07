import { and, eq, lte, sql } from "drizzle-orm";
import { budgets, categories, transactions } from "@/lib/db/schema";

/**
 * `getBudgetMonth`'s three WHERE clauses, kept in their own module — and
 * deliberately without `server-only` — so tests can reach them, exactly as
 * `transactions.where.ts` does for the list query. `@/lib/db/schema` is pure
 * table definitions and opens no connection.
 *
 * These are extracted for one specific reason. The tenant scope on the
 * *budget rows* is the one scope in the whole read layer that no end-to-end
 * test can observe: `getBudgetMonth` folds each category separately and
 * matches budget rows by `categoryId`, and category ids are themselves
 * per-user, so another tenant's budget rows are dropped by that filter even
 * when the query hands them over. Deleting `eq(budgets.userId, userId)`
 * therefore changes nothing on screen — it only makes the query read every
 * user's budgets on every page load, one schema change away from mattering.
 * Compiling the clause and reading its SQL is the only way to hold it.
 */
export function budgetRowsWhere(userId: string, month: string) {
  return and(eq(budgets.userId, userId), lte(budgets.month, `${month}-01`));
}

/** Expense totals per category per month, up to and including `month`. */
export function budgetSpendWhere(userId: string, month: string) {
  return and(
    eq(transactions.userId, userId),
    eq(transactions.type, "expense"),
    sql`to_char(${transactions.date}, 'YYYY-MM') <= ${month}`,
  );
}

/** The expense categories a budget month has one row for. */
export function budgetCategoriesWhere(userId: string) {
  return and(eq(categories.userId, userId), eq(categories.kind, "expense"));
}
