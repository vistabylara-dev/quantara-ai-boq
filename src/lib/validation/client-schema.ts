import { z } from "zod";

const requiredText = (label: string, maximum = 255) =>
  z.string({ required_error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(maximum);
const optionalText = (maximum = 2_000) =>
  z.union([z.string().trim().max(maximum), z.literal("")]).nullable().optional();

export const clientCreateSchema = z
  .object({
    name: optionalText(255),
    companyName: requiredText("Company name"),
    email: z
      .string({ required_error: "Client email is required." })
      .trim()
      .min(1, "Client email is required.")
      .email("A valid client email is required.")
      .max(320),
    phone: requiredText("Phone", 50),
    address: optionalText(1_000),
    taxRegistrationNumber: optionalText(100),
    notes: optionalText(5_000),
  })
  .strict()
  .transform((value) => ({
    name: value.name || value.companyName,
    companyName: value.companyName,
    email: value.email,
    phone: value.phone,
    address: value.address || null,
    taxRegistrationNumber: value.taxRegistrationNumber || null,
    notes: value.notes || null,
  }));

export const clientUpdateSchema = z
  .object({
    name: optionalText(255),
    companyName: requiredText("Company name").optional(),
    email: z
      .string()
      .trim()
      .min(1, "Client email is required.")
      .email("A valid client email is required.")
      .max(320)
      .optional(),
    phone: requiredText("Phone", 50).optional(),
    address: optionalText(1_000),
    taxRegistrationNumber: optionalText(100),
    notes: optionalText(5_000),
  })
  .strict()
  .transform((value) => {
    const result: Record<string, string | null> = {};

    if (value.name !== undefined) {
      const resolvedName = value.name || value.companyName;
      if (resolvedName) result.name = resolvedName;
    }

    if (value.companyName !== undefined) result.companyName = value.companyName;
    if (value.email !== undefined) result.email = value.email;
    if (value.phone !== undefined) result.phone = value.phone;
    if (value.address !== undefined) result.address = value.address || null;
    if (value.taxRegistrationNumber !== undefined) result.taxRegistrationNumber = value.taxRegistrationNumber || null;
    if (value.notes !== undefined) result.notes = value.notes || null;

    return result;
  });

export const clientListQuerySchema = z
  .object({
    search: z.string().trim().max(255).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    includeArchived: z.coerce.boolean().default(false),
  })
  .strict();

export type ClientCreateInput = z.output<typeof clientCreateSchema>;
export type ClientUpdateInput = z.output<typeof clientUpdateSchema>;
export type ClientListQuery = z.output<typeof clientListQuerySchema>;
