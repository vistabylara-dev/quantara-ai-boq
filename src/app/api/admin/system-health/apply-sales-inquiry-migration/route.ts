import { PlatformRole } from "@prisma/client";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";
import { readSessionTokenFromCookies } from "@/lib/auth/session";
import { hashToken } from "@/lib/auth/tokens";
import { UnauthorizedError, PermissionDeniedError } from "@/lib/errors/app-error";

export const dynamic = "force-dynamic";

/**
 * STRIPE-1B-RECOVERY — owner-only, idempotent apply of migration
 * 20260805025000_add_sales_inquiry's TRUE end state (2 nullable columns on
 * Company, 2 nullable columns on User, the SalesInquiry table with its full
 * current column set). That migration was never applied to production.
 *
 * Deliberate bootstrap auth check, NOT the shared getCurrentActor(): the
 * standard path does `prisma.session.findUnique({ include: { user: true } })`,
 * which selects every User column including jobTitle/marketingConsent — the
 * exact columns this endpoint exists to add. On production, where they don't
 * exist yet, that query throws and breaks auth for every request, including
 * this one. This endpoint instead resolves the session and loads the user
 * with an explicit, narrow `select` that never touches the missing columns,
 * so it can run precisely when the standard auth path cannot. Do not reuse
 * this pattern elsewhere — once this migration is applied, the standard
 * getCurrentActor() path works normally again and this workaround is no
 * longer needed anywhere else.
 */
async function requireOwnerWithoutTouchingMissingColumns() {
  const rawToken = await readSessionTokenFromCookies();
  if (!rawToken) throw new UnauthorizedError();

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(rawToken) },
    select: { id: true, userId: true, expiresAt: true },
  });
  if (!session || session.expiresAt.getTime() <= Date.now()) throw new UnauthorizedError();

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, isActive: true, platformRole: true, emailVerifiedAt: true },
  });
  if (!user || !user.isActive) throw new UnauthorizedError();
  if (!user.emailVerifiedAt) throw new PermissionDeniedError("Platform access requires a verified email address.");
  if (user.platformRole !== PlatformRole.PLATFORM_OWNER) {
    throw new PermissionDeniedError("Only a platform owner may perform this action.");
  }
  return user;
}

export async function GET() {
  try {
    await requireOwnerWithoutTouchingMissingColumns();
    const log: string[] = [];
    const MIGRATION_NAME = "20260805025000_add_sales_inquiry";
    const CHECKSUM = "e844c9dfb791b910a2b86c4a5f6821710a103c49609e3265519dd4598cde58d2";

    const alreadyRecorded = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME}
    `;
    if (alreadyRecorded.length > 0) {
      return apiSuccess({ alreadyApplied: true, log: ["Migration already recorded as applied — no action taken."] });
    }

    await prisma.$transaction(async (tx) => {
      const companyCols = await tx.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'Company' AND column_name IN ('primaryIndustry', 'monthlyVolume')
      `;
      const companyColNames = new Set(companyCols.map((c) => c.column_name));
      if (!companyColNames.has("primaryIndustry")) {
        await tx.$executeRaw`ALTER TABLE "Company" ADD COLUMN "primaryIndustry" TEXT`;
        log.push('Added Company."primaryIndustry".');
      } else {
        log.push('Company."primaryIndustry" already exists — skipped.');
      }
      if (!companyColNames.has("monthlyVolume")) {
        await tx.$executeRaw`ALTER TABLE "Company" ADD COLUMN "monthlyVolume" TEXT`;
        log.push('Added Company."monthlyVolume".');
      } else {
        log.push('Company."monthlyVolume" already exists — skipped.');
      }

      const userCols = await tx.$queryRaw<{ column_name: string }[]>`
        SELECT column_name FROM information_schema.columns WHERE table_name = 'User' AND column_name IN ('jobTitle', 'marketingConsent')
      `;
      const userColNames = new Set(userCols.map((c) => c.column_name));
      if (!userColNames.has("jobTitle")) {
        await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN "jobTitle" TEXT`;
        log.push('Added User."jobTitle".');
      } else {
        log.push('User."jobTitle" already exists — skipped.');
      }
      if (!userColNames.has("marketingConsent")) {
        await tx.$executeRaw`ALTER TABLE "User" ADD COLUMN "marketingConsent" BOOLEAN`;
        log.push('Added User."marketingConsent".');
      } else {
        log.push('User."marketingConsent" already exists — skipped.');
      }

      const salesInquiryExists = await tx.$queryRaw<{ table_name: string }[]>`
        SELECT table_name FROM information_schema.tables WHERE table_name = 'SalesInquiry'
      `;
      if (salesInquiryExists.length === 0) {
        await tx.$executeRaw`
          CREATE TABLE "SalesInquiry" (
            "id" UUID NOT NULL,
            "firstName" TEXT NOT NULL,
            "lastName" TEXT NOT NULL,
            "workEmail" TEXT NOT NULL,
            "companySize" TEXT NOT NULL,
            "useCase" TEXT NOT NULL,
            "companyType" TEXT,
            "constructionDiscipline" TEXT,
            "currentBoqProcess" TEXT,
            "monthlyVolume" TEXT,
            "requiredInputs" TEXT,
            "requiredOutputs" TEXT,
            "numberOfUsers" TEXT,
            "integrationRequirements" TEXT,
            "preferredContactMethod" TEXT,
            "consent" BOOLEAN,
            "deliveryStatus" TEXT NOT NULL DEFAULT 'stored',
            "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
            "updatedAt" TIMESTAMP(3) NOT NULL,
            CONSTRAINT "SalesInquiry_pkey" PRIMARY KEY ("id")
          )
        `;
        log.push("Created table SalesInquiry.");
      } else {
        log.push("Table SalesInquiry already exists — skipped.");
      }

      await tx.$executeRaw`
        INSERT INTO "_prisma_migrations" (id, checksum, migration_name, started_at, finished_at, applied_steps_count)
        VALUES (gen_random_uuid()::text, ${CHECKSUM}, ${MIGRATION_NAME}, now(), now(), 1)
      `;
      log.push(`Recorded ${MIGRATION_NAME} as applied in _prisma_migrations.`);
    });

    return apiSuccess({ alreadyApplied: false, log });
  } catch (error) {
    return handleApiError(error);
  }
}
