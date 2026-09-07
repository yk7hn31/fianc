"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { accounts } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { parseAmount } from "@/lib/money";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const accountInput = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  type: z.enum(["checking", "savings", "cash", "credit_card", "investment"]),
  openingBalance: z.string().default("0"),
});

export async function createAccount(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = accountInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }

  const raw = parsed.data.openingBalance.trim();
  let openingBalance = 0;
  if (raw !== "") {
    const negative = raw.startsWith("-");
    const amount = parseAmount(negative ? raw.slice(1) : raw, user.baseCurrency);
    if (!amount.ok) {
      return fail("Check the form", { openingBalance: [amount.error] });
    }
    openingBalance = negative ? -amount.value : amount.value;
  }

  try {
    await db.insert(accounts).values({
      userId: user.id,
      name: parsed.data.name,
      type: parsed.data.type,
      openingBalance,
    });
  } catch {
    return fail("Could not create the account. Try again.");
  }

  revalidatePath("/accounts");
  revalidatePath("/dashboard");
  return ok();
}

export async function archiveAccount(id: string): Promise<ActionResult> {
  const user = await requireUser();

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .update(accounts)
      .set({ archivedAt: new Date() })
      .where(and(eq(accounts.id, id), eq(accounts.userId, user.id)))
      .returning({ id: accounts.id });
  } catch {
    return fail("Could not archive the account. Try again.");
  }

  // Another user's row must read as missing, not as forbidden.
  if (!row) return fail("Account not found");

  revalidatePath("/accounts");
  return ok();
}
