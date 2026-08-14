import { NextResponse, type NextRequest } from "next/server";
import { SESSION_COOKIE_NAME } from "@/lib/auth/session-cookie-name";
import { PUBLIC_WEBSITE_PATHS } from "@/lib/public-site/public-route-paths";

const ADMIN_LOGIN_PAGE = "/admin/login";

const PUBLIC_ROUTES = new Set<string>([
  ...PUBLIC_WEBSITE_PATHS,
  "/login",
  "/register",
  "/verify-email",
  "/forgot-password",
  "/reset-password",
  "/llms.txt",
  ADMIN_LOGIN_PAGE,
]);

const PUBLIC_PREFIXES = [
  "/proposal/",
  "/technical-report/",
];


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


  if (!isPublicPage(pathname) && !hasSessionCookie) {
    const isAdminPage = pathname === "/admin" || pathname.startsWith("/admin/");
    const loginUrl = new URL(isAdminPage ? ADMIN_LOGIN_PAGE : "/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  // \\.png / \\.jpg here is one escaped literal dot each (JS string ->
  // regex source `\.png` / `\.jpg`). The previous `\\\\.png`/`\\\\.jpg`
  // produced the regex source `\\.png`/`\\.jpg` — "a literal backslash
  // followed by any character, then png/jpg" — which no real image URL
  // ever matches, so this exclusion never actually excluded anything.
  // Every unauthenticated request for a .png/.jpg (the logo, on every
  // public page including /login itself) fell through to the auth check
  // and got redirected to /login instead of serving the image.
  //
  // .glb is the same class of bug: public/models/tayqan/tayqan-web.glb is a
  // static asset (no auth check makes sense for it — it's not user data),
  // but without this exclusion every request for it — including from a
  // signed-out visitor on a public marketing page — got redirected to
  // /login?next=%2Fmodels%2Ftayqan%2Ftayqan-web.glb instead of the model
  // bytes, so the robot fell back to its no-WebGL placeholder everywhere.
  matcher: ["/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml|llms.txt|opengraph-image|twitter-image|manifest.webmanifest|.*\\.png|.*\\.jpg|.*\\.glb).*)"],
};
