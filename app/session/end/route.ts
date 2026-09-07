import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/token";

/**
 * Clears a session cookie that no longer has a live row behind it.
 *
 * `middleware.ts` runs on the edge and cannot reach the database, so it can
 * only test whether the cookie is *present*. That leaves a hole: a browser
 * holding an expired or deleted session would be bounced from /login to
 * /dashboard by the middleware, sent back to /login by `requireUser`, and
 * around forever. A Server Component cannot delete a cookie in Next 15 — only
 * a Route Handler or a Server Action can — so the guard redirects here, the
 * cookie is dropped, and the redirect to /login then passes the middleware
 * cleanly.
 */
export async function GET(request: NextRequest) {
  const response = NextResponse.redirect(new URL("/login", request.url));
  response.cookies.delete(SESSION_COOKIE);
  return response;
}
