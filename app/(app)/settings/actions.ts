"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { ok, fail, type ActionResult } from "@/lib/action-result";
import { CURRENCY_CODES } from "@/lib/currencies";

const settingsInput = z.object({
  baseCurrency: z.enum(CURRENCY_CODES, {
    message: "Choose a currency",
  }),
});

export async function updateBaseCurrency(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();

  const parsed = settingsInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }

  try {
    await db
      .update(users)
      .set({ baseCurrency: parsed.data.baseCurrency })
      .where(eq(users.id, user.id));
  } catch {
    return fail("Could not save that. Try again.");
  }

  // Every page that renders money reads user.baseCurrency, so this is not a
  // one-page change: the symbol and the number of decimals shift everywhere
  // at once.
  revalidatePath("/", "layout");
  return ok();
}
