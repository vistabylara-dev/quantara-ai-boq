import { z } from "zod";
import {
  FURNITURE_JOINERY_INDUSTRY_KEY,
  FurnitureDiscipline,
} from "@/lib/furniture/types";

export const projectSchema = z.object({
  name: z.string().min(3, "Project name is required"),
  reference: z.string().min(2, "Project reference is required"),
  clientId: z.string().uuid("Select a client for this project"),
  industryEngineId: z.string().min(1, "Industry engine selection is required"),
  location: z.string().min(2, "Location is required"),
  currency: z.string().min(1, "Currency is required"),
  taxRate: z.number().min(0, "Tax rate must be 0 or above").max(100, "Tax rate must be 100 or below"),
  language: z.string().min(2, "Language is required"),
  description: z.string().optional(),
  discipline: z.nativeEnum(FurnitureDiscipline).optional(),
}).superRefine((value, context) => {
  const isFurnitureJoinery = value.industryEngineId === FURNITURE_JOINERY_INDUSTRY_KEY;
  if (isFurnitureJoinery && !value.discipline) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discipline"],
      message: "Select Furniture or Joinery & Cabinetry",
    });
  }
  if (!isFurnitureJoinery && value.discipline) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["discipline"],
      message: "Furniture disciplines are available only for the Furniture, Joinery & Cabinetry industry",
    });
  }
});

export type projectSchemaType = z.infer<typeof projectSchema>;
