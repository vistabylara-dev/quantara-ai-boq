import { describe, expect, it, vi } from "vitest";

/**
 * MARKETPLACE-FULL-STRIPE-LINK — a pure unit test (no database) for the
 * narrow production-safe entrypoint: proves it calls exactly the three
 * pricing-pipeline functions, in the required order (backfill -> seed ->
 * approval, per library-package-pricing.ts's own doc comment), and nothing
 * else. The underlying three functions' real DB behavior is already proven
 * end to end by tests/library-package-pricing-sync.test.ts — this test only
 * needs to prove the orchestration is correct, so every dependency is mocked.
 */
const callOrder: string[] = [];

const backfillLibraryPackagePricingMock = vi.hoisted(() => vi.fn());
const approveLibraryPackagePricesMock = vi.hoisted(() => vi.fn());
const seedCommerceProductsMock = vi.hoisted(() => vi.fn());

vi.mock("../prisma/seed-data/library-package-pricing", () => ({
  backfillLibraryPackagePricing: backfillLibraryPackagePricingMock,
  approveLibraryPackagePrices: approveLibraryPackagePricesMock,
}));
vi.mock("../prisma/seed-data/commerce-products", () => ({
  seedCommerceProducts: seedCommerceProductsMock,
}));

import { syncLibraryPackagePricing } from "../scripts/sync-library-package-pricing";

describe("syncLibraryPackagePricing (unit, mocked — no database)", () => {
  it("calls backfill, then seedCommerceProducts, then approval, in that exact order, with no other side effects", async () => {
    callOrder.length = 0;
    backfillLibraryPackagePricingMock.mockReset().mockImplementation(async () => {
      callOrder.push("backfill");
      return { updated: ["hvac-library"], unchanged: [], missing: [] };
    });
    seedCommerceProductsMock.mockReset().mockImplementation(async () => {
      callOrder.push("seed");
      return {
        productsInserted: 1, productsUpdated: 0, productsUnchanged: 0,
        pricesInserted: 2, pricesUnchanged: 0, pricesArchived: 0,
        templatesInserted: 1, templatesUpdated: 0,
        industryProductsCreated: ["hvac-library"], industryProductsSkipped: [],
      };
    });
    approveLibraryPackagePricesMock.mockReset().mockImplementation(async () => {
      callOrder.push("approval");
      return { approved: ["industry_hvac_library_monthly"], alreadyApproved: [], missing: [] };
    });

    const fakePrisma = { marker: "fake-prisma-client" } as any;
    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const result = await syncLibraryPackagePricing(fakePrisma);

    expect(callOrder).toEqual(["backfill", "seed", "approval"]);
    expect(backfillLibraryPackagePricingMock).toHaveBeenCalledTimes(1);
    expect(backfillLibraryPackagePricingMock).toHaveBeenCalledWith(fakePrisma);
    expect(seedCommerceProductsMock).toHaveBeenCalledTimes(1);
    expect(seedCommerceProductsMock).toHaveBeenCalledWith(fakePrisma);
    expect(approveLibraryPackagePricesMock).toHaveBeenCalledTimes(1);
    expect(approveLibraryPackagePricesMock).toHaveBeenCalledWith(fakePrisma);

    expect(result.backfill.updated).toEqual(["hvac-library"]);
    expect(result.commerce.industryProductsCreated).toEqual(["hvac-library"]);
    expect(result.approval.approved).toEqual(["industry_hvac_library_monthly"]);

    // Prints the same three summary-line formats prisma/seed.ts already prints.
    const logged = consoleLogSpy.mock.calls.map((call) => call[0] as string);
    expect(logged).toHaveLength(3);
    expect(logged[0]).toMatch(/^Library package pricing backfill: updated \[hvac-library\]/);
    expect(logged[1]).toMatch(/^Seeded commerce catalogue: /);
    expect(logged[2]).toMatch(/^Library package price approval: approved \[industry_hvac_library_monthly\]/);

    consoleLogSpy.mockRestore();
  });

  it("propagates a failure from any step without calling the ones after it", async () => {
    callOrder.length = 0;
    backfillLibraryPackagePricingMock.mockReset().mockImplementation(async () => {
      callOrder.push("backfill");
      return { updated: [], unchanged: [], missing: [] };
    });
    const seedError = new Error("seed failed");
    seedCommerceProductsMock.mockReset().mockImplementation(async () => {
      callOrder.push("seed");
      throw seedError;
    });
    approveLibraryPackagePricesMock.mockReset().mockImplementation(async () => {
      callOrder.push("approval");
      return { approved: [], alreadyApproved: [], missing: [] };
    });

    const consoleLogSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const fakePrisma = { marker: "fake-prisma-client" } as any;

    await expect(syncLibraryPackagePricing(fakePrisma)).rejects.toBe(seedError);

    expect(callOrder).toEqual(["backfill", "seed"]);
    expect(approveLibraryPackagePricesMock).not.toHaveBeenCalled();

    consoleLogSpy.mockRestore();
  });
});
