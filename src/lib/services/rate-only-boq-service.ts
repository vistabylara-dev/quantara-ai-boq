import { MarginMode, Prisma, RateProvenanceSource } from "@prisma/client";
import { z } from "zod";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { prisma } from "@/lib/db/prisma";
import { ConflictError } from "@/lib/errors/app-error";
import {
  getBOQItemRecord,
  updateBOQItem,
} from "@/lib/repositories/boq-repository";
import { isFinitePrismaDecimal } from "@/lib/validation/prisma-decimal";

const unitRateValueSchema = z
  .union([
    z.string().trim().min(1, "Unit rate is required."),
    z.number().finite(),
    z.custom<Prisma.Decimal>(
      (value) => Prisma.Decimal.isDecimal(value),
      "Unit rate must be a valid decimal.",
    ),
  ])
  .transform((value, context) => {
    let unitRate: Prisma.Decimal;
    try {
      unitRate = new Prisma.Decimal(value);
    } catch {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit rate must be a valid decimal.",
      });
      return z.NEVER;
    }

    if (!isFinitePrismaDecimal(unitRate)) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit rate must be finite.",
      });
    }
    if (unitRate.isNegative()) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit rate must be zero or greater.",
      });
    }
    if (unitRate.decimalPlaces() > 4) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit rate supports at most 4 decimal places.",
      });
    }
    if (unitRate.abs().greaterThanOrEqualTo(new Prisma.Decimal(10).pow(14))) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Unit rate exceeds Decimal(18, 4) range.",
      });
    }

    return unitRate;
  });

/**
 * Deliberately strict: no quantity, unit, description, cost-component or
 * margin field can cross the rate-only API boundary.
 */
export const rateOnlyUnitRateInputSchema = z.object({
  unitRate: unitRateValueSchema,
}).strict();

export type RateOnlyUnitRateInput = z.input<typeof rateOnlyUnitRateInputSchema>;

/**
 * Applies the user's final unit rate without exposing the advanced
 * cost-plus-margin model. Internally the entered rate becomes the sole landed
 * cost with zero additions and zero markup, so the existing BOQ calculator
 * derives sellingRate === unitRate and totalAmount === quantity * unitRate.
 */
export async function updateRateOnlyBOQItemUnitRate(
  actor: CurrentActor,
  itemId: string,
  rawInput: RateOnlyUnitRateInput,
) {
  requireCapability(actor, "boq:edit");
  const { unitRate } = rateOnlyUnitRateInputSchema.parse(rawInput);

  const current = await getBOQItemRecord(actor.companyId, itemId);
  const latestRevision = await prisma.bOQ.findFirst({
    where: {
      companyId: actor.companyId,
      projectId: current.section.boq.projectId,
    },
    orderBy: { revisionNumber: "desc" },
    select: { id: true, revisionNumber: true },
  });

  if (!latestRevision || latestRevision.id !== current.section.boqId) {
    throw new ConflictError(
      "BOQ_REVISION_HISTORICAL",
      "Rates can only be changed on the latest editable BOQ revision.",
    );
  }

  return updateBOQItem(
    actor.companyId,
    itemId,
    {
      unitCost: unitRate,
      freightCost: 0,
      installationCost: 0,
      additionalCost: 0,
      marginMode: MarginMode.MARKUP,
      marginPercentage: 0,
    },
    {
      integrityActor: { userId: actor.userId, name: actor.fullName },
      // Supplying provenance explicitly is intentional even when the entered
      // rate is unchanged (including zero): confirmation is a user action, not
      // merely a side effect of a numeric delta.
      rateProvenance: {
        sourceType: RateProvenanceSource.MANUAL_CONFIRMED,
      },
      additionalAudit: {
        action: "UNIT_RATE_CONFIRMED",
        payload: {
          boqId: current.section.boqId,
          revisionNumber: current.section.boq.revisionNumber,
          itemCode: current.itemCode,
          previousSellingRate: current.sellingRate.toString(),
          unitRate: unitRate.toString(),
          confirmedByUserId: actor.userId,
          confirmedByName: actor.fullName,
        },
      },
    },
  );
}
