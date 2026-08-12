import { NextRequest } from "next/server";
import { describe, expect, it } from "vitest";
import { middleware } from "../src/middleware";

function requestFor(path: string): NextRequest {
  return new NextRequest(new URL(path, "https://quantara.example.com"));
}

describe("Public routes", () => {
  const publicRoutes = [
    "/privacy",
    "/terms",
    "/data-processing",
    "/subprocessors",
    "/cookie-policy",
    "/acceptable-use",
    "/contact-sales",
  ];

  publicRoutes.forEach((route) => {
    it(`lets an unauthenticated request reach ${route} directly (no redirect)`, () => {
      const response = middleware(requestFor(route));
      expect(response.status).toBe(200);
      expect(response.headers.get("location")).toBeNull();
    });
  });
});
