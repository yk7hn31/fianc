import "server-only";
import { and, eq, isNull, sql, asc } from "drizzle-orm";
import { db } from "@/lib/db";
import { accounts, transactions, type Account } from "@/lib/db/schema";

export type AccountWithBalance = Account & { balanceMinor: number };

/**
 * Balance is never stored: it is the opening balance plus the signed sum of
 * the account's transactions. Transfers are ordinary rows here — each half
 * carries its own `direction` — which is the whole point of the two-row model.
 *
 * `sum(direction * amount_minor)` is a sum over a Postgres `bigint` column,
 * which Postgres types as `numeric`. postgres.js (and the pg wire protocol in
 * general) always hands numeric/bigint values back as *strings* to avoid
 * silently losing precision above 2^53 — even wrapped in `coalesce(..., 0)`,
 * whose fallback is a literal `0` but whose result type still follows the
 * column. So both `delta.sum` and the outer `coalesce` are numeric strings
 * (or `"0"` in the no-rows branch, since coalesce forces the fallback through
 * the same numeric typing), and the final `Number(...)` conversions below are
 * required, not decorative.
 */
export async function listAccountsWithBalance(
  userId: string,
): Promise<AccountWithBalance[]> {
  const delta = db
    .select({
      accountId: transactions.accountId,
      sum: sql<number>`sum(${transactions.direction} * ${transactions.amountMinor})`.as("sum"),
    })
    .from(transactions)
    .where(eq(transactions.userId, userId))
    .groupBy(transactions.accountId)
    .as("delta");

  const rows = await db
    .select({
      account: accounts,
      delta: sql<number>`coalesce(${delta.sum}, 0)`,
    })
    .from(accounts)
    .leftJoin(delta, eq(delta.accountId, accounts.id))
    // Matches listCategories/listActiveAccounts: an archived account must
    // disappear from its own list page the same way an archived category
    // disappears from categories/page.tsx. Left unfiltered, an archived
    // account stayed on /accounts, unlabelled, still showing a live Archive
    // button that silently re-stamped archivedAt on every click.
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));

  return rows.map(({ account, delta }) => ({
    ...account,
    balanceMinor: Number(account.openingBalance) + Number(delta),
  }));
}

export async function listActiveAccounts(userId: string): Promise<Account[]> {
  return db
    .select()
    .from(accounts)
    .where(and(eq(accounts.userId, userId), isNull(accounts.archivedAt)))
    .orderBy(asc(accounts.sortOrder), asc(accounts.createdAt));
}
