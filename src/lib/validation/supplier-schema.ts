import { z } from "zod";

const requiredText = (label: string, maximum = 255) =>
  z.string({ required_error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(maximum);
const optionalText = (maximum = 2_000) =>
  z.union([z.string().trim().max(maximum), z.literal("")]).nullable().optional();
const optionalEmail = z
  .union([z.string().trim().email("A valid email is required.").max(320), z.literal("")])
  .nullable()
  .optional();
const optionalUrl = z
  .union([z.string().trim().url("A valid website URL is required.").max(2_048), z.literal("")])
  .nullable()
  .optional();
const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Currency must be a three-letter ISO code.")
  .transform((value) => value.toUpperCase());

function normalize<T extends { [key: string]: unknown }>(value: T) {
  const result: Record<string, unknown> = { ...value };
  for (const key of ["legalName", "email", "phone", "website", "address", "contactPerson", "taxRegistrationNumber", "paymentTerms", "notes"]) {
    if (key in result && result[key] === "") result[key] = null;
  }
  return result;
}

export const supplierCreateSchema = z
  .object({
    name: requiredText("Supplier name"),
    legalName: optionalText(255),
    email: optionalEmail,
    phone: optionalText(50),
    website: optionalUrl,
    address: optionalText(1_000),
    contactPerson: optionalText(255),
    taxRegistrationNumber: optionalText(100),
    defaultCurrency: currencySchema.default("AED"),
    paymentTerms: optionalText(255),
    leadTimeDays: z.coerce.number().int("Lead time must be a whole number of days.").min(0, "Lead time cannot be negative.").nullable().optional(),
    notes: optionalText(5_000),
  })
  .strict()
  .transform(normalize);

export const supplierUpdateSchema = z
  .object({
    name: requiredText("Supplier name").optional(),
    legalName: optionalText(255),
    email: optionalEmail,
    phone: optionalText(50),
    website: optionalUrl,
    address: optionalText(1_000),
    contactPerson: optionalText(255),
    taxRegistrationNumber: optionalText(100),
    defaultCurrency: currencySchema.optional(),
    paymentTerms: optionalText(255),
    leadTimeDays: z.coerce.number().int().min(0).nullable().optional(),
    notes: optionalText(5_000),
  })
  .strict()
  .transform(normalize);

export const supplierListQuerySchema = z
  .object({
    search: z.string().trim().max(255).optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(100).default(25),
    includeInactive: z.coerce.boolean().default(false),
  })
  .strict();

export type SupplierCreateInput = z.output<typeof supplierCreateSchema>;
export type SupplierUpdateInput = z.output<typeof supplierUpdateSchema>;
export type SupplierListQuery = z.output<typeof supplierListQuerySchema>;
