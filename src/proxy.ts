import NextAuth from "next-auth";
import { NextResponse } from "next/server";
import { authConfig } from "@/lib/auth.config";
import { STAFF_SESSION_ROLES } from "@/lib/authz/permissions";

// Edge-safe auth instance. Do NOT import "@/lib/auth" here — it carries the
// MongoDB adapter, which cannot run on the edge runtime. See auth.config.ts.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/", "/auth/login", "/auth/register", "/auth/error", "/auth/verify", "/auth/request-access"];
const ADMIN_PATHS = ["/admin"];

export default auth((req) => {
  const { pathname } = req.nextUrl;
  const session = req.auth;

  // Allow API auth routes
  if (pathname.startsWith("/api/auth")) {
    return NextResponse.next();
  }

  // Allow public paths
  if (PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
    // If logged in and visiting auth pages, redirect to dashboard
    if (session && (pathname.startsWith("/auth/login") || pathname.startsWith("/auth/register"))) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
    return NextResponse.next();
  }

  // Allow public API routes
  if (pathname.startsWith("/api")) {
    return NextResponse.next();
  }

  // Not authenticated — redirect to login
  if (!session) {
    return NextResponse.redirect(new URL("/auth/login", req.url));
  }

  // Not onboarded — redirect to onboarding
  const user = session.user;
  if (!user.isOnboarded && pathname !== "/auth/onboarding") {
    return NextResponse.redirect(new URL("/auth/onboarding", req.url));
  }

  // The staff area. This is a coarse gate on the shell only — every handler
  // behind it re-checks the specific capability it needs, because "can open
  // /admin" and "may verify evidence" are not the same question.
  if (ADMIN_PATHS.some((p) => pathname.startsWith(p))) {
    if (!STAFF_SESSION_ROLES.includes(user.role as string)) {
      return NextResponse.redirect(new URL("/dashboard", req.url));
    }
  }

  return NextResponse.next();
});

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|public).*)"],
};
