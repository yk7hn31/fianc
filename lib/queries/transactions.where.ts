import { and, eq, gte, ilike, lte, or } from "drizzle-orm";
import { transactions } from "@/lib/db/schema";
import { escapeLike, type TxFilters } from "./transactions.filters";

/**
 * The list query's WHERE clause, kept in its own module — and deliberately
 * without `server-only` — so tests can reach it: lib/queries/transactions.ts
 * imports the database connection and cannot be loaded in a node test, which
 * is the same reason `escapeLike` lives outside it. `@/lib/db/schema` is pure
 * table definitions and opens no connection, so importing it here is safe.
 *
 * Both behaviours that matter most are invisible in the returned rows — a
 * missing tenant scope still returns rows, just other people's — so they are
 * asserted against the compiled SQL in transactions.test.ts.
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
