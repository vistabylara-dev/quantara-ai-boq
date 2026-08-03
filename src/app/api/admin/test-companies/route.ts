import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createTestCompany, listTestCompanies } from "@/lib/services/platform-test-company-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  legalName: z.string().min(1).max(255),
  tradeName: z.string().min(1).max(255),
  companyEmail: z.string().email(),
  ownerFullName: z.string().min(1).max(255),
  ownerEmail: z.string().email(),
  ownerPassword: z.string().min(8).max(200),
});

export async function GET() {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    return apiSuccess(await listTestCompanies(actor));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createTestCompany(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
