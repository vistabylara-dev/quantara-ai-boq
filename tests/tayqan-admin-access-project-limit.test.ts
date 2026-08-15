import fs from "node:fs";
import path from "node:path";
import { PlatformRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import {
  deriveTayqanProjectQuota,
  isTayqanInternalAdminRole,
  TAYQAN_INTERNAL_ADMIN_PRICE_CODE,
} from "../src/lib/services/tayqan-hire-service";
import {
  getTayqanMaxDistinctProjects,
  TAYQAN_HIRE_PLANS,
} from "../src/lib/tayqan/tayqan-commerce";

const REPO = process.cwd();

function read(...parts: string[]) {
  return fs.readFileSync(
    path.join(REPO, ...parts),
    "utf8",
  );
}

describe("TAYQAN admin/customer access separation", () => {
  it("grants free internal worker access only to operational platform roles", () => {
    expect(
      isTayqanInternalAdminRole(
        PlatformRole.PLATFORM_OWNER,
      ),
    ).toBe(true);

    expect(
      isTayqanInternalAdminRole(
        PlatformRole.PLATFORM_ADMIN,
      ),
    ).toBe(true);

    expect(
      isTayqanInternalAdminRole(
        PlatformRole.PLATFORM_SUPPORT,
      ),
    ).toBe(false);

    expect(
      isTayqanInternalAdminRole(null),
    ).toBe(false);
  });

  it("keeps internal admin access outside normal paid entitlement lookup and Stripe", () => {
    const hire = read(
      "src",
      "lib",
      "services",
      "tayqan-hire-service.ts",
    );

    const checkout = read(
      "src",
      "lib",
      "services",
      "tayqan-checkout-service.ts",
    );

    expect(hire).toContain(
      "TAYQAN_INTERNAL_ADMIN_PRICE_CODE",
    );

    expect(hire).toContain(
      "priceCode: {\n        not: TAYQAN_INTERNAL_ADMIN_PRICE_CODE",
    );

    expect(checkout).toContain(
      "getActiveTayqanEntitlement(actor.companyId)",
    );

    expect(checkout).not.toContain(
      TAYQAN_INTERNAL_ADMIN_PRICE_CODE,
    );
  });
});

describe("TAYQAN Day Hire project allowance", () => {
  it("pins Day Hire to exactly two distinct projects", () => {
    expect(
      TAYQAN_HIRE_PLANS.find(
        (plan) => plan.plan === "DAY",
      ),
    ).toMatchObject({
      priceCode: "tayqan_day_299",
      durationHours: 24,
      maxDistinctProjects: 2,
    });

    expect(
      getTayqanMaxDistinctProjects("DAY"),
    ).toBe(2);

    expect(
      getTayqanMaxDistinctProjects("WEEK"),
    ).toBeNull();

    expect(
      getTayqanMaxDistinctProjects("MONTHLY"),
    ).toBeNull();
  });

  it("deduplicates projects and allows continuing an already assigned project", () => {
    expect(
      deriveTayqanProjectQuota(
        2,
        ["project-a", "project-a"],
        "project-a",
      ),
    ).toEqual({
      maxProjects: 2,
      usedProjects: 1,
      remainingProjects: 1,
      currentProjectAssigned: true,
      canAssignCurrentProject: true,
    });

    expect(
      deriveTayqanProjectQuota(
        2,
        ["project-a", "project-b"],
        "project-a",
      ),
    ).toMatchObject({
      usedProjects: 2,
      remainingProjects: 0,
      currentProjectAssigned: true,
      canAssignCurrentProject: true,
    });
  });

  it("blocks a third distinct Day-Hire project", () => {
    expect(
      deriveTayqanProjectQuota(
        2,
        ["project-a", "project-b"],
        "project-c",
      ),
    ).toEqual({
      maxProjects: 2,
      usedProjects: 2,
      remainingProjects: 0,
      currentProjectAssigned: false,
      canAssignCurrentProject: false,
    });

    const hire = read(
      "src",
      "lib",
      "services",
      "tayqan-hire-service.ts",
    );

    expect(hire).toContain(
      "TAYQAN_PROJECT_LIMIT_REACHED",
    );

    expect(hire).toContain(
      "pg_advisory_xact_lock",
    );
  });

  it("does not impose the Day limit on internal admin access", () => {
    expect(
      deriveTayqanProjectQuota(
        null,
        [
          "project-a",
          "project-b",
          "project-c",
        ],
        "project-d",
      ).canAssignCurrentProject,
    ).toBe(true);
  });

  it("routes durable work orders through the same actor-aware gate", () => {
    const service = read(
      "src",
      "lib",
      "services",
      "tayqan-work-order-service.ts",
    );

    expect(service).toContain(
      "assertTayqanAccessEntitlement(actor)",
    );

    expect(service).not.toContain(
      "assertActiveTayqanEntitlement(actor.companyId)",
    );
  });
});
