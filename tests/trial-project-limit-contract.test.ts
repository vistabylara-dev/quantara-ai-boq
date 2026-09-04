import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { TRIAL_LIMITS } from "../src/lib/entitlements/entitlement-service";

describe("trial project allowance", () => {
  it("allows the three representative industry acceptance projects", () => {
    expect(TRIAL_LIMITS.maxProjects).toBe(3);
  });

  it("keeps platform trial simulation aligned with the canonical limit", () => {
    const source = fs.readFileSync(
      path.join(process.cwd(), "src/lib/entitlements/effective-entitlement-service.ts"),
      "utf8",
    );

    expect(source).toContain("maxProjects: TRIAL_LIMITS.maxProjects");
  });
});
