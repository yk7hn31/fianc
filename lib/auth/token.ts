import { randomBytes, createHash } from "node:crypto";

export const SESSION_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const SESSION_COOKIE = "fianc_session";

/** The value that goes in the cookie. Never stored. */
export function generateToken(): string {
  return randomBytes(32).toString("base64url");
}

/** What gets stored in `sessions.token_hash`. */
export function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function sessionExpiry(now: Date = new Date()): Date {
  return new Date(now.getTime() + SESSION_TTL_MS);
}

export function isExpired(expiresAt: Date, now: Date = new Date()): boolean {
  return expiresAt.getTime() <= now.getTime();
}

export function shouldRefresh(expiresAt: Date, now: Date = new Date()): boolean {
  const remaining = expiresAt.getTime() - now.getTime();
  return remaining > 0 && remaining < SESSION_TTL_MS / 2;
}
