import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

describe("free company project entitlement contract", () => {
  it("keeps one active company project and enforces it before project creation", () => {
    const entitlementSource = readFileSync(
      resolve(process.cwd(), "src/lib/entitlements/entitlement-service.ts"),
      "utf8",
    );
    const projectServiceSource = readFileSync(
      resolve(process.cwd(), "src/lib/services/project-service.ts"),
      "utf8",
    );

    expect(entitlementSource).toMatch(/const FREE_LIMITS = \{\s*maxProjects: 1,/);
    expect(entitlementSource).toContain("companyId, status: { not: ProjectStatus.ARCHIVED }");
    expect(projectServiceSource).toContain("await canCreateProjectEffective(actor)");
    expect(projectServiceSource.indexOf("await canCreateProjectEffective(actor)"))
      .toBeLessThan(projectServiceSource.indexOf("prisma.$transaction"));
  });
});
