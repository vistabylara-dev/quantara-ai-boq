import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createTestConnection } from "@/lib/services/integration-connection-service";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  providerId: z.string().min(1).max(100),
  providerAccountId: z.string().max(255).optional(),
});

/**
 * Owner-only. Creates a real ExternalConnection row clearly marked as a
 * test fixture (grantedScopesJson.test = true) — not a live OAuth grant for
 * any provider. Lets the owner exercise the full connect -> link -> history
 * -> disconnect lifecycle against real data before any live connector
 * exists, satisfying "PLATFORM_OWNER: full integration testing access" from
 * the INTEGRATIONS-1A spec without simulating a fake customer-facing
 * connection.
 */
export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = bodySchema.parse(await request.json());
    return apiSuccess(await createTestConnection(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
