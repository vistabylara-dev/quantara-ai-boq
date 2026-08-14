import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import type { CurrentActor } from "@/lib/auth/current-actor";
import {
  getActorFromContext,
  setActorContext,
  withActorRequestContext,
} from "@/lib/auth/request-context";

const projectRoot = path.resolve(import.meta.dirname, "..");

function actor(id: string): CurrentActor {
  return {
    userId: id,
    companyId: `company-${id}`,
    role: UserRole.COMPANY_OWNER,
    fullName: `Actor ${id}`,
    email: `${id}@example.test`,
  };
}

async function listRouteFiles(directory: string): Promise<string[]> {
  const entries = await readdir(directory, { withFileTypes: true });
  const nested = await Promise.all(entries.map(async (entry) => {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) return listRouteFiles(entryPath);
    return entry.name === "route.ts" ? [entryPath] : [];
  }));
  return nested.flat();
}

describe("Cloudflare-compatible actor request context", () => {
  it("keeps concurrent authenticated actors isolated across awaited work", async () => {
    const run = withActorRequestContext(async (currentActor: CurrentActor, delayMs: number) => {
      expect(getActorFromContext()).toBeUndefined();
      setActorContext(currentActor);
      await new Promise((resolve) => setTimeout(resolve, delayMs));
      return getActorFromContext();
    });

    const [slow, fast] = await Promise.all([
      run(actor("slow"), 15),
      run(actor("fast"), 0),
    ]);

    expect(slow).toEqual(actor("slow"));
    expect(fast).toEqual(actor("fast"));
    expect(getActorFromContext()).toBeUndefined();
  });

  it("wraps every API handler that assigns an audit actor", async () => {
    const routeFiles = await listRouteFiles(path.join(projectRoot, "src", "app", "api"));
    let affectedRouteCount = 0;
    let wrappedHandlerCount = 0;

    for (const routeFile of routeFiles) {
      const source = await readFile(routeFile, "utf8");
      if (!source.includes("setActorContext(")) continue;
      affectedRouteCount += 1;

      expect(source, routeFile).toContain("withActorRequestContext");
      expect(source, routeFile).not.toMatch(
        /^export async function (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)\(/m,
      );

      const handlers = source.match(
        /^async function (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD)Handler\(/gm,
      ) ?? [];
      const wrappers = source.match(
        /^export const (GET|POST|PUT|PATCH|DELETE|OPTIONS|HEAD) = withActorRequestContext\(/gm,
      ) ?? [];
      expect(wrappers.length, routeFile).toBe(handlers.length);
      wrappedHandlerCount += wrappers.length;
    }

    expect(affectedRouteCount).toBeGreaterThan(0);
    expect(wrappedHandlerCount).toBeGreaterThan(0);
  });
});
