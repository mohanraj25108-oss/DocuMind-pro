import { NextResponse, type NextRequest } from "next/server";

const PROTECTED_PREFIXES = [
  "/dashboard",
  "/documents",
  "/assistant",
  "/calendar",
  "/reminders",
  "/categories",
  "/activity",
  "/settings",
  "/profile",
];

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isProtected = PROTECTED_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`)
  );

  if (isProtected) {
    const sessionCookie = request.cookies.get("documind_session")?.value;
    if (!sessionCookie) {
      const loginUrl = new URL("/login", request.url);
      loginUrl.searchParams.set("next", pathname);
      return NextResponse.redirect(loginUrl);
    }
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/dashboard/:path*",
    "/documents/:path*",
    "/assistant/:path*",
    "/calendar/:path*",
    "/reminders/:path*",
    "/categories/:path*",
    "/activity/:path*",
    "/settings/:path*",
    "/profile/:path*",
  ],
};
