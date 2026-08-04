import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createCertificationAsOwner } from "@/lib/services/manufacturer-service";

export const dynamic = "force-dynamic";

const createSchema = z
  .object({
    productModelId: z.string().uuid().optional(),
    masterItemId: z.string().uuid().optional(),
    certificationType: z.string().min(1).max(100),
    authority: z.string().min(1).max(255),
    certificateNumber: z.string().max(100).optional(),
    region: z.enum(["UAE", "GCC", "INTERNATIONAL", "COUNTRY_SPECIFIC"]).optional(),
    issueDate: z.string().datetime().optional(),
    expiryDate: z.string().datetime().optional(),
    sourceDocumentReference: z.string().min(1).max(500),
  })
  .refine((data) => data.productModelId || data.masterItemId, { message: "Either productModelId or masterItemId is required." });

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createCertificationAsOwner(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
