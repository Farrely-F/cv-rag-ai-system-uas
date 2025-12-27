/**
 * Next.js Middleware for Route Protection
 * Uses NextAuth to protect admin routes
 */

import { auth } from "@/auth";
import { NextResponse } from "next/server";

export default auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnAdmin = req.nextUrl.pathname.startsWith("/admin");
  const isOnLogin = req.nextUrl.pathname === "/login";

  // Redirect to login if accessing admin while unauthenticated
  if (isOnAdmin && !isLoggedIn) {
    return NextResponse.redirect(new URL("/login", req.nextUrl));
  }

  // Redirect to admin if already logged in and trying to access login
  if (isOnLogin && isLoggedIn) {
    return NextResponse.redirect(new URL("/admin", req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  // Match admin and login routes, exclude API and static files
  matcher: ["/admin/:path*", "/login"],
};
