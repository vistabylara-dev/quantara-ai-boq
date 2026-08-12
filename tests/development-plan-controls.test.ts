import { PlatformRole } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "../src/lib/db/prisma";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { NotFoundError, PermissionDeniedError } from "../src/lib/errors/app-error";
import { activateDevelopmentSoftwarePlan, expireDevelopmentSoftwarePlan } from "../src/lib/entitlements/entitlement-service";

/**
 * STRIPE-COMMERCIAL-1 (second audit fix) — the development plan-activation
 * path must never function as a free bypass of Stripe checkout. It is
 * restricted to a platform owner acting on a Company.isTestCompany
 * sandbox/demo company (see assertDevelopmentControlsAllowed in
 * entitlement-service.ts), and expireDevelopmentSoftwarePlan must never
 * touch a subscription whose source is "stripe" regardless of who calls it.
 */

const RUN_ID = `${Date.now()}-${process.pid}-devplan`;

function actorFor(userId: string, companyId: string, email: string): CurrentActor {
  return { userId, companyId, role: "COMPANY_OWNER", fullName: "Dev Plan Test Owner", email };
}

describe("development plan-activation controls (integration, real local Postgres)", () => {
  let planKey: string;
  let realCompanyId: string;
  let realCompanyOwnerId: string;
  let testCompanyId: string;
  let testCompanyPlatformAdminId: string;
  let testCompanyPlatformOwnerId: string;
  let testCompanyTwoId: string;

  beforeAll(async () => {
    const plan = await prisma.softwarePlan.create({ data: { key: `test_devplan_${RUN_ID}`, name: "Dev Plan Test", planType: "PRO" } });
    planKey = plan.key;

    const realCompany = await prisma.company.create({ data: { legalName: `Real Customer Co ${RUN_ID}`, tradeName: "Real Co", email: `devplan-real-${RUN_ID}@example.com`, isTestCompany: false } });
    realCompanyId = realCompany.id;
    const realOwner = await prisma.user.create({
      data: { companyId: realCompanyId, email: `devplan-real-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Real Owner", role: "COMPANY_OWNER", isActive: true, emailVerifiedAt: new Date() },
    });
    realCompanyOwnerId = realOwner.id;

    const testCompany = await prisma.company.create({ data: { legalName: `Sandbox Co ${RUN_ID}`, tradeName: "Sandbox Co", email: `devplan-sandbox-${RUN_ID}@example.com`, isTestCompany: true } });
    testCompanyId = testCompany.id;
    const testAdmin = await prisma.user.create({
      data: { companyId: testCompanyId, email: `devplan-test-admin-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Test Admin", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_ADMIN, isActive: true, emailVerifiedAt: new Date() },
    });
    testCompanyPlatformAdminId = testAdmin.id;
    const testOwner = await prisma.user.create({
      data: { companyId: testCompanyId, email: `devplan-test-owner-${RUN_ID}@example.com`, passwordHash: "hash", fullName: "Test Owner", role: "COMPANY_OWNER", platformRole: PlatformRole.PLATFORM_OWNER, isActive: true, emailVerifiedAt: new Date() },
    });
    testCompanyPlatformOwnerId = testOwner.id;

    // A SECOND sandbox/test company — needed to exercise the user.companyId
    // === actor.companyId check in isolation from the isTestCompany check:
    // an actor claiming this company (also isTestCompany: true) would still
    // pass the isTestCompany gate, so only the tenant-match check catches a
    // user acting with a companyId that isn't actually theirs.
    const testCompanyTwo = await prisma.company.create({ data: { legalName: `Sandbox Co Two ${RUN_ID}`, tradeName: "Sandbox Co Two", email: `devplan-sandbox-two-${RUN_ID}@example.com`, isTestCompany: true } });
    testCompanyTwoId = testCompanyTwo.id;
  });

  afterAll(async () => {
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: { in: [realCompanyId, testCompanyId, testCompanyTwoId] } } });
    await prisma.softwarePlan.deleteMany({ where: { key: { contains: RUN_ID } } });
    await prisma.user.deleteMany({ where: { id: { in: [realCompanyOwnerId, testCompanyPlatformAdminId, testCompanyPlatformOwnerId] } } });
    await prisma.company.deleteMany({ where: { id: { in: [realCompanyId, testCompanyId, testCompanyTwoId] } } });
    await prisma.$disconnect();
  });

  it("rejects a COMPANY_OWNER on a real (non-test) company, even though COMPANY_OWNER holds entitlements:manage — this is the actual Stripe-bypass prevention", async () => {
    const actor = actorFor(realCompanyOwnerId, realCompanyId, `devplan-real-owner-${RUN_ID}@example.com`);
    await expect(activateDevelopmentSoftwarePlan(actor, planKey)).rejects.toMatchObject({ code: "DEVELOPMENT_CONTROLS_NOT_AVAILABLE" });
    const subs = await prisma.companySoftwareSubscription.count({ where: { companyId: realCompanyId } });
    expect(subs).toBe(0);
  });

  it("rejects a non-platform-owner (PLATFORM_ADMIN) even on a sandbox/test company", async () => {
    const actor = actorFor(testCompanyPlatformAdminId, testCompanyId, `devplan-test-admin-${RUN_ID}@example.com`);
    await expect(activateDevelopmentSoftwarePlan(actor, planKey)).rejects.toBeInstanceOf(PermissionDeniedError);
  });

  it("rejects an actor whose claimed companyId is a different (even if also sandbox) company than the user's actual companyId", async () => {
    // testCompanyPlatformOwnerId genuinely belongs to testCompanyId — this
    // actor claims testCompanyTwoId instead. Both companies are
    // isTestCompany: true, so only the tenant-match re-check (not the
    // isTestCompany check) can catch this.
    const actor = actorFor(testCompanyPlatformOwnerId, testCompanyTwoId, `devplan-test-owner-${RUN_ID}@example.com`);
    await expect(activateDevelopmentSoftwarePlan(actor, planKey)).rejects.toBeInstanceOf(PermissionDeniedError);
    const subs = await prisma.companySoftwareSubscription.count({ where: { companyId: testCompanyTwoId } });
    expect(subs).toBe(0);
  });

  it("allows a platform owner acting on a sandbox/test company", async () => {
    const actor = actorFor(testCompanyPlatformOwnerId, testCompanyId, `devplan-test-owner-${RUN_ID}@example.com`);
    await activateDevelopmentSoftwarePlan(actor, planKey);
    const sub = await prisma.companySoftwareSubscription.findFirst({ where: { companyId: testCompanyId }, orderBy: { createdAt: "desc" } });
    expect(sub?.status).toBe("ACTIVE");
    expect(sub?.source).toBe("development");
  });

  it("expireDevelopmentSoftwarePlan never expires a subscription whose source is stripe, even for a platform owner on a test company", async () => {
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: testCompanyId } });
    const plan = await prisma.softwarePlan.findUniqueOrThrow({ where: { key: planKey } });
    await prisma.companySoftwareSubscription.create({
      data: { companyId: testCompanyId, softwarePlanId: plan.id, status: "ACTIVE", externalSubscriptionId: `sub_devplan_stripe_${RUN_ID}`, source: "stripe" },
    });

    const actor = actorFor(testCompanyPlatformOwnerId, testCompanyId, `devplan-test-owner-${RUN_ID}@example.com`);
    await expect(expireDevelopmentSoftwarePlan(actor)).rejects.toBeInstanceOf(NotFoundError);

    const sub = await prisma.companySoftwareSubscription.findFirst({ where: { companyId: testCompanyId, source: "stripe" } });
    expect(sub?.status).toBe("ACTIVE"); // untouched
  });

  it("expireDevelopmentSoftwarePlan expires a genuine development-sourced subscription for a platform owner on a test company", async () => {
    await prisma.companySoftwareSubscription.deleteMany({ where: { companyId: testCompanyId } });
    const plan = await prisma.softwarePlan.findUniqueOrThrow({ where: { key: planKey } });
    await prisma.companySoftwareSubscription.create({
      data: { companyId: testCompanyId, softwarePlanId: plan.id, status: "ACTIVE", source: "development" },
    });

    const actor = actorFor(testCompanyPlatformOwnerId, testCompanyId, `devplan-test-owner-${RUN_ID}@example.com`);
    await expireDevelopmentSoftwarePlan(actor);

    const sub = await prisma.companySoftwareSubscription.findFirst({ where: { companyId: testCompanyId, source: "development" } });
    expect(sub?.status).toBe("EXPIRED");
  });

  it("expireDevelopmentSoftwarePlan rejects a COMPANY_OWNER on a real (non-test) company", async () => {
    const plan = await prisma.softwarePlan.findUniqueOrThrow({ where: { key: planKey } });
    await prisma.companySoftwareSubscription.create({
      data: { companyId: realCompanyId, softwarePlanId: plan.id, status: "ACTIVE", source: "development" },
    });
    const actor = actorFor(realCompanyOwnerId, realCompanyId, `devplan-real-owner-${RUN_ID}@example.com`);
    await expect(expireDevelopmentSoftwarePlan(actor)).rejects.toMatchObject({ code: "DEVELOPMENT_CONTROLS_NOT_AVAILABLE" });
  });
});
