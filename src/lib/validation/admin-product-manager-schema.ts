import { z } from "zod";

export const adminProductManagerCreateSchema = z
  .object({
    code: z.string().trim().min(2).max(80).regex(/^[a-z0-9]+(?:_[a-z0-9]+)*$/),
    name: z.string().trim().min(2).max(140),
    category: z.string().trim().min(2).max(120),
    shortDescription: z.string().trim().min(2).max(300),
    description: z.string().trim().min(2).max(5000),
    priceAed: z.number().finite().positive().max(100_000_000),
    billingInterval: z.enum(["ONE_TIME", "MONTH", "YEAR"]),
    purchaseMode: z.enum(["DIRECT", "QUOTATION_REQUIRED", "CONTACT_SALES"]).default("DIRECT"),
    marketplaceEnabled: z.boolean().default(true),

    fulfillmentMode: z
      .enum(["LISTING_ONLY", "SOFTWARE_SUBSCRIPTION"])
      .default("LISTING_ONLY"),
    softwarePlanType: z.enum(["PRO", "BUSINESS", "ENTERPRISE"]).default("PRO"),
    maxUsers: z.number().int().positive().nullable().default(null),
    maxProjects: z.number().int().positive().nullable().default(null),
    maxActiveBoqs: z.number().int().positive().nullable().default(null),
    maxDocumentsPerMonth: z.number().int().positive().nullable().default(null),

    slug: z.string().trim().min(2).max(120).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
    metaTitle: z.string().trim().min(2).max(70),
    metaDescription: z.string().trim().min(2).max(320),

    merchantEnabled: z.boolean().default(false),
    merchantTitle: z.string().trim().max(150).default(""),
    merchantDescription: z.string().trim().max(5000).default(""),
    googleProductCategory: z.string().trim().max(255).default(""),
    googleProductType: z.string().trim().max(750).default(""),
    brand: z.string().trim().max(70).default("Quantara"),
    mpn: z.string().trim().max(70).default(""),
    gtin: z.string().trim().max(14).refine(
      (v) => v === "" || /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(v),
      { message: "GTIN must contain 8, 12, 13, or 14 digits." },
    ).default(""),
    imageUrl: z.string().trim().max(2000).default(""),
    availability: z.enum(["in_stock", "out_of_stock", "preorder"]).default("in_stock"),
    condition: z.enum(["new", "refurbished", "used"]).default("new"),
  })
  .strict()
  .superRefine((value, context) => {
    if (value.fulfillmentMode === "SOFTWARE_SUBSCRIPTION") {
      if (value.purchaseMode !== "DIRECT") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["purchaseMode"],
          message: "Software subscription fulfilment requires Direct checkout.",
        });
      }

      if (value.billingInterval === "ONE_TIME") {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["billingInterval"],
          message: "Software subscription fulfilment requires monthly or yearly billing.",
        });
      }
    }

    if (!value.merchantEnabled) return;

    if (!value.merchantTitle) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["merchantTitle"],
        message: "Merchant title is required when Merchant is enabled.",
      });
    }

    if (!value.merchantDescription) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["merchantDescription"],
        message: "Merchant description is required when Merchant is enabled.",
      });
    }

    if (value.billingInterval === "MONTH" && value.purchaseMode === "DIRECT") {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["merchantEnabled"],
        message: "Monthly direct subscriptions are not automatically Merchant-ready.",
      });
    }
  });

export type AdminProductManagerCreateInput = z.output<
  typeof adminProductManagerCreateSchema
>;
