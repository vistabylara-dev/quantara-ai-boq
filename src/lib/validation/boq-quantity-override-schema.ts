import { Prisma } from "@prisma/client";
import { z } from "zod";
import { isFinitePrismaDecimal } from "@/lib/validation/prisma-decimal";

function decimalValue(options: {
  label: string;
  scale: number;
  integerDigits: number;
}) {
  return z
    .union([
      z.string().trim().min(1, `${options.label} is required.`),
      z.number().finite(),
      z.custom<Prisma.Decimal>(
        (value) => Prisma.Decimal.isDecimal(value),
        `${options.label} must be a valid decimal.`,
      ),
    ])
    .transform((value, context) => {
      let parsed: Prisma.Decimal;
      try {
        parsed = new Prisma.Decimal(value);
      } catch {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} must be a valid decimal.`,
        });
        return z.NEVER;
      }

      if (!isFinitePrismaDecimal(parsed)) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} must be finite.`,
        });
      }
      if (parsed.isNegative()) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} must be zero or greater.`,
        });
      }
      if (parsed.decimalPlaces() > options.scale) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} supports at most ${options.scale} decimal places.`,
        });
      }
      if (parsed.abs().greaterThanOrEqualTo(new Prisma.Decimal(10).pow(options.integerDigits))) {
        context.addIssue({
          code: z.ZodIssueCode.custom,
          message: `${options.label} exceeds the supported decimal range.`,
        });
      }

      return parsed;
    });
}

const boqItemQuantity = decimalValue({
  label: "Quantity",
  scale: 4,
  integerDigits: 14,
});

const calculationQuantity = decimalValue({
  label: "Expected calculation result",
  scale: 6,
  integerDigits: 12,
});

/**
 * A deliberate quantity override is an optimistic command, not a loose item
 * patch. The complete expected snapshot makes a stale browser retry fail
 * closed before any calculation, BOQ, provenance or audit row is changed.
 */
export const boqSystemQuantityOverrideInputSchema = z.object({
  quantityCalculationId: z.string().uuid("A valid quantity calculation ID is required."),
  quantity: boqItemQuantity,
  reason: z.string().trim().min(1, "A reason is required to override a system quantity.").max(2_000),
  expected: z.object({
    boqId: z.string().uuid("A valid BOQ ID is required."),
    boqVersion: z.number().int().positive(),
    boqRevisionNumber: z.number().int().positive(),
    itemQuantity: boqItemQuantity,
    itemUnit: z.string().trim().min(1).max(40),
    calculationResultValue: calculationQuantity,
  }).strict(),
}).strict();

export type BOQSystemQuantityOverrideInput = z.input<
  typeof boqSystemQuantityOverrideInputSchema
>;

export type ParsedBOQSystemQuantityOverrideInput = z.output<
  typeof boqSystemQuantityOverrideInputSchema
>;
