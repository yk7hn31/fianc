"use server";

import { z } from "zod";
import { and, count, eq, inArray } from "drizzle-orm";
import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { transactions, accounts, categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { parseAmount, directionFor } from "@/lib/money";
import { isCalendarDate } from "@/lib/queries/transactions.filters";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const base = z.object({
  accountId: z.uuid("Choose an account"),
  amount: z.string(),
  // Not a shape check: /^\d{4}-\d{2}-\d{2}$/ happily passes "2026-13-45"
  // through to Postgres, which then fails the insert with a driver error
  // instead of a message on the date field.
  date: z.string().refine(isCalendarDate, "Choose a date"),
  payee: z.string().trim().default(""),
  note: z.string().trim().default(""),
});

const txInput = base.extend({
  type: z.enum(["income", "expense"]),
  categoryId: z.uuid().optional().or(z.literal("")),
});

const transferInput = base.extend({
  toAccountId: z.uuid("Choose a destination account"),
});

/**
 * One round trip for however many accounts need checking, so the transfer
 * form does not pay for two. Callers must pass distinct ids: the count
 * comparison assumes it.
 */
async function ownsAccounts(userId: string, ids: string[]): Promise<boolean> {
  // No caller passes an empty list today, but without this the count query
  // becomes `user_id = $1 and false`, counts 0, and `0 === ids.length` answers
  // "yes, all owned" for nothing at all. An ownership check fails closed.
  if (ids.length === 0) return false;

  const [row] = await db
    .select({ value: count() })
    .from(accounts)
    .where(and(eq(accounts.userId, userId), inArray(accounts.id, ids)));
  return Number(row.value) === ids.length;
}

/**
 * The category FK is global rather than per-user, so nothing in the database
 * stops a crafted post from filing this user's transaction under someone
 * else's category and leaking its name into their own list and reports.
 * Scope it by user like every other write here.
 */
async function ownsCategory(userId: string, id: string): Promise<boolean> {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, id), eq(categories.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function createTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = txInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }
  const { accountId, amount, date, payee, note, type, categoryId } = parsed.data;

  const money = parseAmount(amount, user.baseCurrency);
  if (!money.ok) return fail("Check the form", { amount: [money.error] });

  try {
    // Another user's row must read as missing, not as forbidden.
    if (!(await ownsAccounts(user.id, [accountId]))) {
      return fail("Account not found");
    }
    // An unowned category is an error, never a quiet fallback to null: saving
    // it uncategorised would look like the form worked.
    if (categoryId && !(await ownsCategory(user.id, categoryId))) {
      return fail("Category not found");
    }

    await db.insert(transactions).values({
      userId: user.id,
      accountId,
      categoryId: categoryId ? categoryId : null,
      type,
      direction: directionFor(type),
      amountMinor: money.value,
      date,
      payee,
      note,
    });
  } catch {
    return fail("Could not save the transaction. Try again.");
  }

  revalidatePath("/transactions");
  // Account balances are a sum over transactions, not a stored column, so the
  // accounts list is stale the moment a row lands.
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}

/**
 * A transfer is two rows sharing a group id, written atomically: an outflow on
 * the source account and an inflow on the destination. Balances stay a plain
 * SUM; only the UI has to re-pair them.
 */
export async function createTransfer(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = transferInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }
  const { accountId, toAccountId, amount, date, payee, note } = parsed.data;

  // Ahead of the ownership check, which counts distinct ids.
  if (accountId === toAccountId) {
    return fail("Check the form", {
      toAccountId: ["Pick a different destination account"],
    });
  }
  const money = parseAmount(amount, user.baseCurrency);
  if (!money.ok) return fail("Check the form", { amount: [money.error] });

  const transferGroupId = randomUUID();
  const shared = {
    userId: user.id,
    type: "transfer" as const,
    amountMinor: money.value,
    date,
    payee,
    note,
    transferGroupId,
    categoryId: null,
  };

  try {
    if (!(await ownsAccounts(user.id, [accountId, toAccountId]))) {
      return fail("Account not found");
    }

    await db.transaction(async (tx) => {
      await tx.insert(transactions).values([
        { ...shared, accountId, direction: -1 },
        { ...shared, accountId: toAccountId, direction: 1 },
      ]);
    });
  } catch {
    return fail("Could not save the transfer. Try again.");
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return ok();
}

const updateInput = txInput.extend({ id: z.uuid() });

/**
 * Editing either half of a transfer edits both, so the pair can never drift
 * apart in amount or date.
 */
export async function updateTransaction(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = updateInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }
  const { id, accountId, amount, date, payee, note, type, categoryId } =
    parsed.data;

  const money = parseAmount(amount, user.baseCurrency);
  if (!money.ok) return fail("Check the form", { amount: [money.error] });

  try {
    const [existing] = await db
      .select({
        id: transactions.id,
        transferGroupId: transactions.transferGroupId,
      })
      .from(transactions)
      .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)))
      .limit(1);
    if (!existing) return fail("Transaction not found");

    if (existing.transferGroupId) {
      // Only the shared fields are editable on a transfer; the accounts and
      // directions belong to the pair, not to one row.
      await db
        .update(transactions)
        .set({ amountMinor: money.value, date, payee, note, updatedAt: new Date() })
        .where(
          and(
            eq(transactions.userId, user.id),
            eq(transactions.transferGroupId, existing.transferGroupId),
          ),
        );
    } else {
      if (!(await ownsAccounts(user.id, [accountId]))) {
        return fail("Account not found");
      }
      if (categoryId && !(await ownsCategory(user.id, categoryId))) {
        return fail("Category not found");
      }
      await db
        .update(transactions)
        .set({
          accountId,
          categoryId: categoryId ? categoryId : null,
          type,
          direction: directionFor(type),
          amountMinor: money.value,
          date,
          payee,
          note,
          updatedAt: new Date(),
        })
        .where(and(eq(transactions.id, id), eq(transactions.userId, user.id)));
    }
  } catch {
    return fail("Could not save the transaction. Try again.");
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}

/** Deletes the given rows, pulling in the other half of any transfer. */
export async function deleteTransactions(ids: string[]): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = z.array(z.uuid()).min(1).max(500).safeParse(ids);
  if (!parsed.success) return fail("Nothing selected");

  try {
    const rows = await db
      .select({
        id: transactions.id,
        transferGroupId: transactions.transferGroupId,
      })
      .from(transactions)
      .where(
        and(
          eq(transactions.userId, user.id),
          inArray(transactions.id, parsed.data),
        ),
      );
    // Another user's rows must read as missing, not as forbidden.
    if (rows.length === 0) return fail("Transaction not found");

    const groups = rows
      .map((r) => r.transferGroupId)
      .filter((g): g is string => g !== null);

    await db.transaction(async (tx) => {
      await tx
        .delete(transactions)
        .where(
          and(
            eq(transactions.userId, user.id),
            inArray(
              transactions.id,
              rows.map((r) => r.id),
            ),
          ),
        );
      if (groups.length > 0) {
        await tx
          .delete(transactions)
          .where(
            and(
              eq(transactions.userId, user.id),
              inArray(transactions.transferGroupId, groups),
            ),
          );
      }
    });
  } catch {
    return fail("Could not delete the transaction. Try again.");
  }

  revalidatePath("/transactions");
  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  revalidatePath("/budgets");
  return ok();
}
