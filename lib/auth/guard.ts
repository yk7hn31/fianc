import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { User } from "@/lib/db/schema";

export async function requireUser(): Promise<User> {
  const session = await getSession();
  // Not /login: the cookie may still be sitting there with a dead session
  // behind it, and the middleware would bounce it straight back. /session/end
  // deletes it first.
  if (!session) redirect("/session/end");
  return session.user;
}
