"use server";

import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { budgets, categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { parseAmount } from "@/lib/money";
import { addMonths } from "@/lib/budgets";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const setBudgetInput = z.object({
  categoryId: z.string().uuid(),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  amount: z.string(),
  rollover: z.enum(["on", "off"]).default("off"),
});

async function ownsCategory(userId: string, categoryId: string) {
  const [row] = await db
    .select({ id: categories.id })
    .from(categories)
    .where(and(eq(categories.id, categoryId), eq(categories.userId, userId)))
    .limit(1);
  return Boolean(row);
}

export async function setBudget(formData: FormData): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = setBudgetInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return fail("Check the amount");

  const { categoryId, month, amount, rollover } = parsed.data;
  if (!(await ownsCategory(user.id, categoryId))) return fail("Category not found");

  // `user.baseCurrency`, like every other parseAmount call site: without it
  // this defaulted to USD's two decimals while the spend it is compared
  // against was parsed with the user's real currency, so under a
  // zero-decimal currency a budget came out 100x too large.
  const money = parseAmount(amount === "" ? "0" : amount, user.baseCurrency);
  if (!money.ok) return fail(money.error);

  try {
    await db
      .insert(budgets)
      .values({
        userId: user.id,
        categoryId,
        month: `${month}-01`,
        amountMinor: money.value,
        rollover: rollover === "on",
      })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.categoryId, budgets.month],
        set: { amountMinor: money.value, rollover: rollover === "on" },
      });
  } catch {
    return fail("Could not save the budget. Try again.");
  }

  revalidatePath("/budgets");
  revalidatePath("/dashboard");
  return ok();
}

/** Seeds this month from the previous month's caps, leaving existing rows alone. */
export async function copyLastMonth(month: string): Promise<ActionResult> {
  const user = await requireUser();
  if (!/^\d{4}-\d{2}$/.test(month)) return fail("Bad month");
  const previous = addMonths(month, -1);

  try {
    await db.execute(sql`
      insert into budgets (user_id, category_id, month, amount_minor, rollover)
      select user_id, category_id, ${`${month}-01`}::date, amount_minor, rollover
      from budgets
      where user_id = ${user.id} and month = ${`${previous}-01`}::date
      on conflict (user_id, category_id, month) do nothing
    `);
  } catch {
    return fail("Could not copy last month. Try again.");
  }

  revalidatePath("/budgets");
  return ok();
}
