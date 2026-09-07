import { describe, it, expect } from "vitest";
import { PgDialect, QueryBuilder } from "drizzle-orm/pg-core";
import { budgets, categories, transactions } from "@/lib/db/schema";
import {
  budgetCategoriesWhere,
  budgetRowsWhere,
  budgetSpendWhere,
} from "./budgets.where";

/**
 * The tenant scope on each of `getBudgetMonth`'s three reads.
 *
 * The end-to-end tenancy spec covers the other five read models by showing
 * one user another user's data, but it cannot reach the budget rows: the fold
 * matches them by `categoryId`, category ids are per-user, so another
 * tenant's rows are filtered out downstream even when the query returns them.
 * Deleting `eq(budgets.userId, userId)` is invisible on screen and visible
 * only here, in the SQL — verified by deleting it and watching the e2e still
 * pass and this file fail.
 */
describe("getBudgetMonth clauses", () => {
  const dialect = new PgDialect();
  const userId = "1b0f3e3a-4d5c-4a1e-9c2b-8f6a7d5e4c3b";

  function compile(
    table: typeof budgets | typeof transactions | typeof categories,
    where: ReturnType<typeof budgetRowsWhere>,
  ) {
    const query = new QueryBuilder()
      .select({ id: table.id })
      .from(table)
      .where(where);
    return dialect.sqlToQuery(query.getSQL());
  }

  it("scopes the budget rows to the calling user", () => {
    const { sql, params } = compile(budgets, budgetRowsWhere(userId, "2026-03"));
    expect(sql).toContain('"budgets"."user_id" = $1');
    expect(params[0]).toBe(userId);
  });

  it("reads budget rows up to and including the requested month", () => {
    const { sql, params } = compile(budgets, budgetRowsWhere(userId, "2026-03"));
    expect(sql).toContain('"budgets"."month" <= $2');
    // The first of the month: budgets.month is always a month-start date, so
    // "<= 2026-03-01" includes March itself.
    expect(params[1]).toBe("2026-03-01");
  });

  it("scopes the spend read to the calling user and to expenses", () => {
    const { sql, params } = compile(
      transactions,
      budgetSpendWhere(userId, "2026-03"),
    );
    expect(sql).toContain('"transactions"."user_id" = $1');
    expect(sql).toContain('"transactions"."type" = $2');
    expect(params[0]).toBe(userId);
    expect(params[1]).toBe("expense");
    // Transfers and income must not be counted as budget spend.
    expect(params[2]).toBe("2026-03");
  });

  it("scopes the category read to the calling user and to expense categories", () => {
    const { sql, params } = compile(categories, budgetCategoriesWhere(userId));
    expect(sql).toContain('"categories"."user_id" = $1');
    expect(sql).toContain('"categories"."kind" = $2');
    expect(params).toEqual([userId, "expense"]);
  });
});
