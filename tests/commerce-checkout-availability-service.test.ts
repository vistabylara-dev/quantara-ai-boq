import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { getCheckoutAvailability } from "../src/lib/services/commerce-checkout-availability-service";
import { upsertCommerceProduct, upsertCommercePrice } from "../src/lib/repositories/commerce-product-repository";
import { createMapping } from "../src/lib/repositories/commerce-provider-mapping-repository";
import { seedEnterpriseCommerceProducts } from "../prisma/seed-data/commerce-products";

const RUN_ID = `${Date.now()}-${process.pid}-availability`;

function actorFor(userId: string, companyId: string, email: string): CurrentActor {
  return { userId, companyId, role: "COMPANY_OWNER", fullName: "Availability Test Owner", email };
}

/**
 * CORRECTION-1 — the external audit's regression list (A-G) was framed
 * around createCommerceCheckoutSession, but also explicitly required
 * covering getCheckoutAvailability: "Marketplace purchase buttons are driven
 * by the availability service", not the checkout-creation function directly.
 * These tests exercise the SAME family-aware coexistence rules
 * (classifyCommerceProductFamily in commerce-checkout-service.ts) from that
 * service's perspective — what a Buy button would actually show as
 * available/unavailable — including scenario G (an active core software
 * subscription must never mark TAYQAN unavailable), which has no equivalent
 * in commerce-checkout-service.test.ts because TAYQAN's own checkout never
 * calls createCommerceCheckoutSession at all.
 */
