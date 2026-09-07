"use server";

import { z } from "zod";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { categories } from "@/lib/db/schema";
import { requireUser } from "@/lib/auth/guard";
import { ok, fail, type ActionResult } from "@/lib/action-result";

const categoryInput = z.object({
  name: z.string().trim().min(1, "Enter a name"),
  kind: z.enum(["income", "expense"]),
  icon: z.string().trim().min(1).default("Circle"),
});

export async function createCategory(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const user = await requireUser();
  const parsed = categoryInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }

  try {
    await db.insert(categories).values({ ...parsed.data, userId: user.id });
  } catch {
    return fail("Could not create the category. Try again.");
  }

  revalidatePath("/categories");
  revalidatePath("/budgets");
  return ok();
}

export async function archiveCategory(id: string): Promise<ActionResult> {
  const user = await requireUser();

  let row: { id: string } | undefined;
  try {
    [row] = await db
      .update(categories)
      .set({ archivedAt: new Date() })
      .where(and(eq(categories.id, id), eq(categories.userId, user.id)))
      .returning({ id: categories.id });
  } catch {
    return fail("Could not archive the category. Try again.");
  }

  // Another user's row must read as missing, not as forbidden.
  if (!row) return fail("Category not found");

  revalidatePath("/categories");
  return ok();
}
