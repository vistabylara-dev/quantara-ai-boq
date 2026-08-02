import { z } from "zod";

const requiredText = (label: string, maximum = 255) =>
  z.string({ required_error: `${label} is required.` }).trim().min(1, `${label} is required.`).max(maximum);
const optionalText = (maximum = 2_000) =>
  z.union([z.string().trim().max(maximum), z.literal("")]).nullable().optional();
const currencySchema = z
  .string()
  .trim()
  .regex(/^[A-Za-z]{3}$/, "Currency must be a three-letter ISO code.")
  .transform((value) => value.toUpperCase());
const decimalInputSchema = z.union([
  z.string().trim().min(1, "A numeric value is required."),
  z.number().finite(),
]);
const nonNegativeDecimalInputSchema = decimalInputSchema.refine(
  (value) => Number(value) >= 0,
  "This value cannot be negative.",
);
const dateInputSchema = z
  .union([z.date(), z.string().min(1, "A date is required.")])
  .transform((value) => (value instanceof Date ? value : new Date(value)))
  .refine((value) => !Number.isNaN(value.getTime()), "A valid date is required.");
const uuidOrKeySchema = z.string().trim().min(1, "Industry engine is required.").max(120);

function normalizeOptionalText<T extends Record<string, unknown>>(value: T, keys: string[]) {
  const result: Record<string, unknown> = { ...value };
  for (const key of keys) {
    if (key in result && result[key] === "") result[key] = null;
  }
  return result;
}

const OPTIONAL_TEXT_KEYS = [
  "subcategory",
  "specification",
  "manufacturer",
  "brand",
  "model",
  "countryOfOrigin",
  "sourceReference",
  "supplierQuotationReference",
];

export const catalogueItemCreateSchema = z
  .object({
    industryEngineId: uuidOrKeySchema,
    supplierId: z.string().uuid("A valid supplier is required.").nullable().optional(),
    itemCode: requiredText("Item code", 100),
    category: requiredText("Category", 255),
    subcategory: optionalText(255),
    description: requiredText("Description", 2_000),
    specification: optionalText(2_000),
    unit: requiredText("Unit", 50),
    manufacturer: optionalText(255),
    brand: optionalText(255),
    model: optionalText(255),
    countryOfOrigin: optionalText(100),
    baseCost: nonNegativeDecimalInputSchema,
    freightCost: nonNegativeDecimalInputSchema.optional(),
    installationCost: nonNegativeDecimalInputSchema.optional(),
    additionalCost: nonNegativeDecimalInputSchema.optional(),
    marginMode: z.enum(["MARKUP", "GROSS_MARGIN"]).default("MARKUP"),
    defaultMargin: nonNegativeDecimalInputSchema.optional(),
    minimumSellingRate: nonNegativeDecimalInputSchema.nullable().optional(),
    currency: currencySchema.default("AED"),
    effectiveDate: dateInputSchema,
    expiryDate: dateInputSchema.nullable().optional(),
    sourceReference: optionalText(500),
    supplierQuotationReference: optionalText(255),
    metadataJson: z.record(z.unknown()).nullable().optional(),
    changeReason: optionalText(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.expiryDate && value.expiryDate.getTime() < value.effectiveDate.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "Expiry date cannot be before the effective date.",
      });
    }
  })
  .transform((value) => normalizeOptionalText(value, OPTIONAL_TEXT_KEYS));

export const catalogueItemUpdateSchema = z
  .object({
    industryEngineId: uuidOrKeySchema.optional(),
    supplierId: z.string().uuid().nullable().optional(),
    itemCode: requiredText("Item code", 100).optional(),
    category: requiredText("Category", 255).optional(),
    subcategory: optionalText(255),
    description: requiredText("Description", 2_000).optional(),
    specification: optionalText(2_000),
    unit: requiredText("Unit", 50).optional(),
    manufacturer: optionalText(255),
    brand: optionalText(255),
    model: optionalText(255),
    countryOfOrigin: optionalText(100),
    baseCost: nonNegativeDecimalInputSchema.optional(),
    freightCost: nonNegativeDecimalInputSchema.optional(),
    installationCost: nonNegativeDecimalInputSchema.optional(),
    additionalCost: nonNegativeDecimalInputSchema.optional(),
    marginMode: z.enum(["MARKUP", "GROSS_MARGIN"]).optional(),
    defaultMargin: nonNegativeDecimalInputSchema.optional(),
    minimumSellingRate: nonNegativeDecimalInputSchema.nullable().optional(),
    currency: currencySchema.optional(),
    effectiveDate: dateInputSchema.optional(),
    expiryDate: dateInputSchema.nullable().optional(),
    sourceReference: optionalText(500),
    supplierQuotationReference: optionalText(255),
    metadataJson: z.record(z.unknown()).nullable().optional(),
    changeReason: optionalText(500),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.effectiveDate && value.expiryDate && value.expiryDate.getTime() < value.effectiveDate.getTime()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expiryDate"],
        message: "Expiry date cannot be before the effective date.",
      });
    }
  })
  .transform((value) => normalizeOptionalText(value, OPTIONAL_TEXT_KEYS));

export const catalogueListQuerySchema = z
  .object({
    search: z.string().trim().max(255).optional(),
    industryEngineId: z.string().trim().max(120).optional(),
    category: z.string().trim().max(255).optional(),
    supplierId: z.string().uuid().optional(),
    status: z.enum(["ACTIVE", "PENDING", "EXPIRED", "INACTIVE"]).optional(),
    expired: z.coerce.boolean().optional(),
    page: z.coerce.number().int().min(1).default(1),
    pageSize: z.coerce.number().int().min(1).max(200).default(50),
  })
  .strict();

export const applyCatalogueRateSchema = z
  .object({
    catalogueItemId: z.string().uuid("A valid catalogue item is required."),
    boqItemId: z.string().uuid("A valid BOQ item is required."),
    applyMode: z
      .enum(["REPLACE_COMMERCIAL_FIELDS", "APPLY_COST_ONLY", "APPLY_SELLING_RATE_ONLY"])
      .default("REPLACE_COMMERCIAL_FIELDS"),
    confirmReplaceOverrides: z.boolean().default(false),
  })
  .strict();

export type CatalogueItemCreateInput = z.output<typeof catalogueItemCreateSchema>;
export type CatalogueItemUpdateInput = z.output<typeof catalogueItemUpdateSchema>;
export type CatalogueListQuery = z.output<typeof catalogueListQuerySchema>;
export type ApplyCatalogueRateInput = z.output<typeof applyCatalogueRateSchema>;
