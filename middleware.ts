import { NextResponse, type NextRequest } from "next/server";

// Duplicated from lib/auth/token.ts rather than imported: middleware runs on
// the edge runtime, and that module (transitively) pulls in node:crypto via
// lib/auth/session.ts's other imports, which does not work on the edge.
const SESSION_COOKIE = "fianc_session";

export function middleware(request: NextRequest) {
  const hasCookie = request.cookies.has(SESSION_COOKIE);
  const { pathname } = request.nextUrl;
  const isAuthPage = pathname === "/login" || pathname === "/signup";

  if (!hasCookie && !isAuthPage) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (hasCookie && isAuthPage) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/).*)"],
};
