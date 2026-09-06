import "server-only";
import { redirect } from "next/navigation";
import { getSession } from "./session";
import type { User } from "@/lib/db/schema";

export async function requireUser(): Promise<User> {
  const session = await getSession();
  if (!session) redirect("/login");
  return session.user;
}
