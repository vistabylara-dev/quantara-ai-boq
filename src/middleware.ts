import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

const ADMIN_LOGIN_PAGE = "/admin/login";

const PUBLIC_PAGE_PREFIXES = [
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/proposal",
  "/technical-report",
  "/privacy",
  "/terms",
  "/security",
  "/features",
  "/methodology",
  "/limitations",
  "/about",
  "/data-processing",
  "/subprocessors",
  "/cookie-policy",
  "/acceptable-use",
  "/contact-sales",
  ADMIN_LOGIN_PAGE,
];

const AUTH_ENTRY_PAGES = ["/login", "/register"];

function isPublicPage(pathname: string): boolean {
  if (pathname === "/") {
    return true;
  }
  return PUBLIC_PAGE_PREFIXES.some(
    (prefix) => prefix !== "/" && (pathname === prefix || pathname.startsWith(`${prefix}/`)),
  );
}

/**
 * This is a cheap, edge-safe presence check only — it cannot validate the
 * session against the database (Prisma needs the Node.js runtime). The real
 * authorization boundary is `getCurrentActor()`, called by every API route
 * handler, which does the authoritative DB-backed check. This middleware
 * only exists to avoid flashing protected page shells at signed-out users
 * and to bounce already-signed-in-looking users away from /login.
 */
export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  if (pathname.startsWith("/api/") || pathname.startsWith("/_next/")) {
    return NextResponse.next();
  }

  const hasSessionCookie = Boolean(request.cookies.get(SESSION_COOKIE_NAME)?.value);

  if (AUTH_ENTRY_PAGES.includes(pathname) && hasSessionCookie) {
    return NextResponse.redirect(new URL("/dashboard", request.url));
  }

  if (!isPublicPage(pathname) && !hasSessionCookie) {
    const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
    const loginUrl = new URL(isAdminPage ? ADMIN_LOGIN_PAGE : "/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|manifest.webmanifest|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
