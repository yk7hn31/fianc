import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { eq, lt } from "drizzle-orm";
import { db } from "@/lib/db";
import { sessions, users, type User } from "@/lib/db/schema";
import {
  SESSION_COOKIE,
  generateToken,
  hashToken,
  isExpired,
  sessionExpiry,
  shouldRefresh,
} from "./token";

export async function createSession(userId: string): Promise<void> {
  const token = generateToken();
  const expiresAt = sessionExpiry();

  await db.insert(sessions).values({
    userId,
    tokenHash: hashToken(token),
    expiresAt,
  });

  const jar = await cookies();
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

/**
 * Validates the session cookie against the database.
 * Cached per request so a layout and three actions cost one query.
 */
export const getSession = cache(async (): Promise<{ user: User } | null> => {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const tokenHash = hashToken(token);
  const [row] = await db
    .select({ session: sessions, user: users })
    .from(sessions)
    .innerJoin(users, eq(users.id, sessions.userId))
    .where(eq(sessions.tokenHash, tokenHash))
    .limit(1);

  if (!row) return null;

  if (isExpired(row.session.expiresAt)) {
    await db.delete(sessions).where(eq(sessions.id, row.session.id));
    return null;
  }

  if (shouldRefresh(row.session.expiresAt)) {
    const expiresAt = sessionExpiry();
    await db
      .update(sessions)
      .set({ expiresAt })
      .where(eq(sessions.id, row.session.id));
    jar.set(SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      expires: expiresAt,
    });
  }

  return { user: row.user };
});

export async function destroySession(): Promise<void> {
  const jar = await cookies();
  const token = jar.get(SESSION_COOKIE)?.value;
  if (token) {
    await db.delete(sessions).where(eq(sessions.tokenHash, hashToken(token)));
  }
  jar.delete(SESSION_COOKIE);
}

export async function purgeExpiredSessions(): Promise<void> {
  await db.delete(sessions).where(lt(sessions.expiresAt, new Date()));
}
