import { ProjectFileClassification } from "@prisma/client";
import { z } from "zod";

/** Omitted `classification` means "confirm the current suggestion as-is"; a provided value means "reclassify to this type." */
export const confirmOrReclassifyBodySchema = z.object({
  classification: z.nativeEnum(ProjectFileClassification).optional(),
}).strict();
