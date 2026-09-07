import "server-only";
import { and, asc, eq, isNull } from "drizzle-orm";
import { db } from "@/lib/db";
import { categories, type Category } from "@/lib/db/schema";
import { DEFAULT_CATEGORIES } from "./categories.data";

export { DEFAULT_CATEGORIES };

/** Called once, from signup. An empty ledger with no categories is unusable. */
export async function seedDefaultCategories(userId: string): Promise<void> {
  await db
    .insert(categories)
    .values(DEFAULT_CATEGORIES.map((c) => ({ ...c, userId })));
}

export async function listCategories(
  userId: string,
  kind?: "income" | "expense",
): Promise<Category[]> {
  return db
    .select()
    .from(categories)
    .where(
      and(
        eq(categories.userId, userId),
        isNull(categories.archivedAt),
        kind ? eq(categories.kind, kind) : undefined,
      ),
    )
    .orderBy(asc(categories.kind), asc(categories.name));
}
