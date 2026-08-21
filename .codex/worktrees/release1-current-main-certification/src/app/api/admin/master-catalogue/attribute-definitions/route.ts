import { PlatformRole } from "@prisma/client";
import { z } from "zod";
import { requirePlatformActor } from "@/lib/auth/platform-authorization";
import { apiSuccess, handleApiError } from "@/lib/http/api-response";
import { createTechnicalFieldDefinition, listTechnicalFieldDefinitions } from "@/lib/repositories/master-taxonomy-repository";

export const dynamic = "force-dynamic";

const createSchema = z.object({
  disciplineId: z.string().uuid(),
  categoryId: z.string().uuid().nullable().optional(),
  key: z.string().min(1).max(100),
  label: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  fieldType: z.enum(["TEXT", "NUMBER", "DECIMAL", "BOOLEAN", "SELECT", "MULTI_SELECT", "DATE", "DIMENSION", "RANGE", "JSON"]),
  unit: z.string().max(50).optional(),
  unitFamily: z.string().max(50).optional(),
  allowedUnitsJson: z.array(z.string()).optional(),
  optionsJson: z.array(z.string()).optional(),
  validationJson: z.record(z.unknown()).optional(),
  isRequired: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  applicableHierarchyNodeId: z.string().uuid().nullable().optional(),
  sortOrder: z.number().int().optional(),
});

export async function GET(request: Request) {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const url = new URL(request.url);
    const disciplineId = url.searchParams.get("disciplineId");
    if (!disciplineId) return apiSuccess([]);
    const categoryId = url.searchParams.get("categoryId");
    return apiSuccess(await listTechnicalFieldDefinitions(disciplineId, categoryId ?? undefined));
  } catch (error) {
    return handleApiError(error);
  }
}

export async function POST(request: Request) {
  try {
    await requirePlatformActor([PlatformRole.PLATFORM_OWNER]);
    const input = createSchema.parse(await request.json());
    return apiSuccess(await createTechnicalFieldDefinition(input), 201);
  } catch (error) {
    return handleApiError(error);
  }
}
