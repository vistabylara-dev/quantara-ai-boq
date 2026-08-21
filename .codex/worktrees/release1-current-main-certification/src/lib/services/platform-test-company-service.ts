import { PlatformRole, UserRole } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { hashPassword } from "@/lib/auth/password";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";

/**
 * ADMIN-CONTROL-1 section 6 — sandbox companies, clearly marked
 * (isTestCompany), tenant-isolated exactly like any other company (no
 * special-cased data access), never confused with a paying customer. The
 * owner creates a real login-able company + initial user through the normal
 * signup data shape — no session impersonation, no cross-tenant write path.
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Test company management is restricted to the platform owner.");
  }
}

export type CreateTestCompanyInput = {
  legalName: string;
  tradeName: string;
  companyEmail: string;
  ownerFullName: string;
  ownerEmail: string;
  ownerPassword: string;
};

export async function createTestCompany(owner: PlatformActor, input: CreateTestCompanyInput) {
  requireOwner(owner);

  const existingCompany = await prisma.company.findFirst({ where: { email: input.companyEmail } });
  if (existingCompany) throw new AppError("COMPANY_EMAIL_TAKEN", "A company already uses this email.", 409);
  const existingUser = await prisma.user.findUnique({ where: { email: input.ownerEmail } });
  if (existingUser) throw new AppError("USER_EMAIL_TAKEN", "A user already uses this email.", 409);

  const passwordHash = await hashPassword(input.ownerPassword);

  const result = await prisma.$transaction(async (tx) => {
    const company = await tx.company.create({
      data: { legalName: input.legalName, tradeName: input.tradeName, email: input.companyEmail, isTestCompany: true },
    });
    const user = await tx.user.create({
      data: {
        companyId: company.id,
        email: input.ownerEmail,
        passwordHash,
        fullName: input.ownerFullName,
        role: UserRole.COMPANY_OWNER,
        isActive: true,
        emailVerifiedAt: new Date(),
      },
    });
    return { company, user };
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "TEST_COMPANY_CREATED",
    targetType: "Company",
    targetId: result.company.id,
    metadata: { legalName: input.legalName, ownerEmail: input.ownerEmail },
  });

  return { companyId: result.company.id, userId: result.user.id, legalName: result.company.legalName, ownerEmail: result.user.email };
}

/**
 * Hard-deletes a company and its dependents. Only ever permitted for a
 * company explicitly marked isTestCompany — refuses outright for anything
 * that could be a real customer, regardless of who is asking.
 */
export async function archiveTestCompany(owner: PlatformActor, companyId: string) {
  requireOwner(owner);

  const company = await prisma.company.findUnique({ where: { id: companyId } });
  if (!company) throw new NotFoundError("Company not found.");
  if (!company.isTestCompany) {
    throw new AppError("NOT_A_TEST_COMPANY", "Only companies marked isTestCompany can be archived through this action.", 403);
  }

  await prisma.company.delete({ where: { id: companyId } });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "TEST_COMPANY_ARCHIVED",
    targetType: "Company",
    targetId: companyId,
    metadata: { legalName: company.legalName },
  });

  return { archived: true };
}

export async function listTestCompanies(owner: PlatformActor) {
  requireOwner(owner);
  const companies = await prisma.company.findMany({
    where: { isTestCompany: true },
    select: { id: true, legalName: true, tradeName: true, email: true, createdAt: true, _count: { select: { users: true, projects: true } } },
    orderBy: { createdAt: "desc" },
    take: 50,
  });
  return companies.map((c) => ({ id: c.id, legalName: c.legalName, tradeName: c.tradeName, email: c.email, createdAt: c.createdAt.toISOString(), userCount: c._count.users, projectCount: c._count.projects }));
}
