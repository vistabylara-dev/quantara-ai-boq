import type { Prisma, QuantityCalculation, QuantityCalculationType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { NotFoundError } from "@/lib/errors/app-error";

/**
 * Guided BOQ measurement workflow (Release 1) — QuantityCalculation already
 * existed in the Prisma schema ("Phase 8 sections 22-24 — deterministic
 * quantity calculation from a confirmed extracted entity. Formulas are
 * always visible; no confidence threshold may auto-lock or auto-issue a
 * BOQ.") but had no repository or service code at all. This is the first
 * code to touch it — no migration needed, every field already exists.
 */

export function toQuantityCalculationDTO(row: QuantityCalculation) {
  return {
    id: row.id,
    projectId: row.projectId,
    extractedEntityId: row.extractedEntityId,
    calculationType: row.calculationType,
    inputValues: row.inputValuesJson as Record<string, number>,
    deductions: (row.deductionsJson as Record<string, number> | null) ?? null,
    allowances: (row.allowancesJson as Record<string, number> | null) ?? null,
    formula: row.formula,
    resultValue: row.resultValue.toNumber(),
    resultUnit: row.resultUnit,
    confidence: row.confidence.toNumber(),
    status: row.status,
    manuallyOverridden: row.manuallyOverridden,
    originalResultValue: row.originalResultValue?.toNumber() ?? null,
    overrideReason: row.overrideReason,
    calculatedBy: row.calculatedBy,
    calculatedAt: row.calculatedAt.toISOString(),
    confirmedByUserId: row.confirmedByUserId,
    confirmedAt: row.confirmedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateQuantityCalculationInput = {
  projectId: string;
  extractedEntityId?: string | null;
  calculationType: QuantityCalculationType;
  inputValues: Record<string, number>;
  deductions?: Record<string, number> | null;
  allowances?: Record<string, number> | null;
  formula: string;
  resultValue: number;
  resultUnit: string;
  /** The confidence of the underlying evidence used to derive the inputs — never invented, defaults to 100 only for a fully manual, professional-entered calculation. */
  confidence: number;
};

export async function createQuantityCalculation(companyId: string, input: CreateQuantityCalculationInput): Promise<QuantityCalculation> {
  return prisma.quantityCalculation.create({
    data: {
      companyId,
      projectId: input.projectId,
      extractedEntityId: input.extractedEntityId ?? null,
      calculationType: input.calculationType,
      inputValuesJson: input.inputValues,
      deductionsJson: input.deductions ?? undefined,
      allowancesJson: input.allowances ?? undefined,
      formula: input.formula,
      resultValue: input.resultValue,
      resultUnit: input.resultUnit,
      confidence: input.confidence,
      calculatedBy: "deterministic-formula",
    },
  });
}

export async function getQuantityCalculationRecord(companyId: string, calculationId: string): Promise<QuantityCalculation> {
  const row = await prisma.quantityCalculation.findFirst({ where: { id: calculationId, companyId } });
  if (!row) throw new NotFoundError("Quantity calculation not found.");
  return row;
}

export async function listQuantityCalculationsForProject(companyId: string, projectId: string): Promise<QuantityCalculation[]> {
  return prisma.quantityCalculation.findMany({ where: { companyId, projectId }, orderBy: { createdAt: "desc" } });
}

export async function listQuantityCalculationsForEntity(companyId: string, extractedEntityId: string): Promise<QuantityCalculation[]> {
  return prisma.quantityCalculation.findMany({ where: { companyId, extractedEntityId }, orderBy: { createdAt: "desc" } });
}

export async function confirmQuantityCalculation(companyId: string, calculationId: string, confirmedByUserId: string): Promise<QuantityCalculation> {
  const current = await getQuantityCalculationRecord(companyId, calculationId);
  return prisma.quantityCalculation.update({
    where: { id: current.id },
    data: { status: "CONFIRMED", confirmedByUserId, confirmedAt: new Date() },
  });
}

export async function rejectQuantityCalculation(companyId: string, calculationId: string): Promise<QuantityCalculation> {
  const current = await getQuantityCalculationRecord(companyId, calculationId);
  return prisma.quantityCalculation.update({
    where: { id: current.id },
    data: { status: "REJECTED" },
  });
}

/**
 * Preserves the ORIGINAL deterministic result forever, even across repeated
 * overrides — originalResultValue is only ever set the first time a
 * calculation transitions from formula-derived to professional-overridden,
 * never overwritten by a later override.
 */
export async function overrideQuantityCalculationResult(
  companyId: string,
  calculationId: string,
  newResultValue: number,
  reason: string,
): Promise<QuantityCalculation> {
  const current = await getQuantityCalculationRecord(companyId, calculationId);
  const originalResultValue = current.manuallyOverridden ? current.originalResultValue : current.resultValue;
  return prisma.quantityCalculation.update({
    where: { id: current.id },
    data: {
      resultValue: newResultValue,
      manuallyOverridden: true,
      originalResultValue: originalResultValue ?? current.resultValue,
      overrideReason: reason,
    },
  });
}

export type DbClient = typeof prisma | Prisma.TransactionClient;
