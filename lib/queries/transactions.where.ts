import { and, asc, desc, eq, gte, ilike, lte, or } from "drizzle-orm";
import { transactions } from "@/lib/db/schema";
import { escapeLike, type TxFilters } from "./transactions.filters";

/**
 * The list query's WHERE and ORDER BY clauses, kept in their own module — and
 * deliberately without `server-only` — so tests can reach them:
 * lib/queries/transactions.ts imports the database connection and cannot be
 * loaded in a node test, which is the same reason `escapeLike` lives outside
 * it. `@/lib/db/schema` is pure table definitions and opens no connection, so
 * importing it here is safe.
 *
 * Both behaviours that matter most are invisible in the returned rows — a
 * missing tenant scope still returns rows, just other people's, and a wrong
 * sort column or direction still returns the same rows, just misordered — so
 * they are asserted against the compiled SQL in transactions.test.ts.
 */
export function buildTxWhere(userId: string, f: TxFilters) {
  // `escapeLike` is not optional dressing: without it a search for "50%" or
  // "cash_out" turns the user's own text into wildcards and matches rows it
  // has nothing to do with.
  const pattern = f.q ? `%${escapeLike(f.q)}%` : undefined;

  return and(
    eq(transactions.userId, userId),
    f.from ? gte(transactions.date, f.from) : undefined,
    f.to ? lte(transactions.date, f.to) : undefined,
    f.accountId ? eq(transactions.accountId, f.accountId) : undefined,
    f.categoryId ? eq(transactions.categoryId, f.categoryId) : undefined,
    f.type ? eq(transactions.type, f.type) : undefined,
    pattern
      ? or(
          ilike(transactions.payee, pattern),
          ilike(transactions.note, pattern),
        )
      : undefined,
  );
}

/**
 * The list query's ORDER BY clause. `createdAt desc` is always the
 * tiebreaker, appended after whichever column the user picked, so two rows
 * that tie on date (or amount, or payee) still come back in a stable,
 * newest-first order rather than whatever order the query plan happened to
 * produce.
 */
export function buildTxOrder(f: TxFilters) {
  const column =
    f.sort === "amount"
      ? transactions.amountMinor
      : f.sort === "payee"
        ? transactions.payee
        : transactions.date;
  const order = f.dir === "asc" ? asc : desc;
  return [order(column), desc(transactions.createdAt)] as const;
}
