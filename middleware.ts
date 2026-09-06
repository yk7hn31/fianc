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
  // Exempts /_next and anything that looks like a file (a dot in the last
  // segment). The original spelled out favicon.ico, manifest.webmanifest and
  // icons/ one by one, which would have started 302-ing the service worker and
  // every other public/ asset to /login the moment the PWA work landed.
  matcher: ["/((?!_next/|.*\\.[^/]+$).*)"],
};