describe("commerce-checkout-availability-service (integration, real local Postgres)", () => {
  let companyId: string;
  let userId: string;

  beforeAll(async () => {
    const company = await prisma.company.create({
      data: { legalName: `Availability Co ${RUN_ID}`, tradeName: "Availability Co", email: `availability-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const user = await prisma.user.create({
      data: { companyId, email: `availability-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
    });
    userId = user.id;

    const plan = await prisma.softwarePlan.create({ data: { key: `availability_plan_${RUN_ID}`, name: "Availability Test Plan", planType: "PRO" } });
    await prisma.companySoftwareSubscription.create({
      data: { companyId, softwarePlanId: plan.id, status: "ACTIVE", externalSubscriptionId: `sub_availability_${RUN_ID}`, source: "stripe" },
    });

    const discipline = await prisma.masterDiscipline.findFirstOrThrow();
    const ownedPackage = await prisma.industryDataPackage.create({
      data: { key: `availability-owned-${RUN_ID}`, name: `Availability Owned Library ${RUN_ID}`, disciplineId: discipline.id, packageType: "SPECIALIST", monthlyPrice: 0 },
    });
    const otherPackage = await prisma.industryDataPackage.create({
      data: { key: `availability-other-${RUN_ID}`, name: `Availability Other Library ${RUN_ID}`, disciplineId: discipline.id, packageType: "SPECIALIST", monthlyPrice: 0 },
    });
    const ownerGrantedPackage = await prisma.industryDataPackage.create({
      data: { key: `availability-owner-granted-${RUN_ID}`, name: `Availability Owner-Granted Library ${RUN_ID}`, disciplineId: discipline.id, packageType: "SPECIALIST", monthlyPrice: 0 },
    });

    async function makeAvailablePrice(codeSuffix: string, industryPackageId: string | null) {
      const { product } = await upsertCommerceProduct({
        code: `test_availability_product_${codeSuffix}_${RUN_ID}`,
        type: "SUBSCRIPTION",
        name: `Availability Test Product ${codeSuffix}`,
        purchaseMode: "DIRECT",
        isActive: true,
        isPublic: true,
        industryPackageId,
      });
      const { price } = await upsertCommercePrice({
        productId: product.id,
        code: `test_availability_price_${codeSuffix}_${RUN_ID}`,
        amountMinor: 14900,
        billingInterval: "MONTH",
      });
      await prisma.commercePrice.update({ where: { id: price.id }, data: { reviewStatus: "APPROVED" } });
      await createMapping({
        provider: "STRIPE",
        environment: "TEST",
        commerceProductId: product.id,
        commercePriceId: price.id,
        providerProductId: `prod_availability_${codeSuffix}_${RUN_ID}`,
        providerPriceId: `price_availability_${codeSuffix}_${RUN_ID}`,
        providerObjectType: "PRICE",
      });
      return { product, price };
    }

    await makeAvailablePrice("core", null);
    await makeAvailablePrice("owned_lib", ownedPackage.id);
    await makeAvailablePrice("other_lib", otherPackage.id);
    await makeAvailablePrice("owner_granted_lib", ownerGrantedPackage.id);

    await prisma.companyPackageSubscription.create({
      data: { companyId, packageId: ownedPackage.id, status: "ACTIVE", externalSubscriptionId: `sub_availability_owned_lib_${RUN_ID}`, source: "stripe" },
    });
    // item-C (Round 3 correction) — an owner/admin-granted entitlement
    // (source: "platform_owner_activation", as written by
    // master-catalogue-activation-service.ts), not a Stripe purchase. Must
    // block re-purchase of this exact library exactly as a "stripe"-sourced
    // row does.
    await prisma.companyPackageSubscription.create({
      data: { companyId, packageId: ownerGrantedPackage.id, status: "ACTIVE", startsAt: new Date(), source: "platform_owner_activation" },
    });

    // item-A (Round 3 correction) — a sales-led (CONTACT_SALES) product,
    // otherwise fully eligible (active, public, SUBSCRIPTION, approved,
    // TEST-mapped price) — the same shape enterprise_core/scale/authority
    // now have. Proves getCheckoutAvailability's purchaseMode: "DIRECT"
    // filter excludes it, not merely that it lacks a provider mapping.
    const { product: contactSalesProduct } = await upsertCommerceProduct({
      code: `test_availability_contact_sales_${RUN_ID}`,
      type: "SUBSCRIPTION",
      name: "Availability Contact Sales Product",
      purchaseMode: "CONTACT_SALES",
      isActive: true,
      isPublic: true,
    });
    const { price: contactSalesPrice } = await upsertCommercePrice({
      productId: contactSalesProduct.id,
      code: `test_availability_contact_sales_price_${RUN_ID}`,
      amountMinor: 1500000,
      billingInterval: "YEAR",
    });
    await prisma.commercePrice.update({ where: { id: contactSalesPrice.id }, data: { reviewStatus: "APPROVED" } });
    await createMapping({
      provider: "STRIPE",
      environment: "TEST",
      commerceProductId: contactSalesProduct.id,
      commercePriceId: contactSalesPrice.id,
      providerProductId: `prod_availability_contact_sales_${RUN_ID}`,
      providerPriceId: `price_availability_contact_sales_${RUN_ID}`,
      providerObjectType: "PRICE",
    });
  });

  afterAll(async () => {
    await prisma.companyPackageSubscription.deleteMany({ where: { companyId } });
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.commerceProduct.deleteMany({ where: { code: { contains: RUN_ID } } });
    await prisma.industryDataPackageItem.deleteMany({ where: { package: { key: { contains: RUN_ID } } } });
    await prisma.industryDataPackage.deleteMany({ where: { key: { contains: RUN_ID } } });

    // The test approves the real, shared, never-deleted Enterprise one-time
    // prices. Reset BEFORE deleting `userId` below — reviewedByUserId's FK is
    // onDelete: SetNull, so deleting the user first would silently leave
    // these rows APPROVED with a null reviewer, corrupting the invariant
    // commerce-product-service.test.ts's byte-for-byte guard test checks.
    await prisma.commercePrice.updateMany({
      where: { code: { in: ["enterprise_core_one_time_aed_15000", "enterprise_scale_one_time_aed_25000", "enterprise_authority_one_time_aed_35000"] } },
      data: { reviewStatus: "REQUIRES_REVIEW", reviewedByUserId: null, reviewedAt: null },
    });

    await prisma.user.deleteMany({ where: { id: userId } });
    await prisma.company.deleteMany({ where: { id: companyId } });
    await prisma.$disconnect();
  });

  it("(A) reports hasExistingSubscription: true from the active core subscription", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    expect(availability.hasExistingSubscription).toBe(true);
  });

  it("(A) the company's own core product price is reported unavailable (EXISTING_SUBSCRIPTION) — at most one core subscription", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    const coreProduct = availability.products.find((p: any) => p.productCode === `test_availability_product_core_${RUN_ID}`);
    expect(coreProduct).toBeDefined();
    expect(coreProduct!.prices[0].available).toBe(false);
    expect(coreProduct!.prices[0].unavailableReason).toBe("EXISTING_SUBSCRIPTION");
  });

  it("(D) a library the company does NOT own remains available despite the active core subscription", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    const otherLib = availability.products.find((p: any) => p.productCode === `test_availability_product_other_lib_${RUN_ID}`);
    expect(otherLib).toBeDefined();
    expect(otherLib!.prices[0].available).toBe(true);
    expect(otherLib!.prices[0].unavailableReason).toBeNull();
  });

  it("(C) a library the company already owns is reported unavailable (EXISTING_SUBSCRIPTION) — cannot buy the same library twice", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    const ownedLib = availability.products.find((p: any) => p.productCode === `test_availability_product_owned_lib_${RUN_ID}`);
    expect(ownedLib).toBeDefined();
    expect(ownedLib!.prices[0].available).toBe(false);
    expect(ownedLib!.prices[0].unavailableReason).toBe("EXISTING_SUBSCRIPTION");
  });

  it("item-C: a library owner/admin-granted (platform_owner_activation, not stripe) is also reported unavailable — source-independent ownership", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    const ownerGrantedLib = availability.products.find((p: any) => p.productCode === `test_availability_product_owner_granted_lib_${RUN_ID}`);
    expect(ownerGrantedLib).toBeDefined();
    expect(ownerGrantedLib!.prices[0].available).toBe(false);
    expect(ownerGrantedLib!.prices[0].unavailableReason).toBe("EXISTING_SUBSCRIPTION");
  });

  it("item-A: a sales-led (CONTACT_SALES) product is absent entirely from checkout availability, never merely marked unavailable", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    const contactSales = availability.products.find((p: any) => p.productCode === `test_availability_contact_sales_${RUN_ID}`);
    expect(contactSales).toBeUndefined();
  });

  it("the real Enterprise products appear with their approved one-time AED prices", async () => {
    await seedEnterpriseCommerceProducts(prisma);
    for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
      const stub = await prisma.commerceProduct.findUniqueOrThrow({ where: { code }, include: { prices: true } });
      expect(stub.purchaseMode).toBe("DIRECT");
      expect(stub.type).toBe("ONE_TIME");
      const oneTimePrice = stub.prices.find((p: any) => p.billingInterval === "ONE_TIME" && p.isActive);
      expect(oneTimePrice).toBeDefined();
      // reviewedByUserId set alongside reviewStatus so this reads as a
      // genuinely governed approval — commerce-product-service.test.ts
      // asserts on these same three anchor rows that reviewStatus:
      // APPROVED never appears without a reviewer.
      await prisma.commercePrice.update({ where: { id: oneTimePrice!.id }, data: { reviewStatus: "APPROVED", reviewedByUserId: userId, reviewedAt: new Date() } });
    }

    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);

    for (const code of ["enterprise_core", "enterprise_scale", "enterprise_authority"]) {
      const plan = availability.products.find((p: any) => p.productCode === code);
      expect(plan).toBeDefined();
      expect(plan!.prices).not.toBeNull();
      expect(plan!.prices[0].currency).toBe("AED");
      expect(plan!.prices[0].billingInterval).toBe("ONE_TIME");
      expect((plan as unknown as { available?: unknown }).available).toBeUndefined();
    }
  });

  it("(G) TAYQAN Monthly is never marked unavailable due to an active core software subscription", async () => {
    const actor = actorFor(userId, companyId, `availability-owner-${RUN_ID}@example.com`);
    const availability = await getCheckoutAvailability(actor);
    const tayqan = availability.products.find((p: any) => p.productCode === "tayqan_monthly");
    // If tayqan_monthly isn't APPROVED/SYNCED in this database yet, it's
    // reported unavailable for a setup reason, not EXISTING_SUBSCRIPTION —
    // either is consistent with "not blocked by the company's core
    // subscription", but assert the stronger claim whenever it IS eligible.
    if (tayqan) {
      for (const price of tayqan.prices) {
        expect(price.unavailableReason).not.toBe("EXISTING_SUBSCRIPTION");
      }
    }
  });
});
