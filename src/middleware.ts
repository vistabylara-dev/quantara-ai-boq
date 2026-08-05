import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";

const ADMIN_LOGIN_PAGE = "/admin/login";

const PUBLIC_ROUTES = new Set([
  "/",
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/privacy",
  "/terms",
  "/data-processing",
  "/cookie-policy",
  "/acceptable-use",
  "/subprocessors",
  "/security",
  "/contact-sales",
  "/features",
  "/about",
  ADMIN_LOGIN_PAGE,
  "/ai-boq-software",
  "/boq-software",
  "/construction-estimating-software",
  "/boq-management",
  "/pdf-boq-extraction",
  "/scanned-pdf-boq",
  "/quantity-surveying-software",
  "/boq-document-generation",
  "/resources",
  "/what-is-a-boq",
  "/boq-vs-construction-estimate",
  "/boq-vs-bill-of-materials",
  "/how-to-prepare-a-boq",
  "/boq-review-checklist",
  "/common-boq-errors",
  "/boq-revision-control",
  "/how-to-convert-pdf-boq-to-excel",
  "/text-pdf-vs-scanned-pdf",
  "/ocr-for-boq-documents",
  "/how-to-review-ai-extracted-boq",
  "/quantity-takeoff-vs-boq-management",
  "/industries",
  "/boq-software-for-contractors",
  "/boq-software-for-quantity-surveyors",
  "/boq-software-for-mep-contractors",
  "/boq-software-for-hvac-contractors",
  "/boq-software-for-fit-out-companies",
  "/boq-software-for-fire-fighting-contractors",
  "/boq-software-for-facilities-management",
  "/boq-software-for-engineering-consultants",
  "/gcc-boq-software",
  "/boq-software-uae",
  "/boq-software-dubai",
  "/boq-software-abu-dhabi",
  "/construction-estimating-software-uae",
  "/mep-estimating-software-uae",
  "/boq-software-saudi-arabia",
  "/boq-software-qatar",
  "/boq-software-oman",
]);

const PUBLIC_PREFIXES = [
  "/proposal/",
  "/technical-report/",
];

const AUTH_ENTRY_PAGES = ["/login", "/register"];

function isPublicPage(pathname: string): boolean {
  if (PUBLIC_ROUTES.has(pathname)) return true;
  return PUBLIC_PREFIXES.some((prefix) => pathname.startsWith(prefix));
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
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|manifest.webmanifest|.*\\\\.png|.*\\\\.jpg).*)"],
};
