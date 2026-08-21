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

const blankToNull = (value: string | null | undefined) => (value ? value : null);

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
  .transform((value) => ({
    name: value.name,
    legalName: blankToNull(value.legalName),
    email: blankToNull(value.email),
    phone: blankToNull(value.phone),
    website: blankToNull(value.website),
    address: blankToNull(value.address),
    contactPerson: blankToNull(value.contactPerson),
    taxRegistrationNumber: blankToNull(value.taxRegistrationNumber),
    defaultCurrency: value.defaultCurrency,
    paymentTerms: blankToNull(value.paymentTerms),
    leadTimeDays: value.leadTimeDays ?? null,
    notes: blankToNull(value.notes),
  }));

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
  .transform((value) => {
    const result: Record<string, unknown> = {};
    if (value.name !== undefined) result.name = value.name;
    if (value.legalName !== undefined) result.legalName = blankToNull(value.legalName);
    if (value.email !== undefined) result.email = blankToNull(value.email);
    if (value.phone !== undefined) result.phone = blankToNull(value.phone);
    if (value.website !== undefined) result.website = blankToNull(value.website);
    if (value.address !== undefined) result.address = blankToNull(value.address);
    if (value.contactPerson !== undefined) result.contactPerson = blankToNull(value.contactPerson);
    if (value.taxRegistrationNumber !== undefined) result.taxRegistrationNumber = blankToNull(value.taxRegistrationNumber);
    if (value.defaultCurrency !== undefined) result.defaultCurrency = value.defaultCurrency;
    if (value.paymentTerms !== undefined) result.paymentTerms = blankToNull(value.paymentTerms);
    if (value.leadTimeDays !== undefined) result.leadTimeDays = value.leadTimeDays;
    if (value.notes !== undefined) result.notes = blankToNull(value.notes);
    return result;
  });

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
