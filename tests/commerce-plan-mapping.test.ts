import { describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import {
  COMMERCE_LINKED_SOFTWARE_PLANS,
  ensureCommerceLinkedSoftwarePlan,
  findCommerceLinkedPlanSpec,
  resolveSoftwarePlanForCommerceProductCode,
} from "../src/lib/entitlements/commerce-plan-mapping";

/**
 * commerce-plan-mapping.ts bridges the AED-priced commerce catalogue
 * (starter/professional/business) to the pre-existing SoftwarePlan/
 * CompanySoftwareSubscription entitlement backbone. These specs are the
 * only place that bridge is defined — the seed script and the webhook
 * processor both call ensureCommerceLinkedSoftwarePlan with them, so
 * asserting on the specs here is asserting on production behavior, not a
 * test-only shape.
 */
describe("commerce-plan-mapping", () => {
  it("never reuses a legacy SoftwarePlan key (pro/business) — every commerce tier gets its own namespaced key", () => {
    const keys = COMMERCE_LINKED_SOFTWARE_PLANS.map((spec) => spec.softwarePlanKey);
    expect(keys).toEqual([
      "commerce_starter",
      "commerce_professional",
      "commerce_business",
      "commerce_enterprise_core",
      "commerce_enterprise_scale",
      "commerce_enterprise_authority",
    ]);
    for (const key of keys) {
      expect(key.startsWith("commerce_")).toBe(true);
    }
  });

  it("the three Enterprise tiers are annual-prepaid-only (monthlyPriceAed 0, not free) at their exact AED prices, use PlanType.ENTERPRISE, and are all unlimited-project", () => {
    const core = findCommerceLinkedPlanSpec("enterprise_core")!;
    const scale = findCommerceLinkedPlanSpec("enterprise_scale")!;
    const authority = findCommerceLinkedPlanSpec("enterprise_authority")!;

    for (const spec of [core, scale, authority]) {
      expect(spec.planType).toBe("ENTERPRISE");
      expect(spec.monthlyPriceAed).toBe(0);
      expect(spec.maxProjects).toBeNull();
    }

    expect(core.annualPriceAed).toBe(15000);
    expect(scale.annualPriceAed).toBe(25000);
    expect(authority.annualPriceAed).toBe(35000);

    expect(core.maxUsers).toBe(50);
    expect(scale.maxUsers).toBe(100);
    expect(authority.maxUsers).toBeNull(); // unlimited users, per the commercial spec
  });

  it("Starter's maxProjects (3) is strictly less than the legacy Pro plan's unlimited — mapping starter -> pro would over-grant", () => {
    const starter = findCommerceLinkedPlanSpec("starter")!;
    expect(starter.maxProjects).toBe(3);
  });

  it("Professional grants more than Starter, and Business is unlimited", () => {
    const starter = findCommerceLinkedPlanSpec("starter")!;
    const professional = findCommerceLinkedPlanSpec("professional")!;
    const business = findCommerceLinkedPlanSpec("business")!;
    expect(professional.maxProjects).toBeGreaterThan(starter.maxProjects!);
    expect(business.maxProjects).toBeNull();
  });

  it("returns null for a commerce product code with no SoftwarePlan equivalent (one-time purchases, add-ons)", () => {
    expect(findCommerceLinkedPlanSpec("boq_single_export")).toBeNull();
    expect(findCommerceLinkedPlanSpec("api_access")).toBeNull();
    expect(findCommerceLinkedPlanSpec("enterprise_installation")).toBeNull();
  });

  it("ensureCommerceLinkedSoftwarePlan is idempotent — calling it twice does not create a duplicate row and keeps the limits in sync", async () => {
    const spec = findCommerceLinkedPlanSpec("starter")!;
    const first = await ensureCommerceLinkedSoftwarePlan(spec);
    const second = await ensureCommerceLinkedSoftwarePlan(spec);
    expect(first.id).toBe(second.id);
    expect(second.maxProjects).toBe(3);
    expect(second.currency).toBe("AED");

    const count = await prisma.softwarePlan.count({ where: { key: "commerce_starter" } });
    expect(count).toBe(1);
  });

  it("resolveSoftwarePlanForCommerceProductCode resolves business to an unlimited-project plan distinct from starter/professional", async () => {
    const plan = await resolveSoftwarePlanForCommerceProductCode("business");
    expect(plan).not.toBeNull();
    expect(plan!.key).toBe("commerce_business");
    expect(plan!.maxProjects).toBeNull();
  });

  it("resolveSoftwarePlanForCommerceProductCode returns null for a non-subscription product code without creating any SoftwarePlan row", async () => {
    const before = await prisma.softwarePlan.count();
    const plan = await resolveSoftwarePlanForCommerceProductCode("technical_report_single");
    expect(plan).toBeNull();
    const after = await prisma.softwarePlan.count();
    expect(after).toBe(before);
  });
});
