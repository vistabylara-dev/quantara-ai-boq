import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { reconcileGovernedPackageMembership } from "@/lib/services/catalogue-package-integrity-service";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const bodySchema = z.object({
  packageKey: z.string().min(1).max(128),
  expectedFingerprint: z.string().min(1),
  confirm: z.literal(true),
});

/**
 * CATALOGUE-PHASE7-STRICT-CLOSEOUT — owner-only. Reconciles ONE governed
 * package's explicit membership to exactly match its dataset's expected
 * item set. The server derives the expected/actual sets itself — never
 * accepts them from the client. Requires the exact integrityFingerprint
 * from a GET /package-integrity computed immediately before; a stale
 * fingerprint is rejected with 409 rather than applied blind.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const { packageKey, expectedFingerprint } = bodySchema.parse(await request.json());
    return apiSuccess(await reconcileGovernedPackageMembership(actor, packageKey, expectedFingerprint));
  } catch (error) {
    return handleApiError(error);
  }
}
