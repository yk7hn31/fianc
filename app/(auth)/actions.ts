"use server";

import { z } from "zod";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import {
  createSession,
  destroySession,
  purgeExpiredSessions,
} from "@/lib/auth/session";
import { fail, type ActionResult } from "@/lib/action-result";
import { seedDefaultCategories } from "@/lib/queries/categories";

// zod v4: `z.string().email()` is deprecated in favour of the top-level
// `z.email()`, and `ZodError#flatten()` in favour of `z.flattenError()`.
// Trim/lowercase must run *before* the email check via `.pipe()` — chaining
// `.trim().toLowerCase()` after `z.email()` validates the raw, untrimmed
// input first, so " foo@bar.com " with padding would fail format checks.
const credentials = z.object({
  email: z.string().trim().toLowerCase().pipe(z.email("Enter a valid email")),
  password: z.string().min(10, "Use at least 10 characters"),
});

const signupInput = credentials.extend({
  name: z.string().trim().min(1, "Enter a name"),
  code: z.string().min(1, "Enter the signup code"),
});

/** Postgres unique_violation. postgres.js surfaces the SQLSTATE as `code`. */
function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "23505"
  );
}

export async function signup(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = signupInput.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }
  const { email, password, name, code } = parsed.data;

  if (!process.env.SIGNUP_CODE || code !== process.env.SIGNUP_CODE) {
    return fail("That signup code is not valid");
  }

  // Everything that touches the database is wrapped: an action must resolve to
  // an ActionResult, never throw across the client boundary. The pre-check and
  // the unique constraint both exist on purpose — the check gives the good
  // message on the common path, the constraint catches two signups racing
  // through the check at once.
  try {
    const [existing] = await db
      .select({ id: users.id })
      .from(users)
      .where(eq(users.email, email))
      .limit(1);
    if (existing) return fail("That email is already registered");

    const [user] = await db
      .insert(users)
      .values({ email, name, passwordHash: await hashPassword(password) })
      .returning();

    await seedDefaultCategories(user.id);
    await createSession(user.id);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return fail("That email is already registered");
    }
    return fail("Could not create your account. Try again.");
  }

  redirect("/dashboard");
}

export async function login(
  _prev: ActionResult | null,
  formData: FormData,
): Promise<ActionResult> {
  const parsed = credentials.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return fail("Check the form", z.flattenError(parsed.error).fieldErrors);
  }
  const { email, password } = parsed.data;

  try {
    const [user] = await db
      .select()
      .from(users)
      .where(eq(users.email, email))
      .limit(1);

    // One message for both branches: do not reveal which emails exist.
    const invalid = fail("Email or password is incorrect");
    if (!user) return invalid;
    if (!(await verifyPassword(user.passwordHash, password))) return invalid;

    await purgeExpiredSessions();
    await createSession(user.id);
  } catch {
    return fail("Could not sign you in. Try again.");
  }

  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  await destroySession();
  redirect("/login");
}
