import { describe, expect, it } from "vitest";
import {
  InvalidTenantScopeError,
  TenantAccessError,
  assertTenantAccess,
  filterByTenant,
  tenantCreateData,
  tenantScope,
} from "../src/lib/tenancy/tenant-scope";

describe("tenant scoping", () => {
  it("forces the active company into query and create data", () => {
    expect(tenantScope(" company-a ", { status: "ACTIVE", companyId: "company-b" })).toEqual({
      status: "ACTIVE",
      companyId: "company-a",
    });
    expect(tenantCreateData("company-a", { name: "Project", companyId: "company-b" })).toEqual({
      name: "Project",
      companyId: "company-a",
    });
  });

  it("filters and rejects cross-company records", () => {
    const records = [
      { id: "one", companyId: "company-a" },
      { id: "two", companyId: "company-b" },
    ];
    expect(filterByTenant(records, "company-a")).toEqual([records[0]]);
    expect(assertTenantAccess(records[0], "company-a")).toBe(records[0]);
    expect(() => assertTenantAccess(records[1], "company-a")).toThrow(TenantAccessError);
    expect(() => tenantScope("", {})).toThrow(InvalidTenantScopeError);
  });
});
