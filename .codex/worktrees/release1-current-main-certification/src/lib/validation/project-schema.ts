import { z } from "zod";

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
});

export type projectSchemaType = z.infer<typeof projectSchema>;
