import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

const MIGRATION_NAME = "20260805110000_proposal_source_type_recovery";
const MIGRATION_CHECKSUM = "580a4f53fdbf78bce61000227116b4819a828bbaad3efefd7a6c874ae5946f59";

/**
 * PROPOSAL-SOURCE-TYPE-RECOVERY — owner-only, one-time, idempotent apply of
 * the additive migration adding ClientProposalSourceType (BOQ_REVISION /
 * TECHNICAL_REPORT_REVISION), nullable boqId/revisionNumber, the new
 * technicalReportId reference, and the source-consistency CHECK constraint.
 * Zero DROP statements. Follows the same break-glass pattern as the prior
 * apply-pending-migrations / apply-core-flow-1-migration /
 * apply-sales-inquiry-migration endpoints: runs inside this deployment,
 * using the real runtime DATABASE_URL neither the owner nor any local
 * process can read directly, and is idempotent by checking current state
 * before every step so a retried or partial-failure call is always safe.
 * Not wired into any UI. GET so it's reachable by pasting the URL directly.
 */
export async function GET() {
  try {
    const owner = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);

    const alreadyApplied = await prisma.$queryRaw<{ migration_name: string }[]>`
      SELECT migration_name FROM "_prisma_migrations" WHERE migration_name = ${MIGRATION_NAME}
    `;
    if (alreadyApplied.length > 0) {
      return apiSuccess({ appliedBy: owner.email, log: ["already recorded as applied, skipped."] });
    }

    const log: string[] = [];

    await prisma.$transaction(async (tx) => {
      const typeExists = await tx.$queryRaw<{ typname: string }[]>`
        SELECT typname::text FROM pg_type WHERE typname = 'ClientProposalSourceType'
      `;
      if (typeExists.length === 0) {
        await tx.$executeRawUnsafe(`CREATE TYPE "ClientProposalSourceType" AS ENUM ('BOQ_REVISION', 'TECHNICAL_REPORT_REVISION')`);
        log.push("created enum ClientProposalSourceType.");
      } else {
        log.push("enum ClientProposalSourceType already exists, skipped.");
      }

      const columns = await tx.$queryRaw<{ column_name: string; is_nullable: string }[]>`
        SELECT column_name::text, is_nullable::text FROM information_schema.columns
        WHERE table_name = 'ClientProposal' AND column_name IN ('sourceType', 'technicalReportId', 'boqId', 'revisionNumber')
      `;
      const columnByName = new Map(columns.map((c) => [c.column_name, c]));

      if (!columnByName.has("sourceType")) {
        await tx.$executeRawUnsafe(`ALTER TABLE "ClientProposal" ADD COLUMN "sourceType" "ClientProposalSourceType" NOT NULL DEFAULT 'BOQ_REVISION'`);
        log.push("added column sourceType (defaulted BOQ_REVISION for existing rows).");
      } else {
        log.push("column sourceType already exists, skipped.");
      }

      if (!columnByName.has("technicalReportId")) {
        await tx.$executeRawUnsafe(`ALTER TABLE "ClientProposal" ADD COLUMN "technicalReportId" UUID`);
        log.push("added column technicalReportId.");
      } else {
        log.push("column technicalReportId already exists, skipped.");
      }

      if (columnByName.get("boqId")?.is_nullable === "NO") {
        await tx.$executeRawUnsafe(`ALTER TABLE "ClientProposal" ALTER COLUMN "boqId" DROP NOT NULL`);
        log.push("made boqId nullable.");
      } else {
        log.push("boqId already nullable, skipped.");
      }

      if (columnByName.get("revisionNumber")?.is_nullable === "NO") {
        await tx.$executeRawUnsafe(`ALTER TABLE "ClientProposal" ALTER COLUMN "revisionNumber" DROP NOT NULL`);
        log.push("made revisionNumber nullable.");
      } else {
        log.push("revisionNumber already nullable, skipped.");
      }

      const constraints = await tx.$queryRaw<{ constraint_name: string }[]>`
        SELECT constraint_name::text FROM information_schema.table_constraints
        WHERE table_name = 'ClientProposal' AND constraint_name IN
          ('ClientProposal_technicalReportId_fkey', 'ClientProposal_source_consistency_check')
      `;
      const constraintNames = new Set(constraints.map((c) => c.constraint_name));

      if (!constraintNames.has("ClientProposal_technicalReportId_fkey")) {
        await tx.$executeRawUnsafe(
          `ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_technicalReportId_fkey" FOREIGN KEY ("technicalReportId") REFERENCES "GeneratedTechnicalReport"(id) ON UPDATE CASCADE ON DELETE CASCADE`,
        );
        log.push("added FK ClientProposal_technicalReportId_fkey.");
      } else {
        log.push("FK ClientProposal_technicalReportId_fkey already exists, skipped.");
      }

      await tx.$executeRawUnsafe(`CREATE INDEX IF NOT EXISTS "ClientProposal_technicalReportId_idx" ON "ClientProposal"("technicalReportId")`);
      log.push("ensured index ClientProposal_technicalReportId_idx.");

      if (!constraintNames.has("ClientProposal_source_consistency_check")) {
        await tx.$executeRawUnsafe(`
          ALTER TABLE "ClientProposal" ADD CONSTRAINT "ClientProposal_source_consistency_check" CHECK (
            ("sourceType" = 'BOQ_REVISION' AND "boqId" IS NOT NULL AND "revisionNumber" IS NOT NULL AND "technicalReportId" IS NULL)
            OR
            ("sourceType" = 'TECHNICAL_REPORT_REVISION' AND "technicalReportId" IS NOT NULL AND "boqId" IS NULL AND "revisionNumber" IS NULL)
          )
        `);
        log.push("added CHECK constraint ClientProposal_source_consistency_check.");
      } else {
        log.push("CHECK constraint ClientProposal_source_consistency_check already exists, skipped.");
      }

      await tx.$executeRawUnsafe(
        `INSERT INTO "_prisma_migrations" (id, checksum, finished_at, migration_name, logs, rolled_back_at, started_at, applied_steps_count)
         VALUES (gen_random_uuid()::text, $1, now(), $2, NULL, NULL, now(), 1)`,
        MIGRATION_CHECKSUM,
        MIGRATION_NAME,
      );
      log.push("recorded migration as applied.");
    });

    return apiSuccess({ appliedBy: owner.email, log });
  } catch (error) {
    return handleApiError(error);
  }
}
