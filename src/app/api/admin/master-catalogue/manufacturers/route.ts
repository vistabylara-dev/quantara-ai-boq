import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createManufacturerAsOwner, listManufacturersAdmin } from "@/lib/services/manufacturer-service";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  legalName: z.string().min(1).max(255),
  brandNames: z.array(z.string().max(100)).max(50).optional(),
  country: z.string().max(100).optional(),
  website: z.string().max(255).optional(),
  regionsServed: z.array(z.string().max(50)).max(50).optional(),
});

export async function GET(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const url = new URL(request.url);
    const result = await listManufacturersAdmin(actor, {
      search: url.searchParams.get("search") ?? undefined,
      page: url.searchParams.get("page") ? Number(url.searchParams.get("page")) : undefined,
      pageSize: url.searchParams.get("pageSize") ? Number(url.searchParams.get("pageSize")) : undefined,
    });
    return apiSuccess(result);
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    const actor = await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createManufacturerAsOwner(actor, input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
