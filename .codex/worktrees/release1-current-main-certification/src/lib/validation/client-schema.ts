import { z } from "zod";

const requiredText = (label: string, maximum = 255) =>
  z.string({ required_error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(maximum);
const optionalText = (maximum = 2_000) =>
  z.union([z.string().trim().max(maximum), z.literal("")]).nullable().optional();

export const clientCreateSchema = z
  .object({
    name: requiredText("Client name"),
    companyName: optionalText(255),
    email: z
      .union([z.string().trim().email("A valid client email is required.").max(320), z.literal("")])
      .nullable()
      .optional(),
    phone: optionalText(50),
    address: optionalText(1_000),
    taxRegistrationNumber: optionalText(100),
    notes: optionalText(5_000),
  })
  .strict()
  .transform((value) => ({
    name: value.name,
    companyName: value.companyName || null,
    email: value.email || null,
    phone: value.phone || null,
    address: value.address || null,
    taxRegistrationNumber: value.taxRegistrationNumber || null,
    notes: value.notes || null,
  }));

export const clientUpdateSchema = z
  .object({
    name: requiredText("Client name").optional(),
    companyName: optionalText(255),
    email: z
      .union([z.string().trim().email("A valid client email is required.").max(320), z.literal("")])
      .nullable()
      .optional(),
    phone: optionalText(50),
    address: optionalText(1_000),
    taxRegistrationNumber: optionalText(100),
    notes: optionalText(5_000),
  })
  .strict()
  .transform((value) => {
    const result: Record<string, string | null> = {};
    if (value.name !== undefined) result.name = value.name;
    if (value.companyName !== undefined) result.companyName = value.companyName || null;
    if (value.email !== undefined) result.email = value.email || null;
    if (value.phone !== undefined) result.phone = value.phone || null;
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
