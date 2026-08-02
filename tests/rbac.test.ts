import { UserRole } from "@prisma/client";
import { describe, expect, it } from "vitest";
import { hasCapability, requireCapability } from "../src/lib/auth/rbac";
import { PermissionDeniedError } from "../src/lib/errors/app-error";
import type { CurrentActor } from "../src/lib/auth/current-actor";

function actor(role: UserRole): CurrentActor {
  return { userId: "u1", companyId: "c1", role, fullName: "Test User", email: "t@example.com" };
}

describe("RBAC capability matrix", () => {
  it("grants the company owner every capability", () => {
    expect(hasCapability(UserRole.COMPANY_OWNER, "company:manage")).toBe(true);
    expect(hasCapability(UserRole.COMPANY_OWNER, "proposals:manage")).toBe(true);
  });

  it("limits the estimator to BOQ editing and catalogue management", () => {
    expect(hasCapability(UserRole.ESTIMATOR, "boq:edit")).toBe(true);
    expect(hasCapability(UserRole.ESTIMATOR, "catalogue:manage")).toBe(true);
    expect(hasCapability(UserRole.ESTIMATOR, "boq:lock")).toBe(false);
    expect(hasCapability(UserRole.ESTIMATOR, "users:manage")).toBe(false);
  });

  it("lets the quantity surveyor lock BOQs but not manage the company", () => {
    expect(hasCapability(UserRole.QUANTITY_SURVEYOR, "boq:lock")).toBe(true);
    expect(hasCapability(UserRole.QUANTITY_SURVEYOR, "company:manage")).toBe(false);
  });

  it("throws PermissionDeniedError when requireCapability is not satisfied", () => {
    expect(() => requireCapability(actor(UserRole.DESIGNER), "boq:edit")).toThrow(
      PermissionDeniedError,
    );
    expect(() => requireCapability(actor(UserRole.QUANTITY_SURVEYOR), "boq:edit")).not.toThrow();
  });
});
