import { PlatformRole } from "@prisma/client";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { prisma } from "@/lib/db/prisma";

export const dynamic = "force-dynamic";

/**
 * Owner-only, cross-company, safe operational inspection — never returns
 * encryptedCredentialsRef, and there is no token/secret field on this model
 * to leak in the first place (spec: "no secret-token viewer, no arbitrary
 * impersonation").
 */
export async function GET() {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const rows = await prisma.externalConnection.findMany({
      orderBy: { connectedAt: "desc" },
      take: 100,
      select: {
        id: true,
        companyId: true,
        providerId: true,
        providerAccountId: true,
        status: true,
        connectedAt: true,
        lastSyncAt: true,
        disconnectedAt: true,
        lastErrorMessage: true,
        grantedScopesJson: true,
        company: { select: { legalName: true, tradeName: true, isTestCompany: true } },
      },
    });

    return apiSuccess(
      rows.map((row) => ({
        id: row.id,
        companyId: row.companyId,
        companyName: row.company.tradeName || row.company.legalName,
        isTestCompany: row.company.isTestCompany,
        providerId: row.providerId,
        providerAccountId: row.providerAccountId,
        status: row.status,
        connectedAt: row.connectedAt.toISOString(),
        lastSyncAt: row.lastSyncAt?.toISOString() ?? null,
        disconnectedAt: row.disconnectedAt?.toISOString() ?? null,
        lastErrorMessage: row.lastErrorMessage,
        isTestConnection: Boolean((row.grantedScopesJson as { test?: boolean } | null)?.test),
      })),
    );
  } catch (error) {
    return handleApiError(error);
  }
}
