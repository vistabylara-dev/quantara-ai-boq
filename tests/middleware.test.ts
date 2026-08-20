import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { config as middlewareConfig, middleware } from "../src/middleware";
import { SESSION_COOKIE_NAME } from "../src/lib/auth/session-cookie-name";

function requestFor(path: string, cookie?: string): NextRequest {
  const request = new NextRequest(new URL(path, "https://quantara.example.com"));
  if (cookie) {
    request.cookies.set(SESSION_COOKIE_NAME, cookie);
  }
  return request;
}

describe("edge middleware routing", () => {
  it("lets an unauthenticated request reach /admin/login directly (no redirect)", () => {
    const response = middleware(requestFor("/admin/login"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });

  it("redirects an unauthenticated /admin request to /admin/login, not the plain /login page", () => {
    const response = middleware(requestFor("/admin"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/admin/login");
    expect(location.searchParams.get("next")).toBe("/admin");
  });

  it("still redirects an unauthenticated ordinary protected page to /login", () => {
    const response = middleware(requestFor("/dashboard"));
    expect(response.status).toBe(307);
    const location = new URL(response.headers.get("location")!);
    expect(location.pathname).toBe("/login");
    expect(location.searchParams.get("next")).toBe("/dashboard");
  });

  it("bounces an already-signed-in-looking session away from /login to /dashboard", () => {
    const response = middleware(requestFor("/login", "some-token"));
    expect(response.status).toBe(307);
    expect(new URL(response.headers.get("location")!).pathname).toBe("/dashboard");
  });

  it("does not redirect /admin/login even for an already-signed-in-looking session (page decides)", () => {
    const response = middleware(requestFor("/admin/login", "some-token"));
    expect(response.status).toBe(200);
    expect(response.headers.get("location")).toBeNull();
  });
});

describe("edge middleware matcher (Next.js routing config — the middleware() function above is never invoked for an excluded path)", () => {
  const matcherPattern = new RegExp(middlewareConfig.matcher[0]);

  it("excludes public static media assets from authentication redirects", () => {
    expect(matcherPattern.test("/models/tayqan/tayqan-web.glb")).toBe(false);
    expect(matcherPattern.test("/videos/quantara-third-pilot-promo.mp4")).toBe(false);
    expect(matcherPattern.test("/logo.png")).toBe(false);
    expect(matcherPattern.test("/logo.jpg")).toBe(false);
  });

  it("still matches (does not exclude) an ordinary protected page", () => {
    expect(matcherPattern.test("/dashboard")).toBe(true);
    expect(matcherPattern.test("/projects/some-project/tayqan")).toBe(true);
  });
});
