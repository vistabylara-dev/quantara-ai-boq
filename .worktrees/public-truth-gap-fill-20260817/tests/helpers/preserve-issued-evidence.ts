import { prisma } from "../../src/lib/db/prisma";

/**
 * The test database is reset before each suite run. Once a test has issued a
 * governed BOQ revision, destructive row-by-row teardown must not bypass the
 * same database evidence locks production relies on; leave that fixture for
 * the next isolated reset instead.
 */
export async function preserveIssuedEvidenceDuringCleanup(companyIds: string[]) {
  if (companyIds.length === 0) return false;
  const issuedEvidence = await prisma.bOQRevisionItemEvidence.count({
    where: { companyId: { in: companyIds } },
  });
  return issuedEvidence > 0;
}
