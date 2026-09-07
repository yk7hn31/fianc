import "server-only";
import { and, count, desc, eq, gte, sql } from "drizzle-orm";
import { db } from "@/lib/db";
import {
  accounts,
  categories,
  transactions,
  type Transaction,
} from "@/lib/db/schema";
import type { TxFilters } from "./transactions.filters";
import { buildTxWhere } from "./transactions.where";

export type { TxFilters };
export { normaliseFilters } from "./transactions.filters";
// Re-exported rather than defined here so this module stays the single import
// site for the list query while the clause itself remains testable; see the
// note in transactions.where.ts.
export { buildTxWhere };

export type TxRow = Transaction & {
  categoryName: string | null;
  categoryIcon: string | null;
  accountName: string;
};

export async function listTransactions(
  userId: string,
  f: TxFilters,
): Promise<{ rows: TxRow[]; total: number }> {
  const clause = buildTxWhere(userId, f);

  const rows = await db
    .select({
      tx: transactions,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      accountName: accounts.name,
    })
    .from(transactions)
    .innerJoin(accounts, eq(accounts.id, transactions.accountId))
    // Left, not inner: a transaction may be uncategorised, and both halves of
    // a transfer always are.
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(clause)
    // `date` is a day, so same-day rows would otherwise come back in whatever
    // order the plan produced; createdAt keeps the newest entry on top.
    .orderBy(desc(transactions.date), desc(transactions.createdAt))
    .limit(f.pageSize)
    .offset((f.page - 1) * f.pageSize);

  const [{ value: total }] = await db
    .select({ value: count() })
    .from(transactions)
    .where(clause);

  return {
    rows: rows.map((r) => ({
      ...r.tx,
      categoryName: r.categoryName,
      categoryIcon: r.categoryIcon,
      accountName: r.accountName,
    })),
    // Postgres counts and sums come back over the wire as strings (see the
    // long note in lib/queries/accounts.ts); the pager does arithmetic on
    // this, so the conversion has to be explicit.
    total: Number(total),
  };
}

/** The last day of `month`, as Postgres reckons it — no JS calendar maths. */
function monthEnd(from: string) {
  return sql`(${from}::date + interval '1 month' - interval '1 day')::date`;
}

/**
 * Totals for the whole calendar month, not month-to-date: the range runs to
 * the last day of the month, and nothing stops a user dating a transaction in
 * the future, so a future-dated row inside `month` is counted.
 *
 * Transfers are excluded: they move money, not earn or spend it.
 */
export async function monthTotals(
  userId: string,
  month: string, // "YYYY-MM"
): Promise<{ incomeMinor: number; expenseMinor: number }> {
  const from = `${month}-01`;

  const [row] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountMinor} else 0 end), 0)`,
      expense: sql<number>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountMinor} else 0 end), 0)`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.date, from),
        sql`${transactions.date} <= ${monthEnd(from)}`,
      ),
    );

  // Sums over a bigint column arrive as numeric strings despite the `number`
  // type annotation above; see lib/queries/accounts.ts.
  return { incomeMinor: Number(row.income), expenseMinor: Number(row.expense) };
}

export async function spendByCategory(
  userId: string,
  month: string,
): Promise<
  { categoryId: string | null; name: string; icon: string; spentMinor: number }[]
> {
  const from = `${month}-01`;

  const rows = await db
    .select({
      categoryId: transactions.categoryId,
      // Uncategorised spend is still spend: it groups under a null id rather
      // than dropping out of the breakdown, so the parts add up to the total.
      name: sql<string>`coalesce(${categories.name}, 'Uncategorised')`,
      icon: sql<string>`coalesce(${categories.icon}, 'Circle')`,
      // Expense rows are all direction -1, so a plain sum is already the
      // positive amount spent.
      spent: sql<number>`sum(${transactions.amountMinor})`,
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, "expense"),
        gte(transactions.date, from),
        sql`${transactions.date} <= ${monthEnd(from)}`,
      ),
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon)
    .orderBy(desc(sql`sum(${transactions.amountMinor})`));

  return rows.map(({ spent, ...r }) => ({ ...r, spentMinor: Number(spent) }));
}
