import { BOQStatus, Prisma, RateStatus, VerificationSeverity } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { getBOQRecord, toBOQDTO } from "@/lib/repositories/boq-repository";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  DEFAULT_VERIFICATION_CONFIG,
  runVerification,
  type VerificationConfig,
} from "@/lib/verification/run-verification";

function getVerificationConfig(configJson: Prisma.JsonValue): VerificationConfig {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) {
    return DEFAULT_VERIFICATION_CONFIG;
  }
  const root = configJson as Record<string, unknown>;
  const source = root.verification && typeof root.verification === "object" && !Array.isArray(root.verification)
    ? root.verification as Record<string, unknown>
    : root;
  return {
    minimumMarginPercentage:
      typeof source.minimumMarginPercentage === "number" || typeof source.minimumMarginPercentage === "string"
        ? source.minimumMarginPercentage
        : DEFAULT_VERIFICATION_CONFIG.minimumMarginPercentage,
    confidenceThreshold:
      typeof source.confidenceThreshold === "number" || typeof source.confidenceThreshold === "string"
        ? source.confidenceThreshold
        : DEFAULT_VERIFICATION_CONFIG.confidenceThreshold,
    unusuallyHighQuantityThreshold:
      typeof source.unusuallyHighQuantityThreshold === "number" || typeof source.unusuallyHighQuantityThreshold === "string"
        ? source.unusuallyHighQuantityThreshold
        : DEFAULT_VERIFICATION_CONFIG.unusuallyHighQuantityThreshold,
  };
}

function exceptionKey(type: string, boqItemId: string | null, currentValue: string | null) {
  return `${type}:${boqItemId ?? "boq"}:${currentValue ?? ""}`;
}

function verificationPayload(boq: Awaited<ReturnType<typeof getBOQRecord>>) {
  const exceptions = boq.verificationExceptions.map((exception) => ({
    id: exception.id,
    boqItemId: exception.boqItemId,
    type: exception.type,
    severity: exception.severity.toLowerCase(),
    message: exception.message,
    sourceReference: exception.boqItem?.sourceReference ?? null,
    currentValue: exception.currentValue,
    suggestedValue: exception.suggestedValue,
    resolutionNote: exception.resolutionNote,
    resolved: exception.resolved,
    resolvedAt: exception.resolvedAt?.toISOString() ?? null,
    affectedItem: exception.boqItem
      ? {
          itemNumber: exception.boqItem.itemNumber,
          itemCode: exception.boqItem.itemCode,
          description: exception.boqItem.description,
        }
      : undefined,
  }));
  const unresolvedCritical = boq.verificationExceptions.filter(
    (exception) => !exception.resolved && exception.severity === VerificationSeverity.CRITICAL,
  ).length;
  const unresolvedWarning = boq.verificationExceptions.filter(
    (exception) => !exception.resolved && exception.severity === VerificationSeverity.WARNING,
  ).length;
  const resolved = boq.verificationExceptions.filter((exception) => exception.resolved).length;
  const freshlyVerified = boq.verifiedAt !== null && boq.verifiedVersion === boq.version;
  const lockBlocked = unresolvedCritical > 0 || !freshlyVerified;
  const lockReason = boq.isLocked
    ? "BOQ_LOCKED"
    : unresolvedCritical > 0
      ? "UNRESOLVED_CRITICAL_EXCEPTIONS"
      : !freshlyVerified
        ? "VERIFICATION_REQUIRED"
        : null;

  return {
    boq: toBOQDTO(boq),
    exceptions,
    summary: {
      unresolvedCritical,
      unresolvedWarning,
      resolved,
      lockBlocked,
      lockEligible: !lockBlocked && !boq.isLocked,
      freshlyVerified,
      isLocked: boq.isLocked,
      lockReason,
    },
  };
}

export async function getBOQVerification(companyId: string, boqId: string) {
  return verificationPayload(await getBOQRecord(companyId, boqId));
}

export async function runBOQVerification(companyId: string, boqId: string, asOf = new Date()) {
  const boq = await getBOQRecord(companyId, boqId);
  if (boq.isLocked) {
    throw new ConflictError(
      "BOQ_LOCKED",
      "Locked BOQ revisions are immutable. Create a new revision before running verification again.",
    );
  }
  const items = boq.sections.flatMap((section) => section.items);
  const itemCodes = [...new Set(items.map((item) => item.itemCode).filter(Boolean))];
  const catalogueRates = itemCodes.length
    ? await prisma.rateCatalogueItem.findMany({
        where: {
          companyId,
          industryEngineId: boq.project.industryEngineId,
          itemCode: { in: itemCodes },
          effectiveDate: { lte: asOf },
          status: { not: RateStatus.INACTIVE },
        },
        orderBy: { effectiveDate: "desc" },
      })
    : [];
  const latestRateByCode = new Map<string, (typeof catalogueRates)[number]>();
  for (const rate of catalogueRates) {
    if (!latestRateByCode.has(rate.itemCode)) latestRateByCode.set(rate.itemCode, rate);
  }

  const drafts = runVerification({
    boqId: boq.id,
    asOf,
    config: getVerificationConfig(boq.project.industryEngine.configJson),
    boqIsLocked: boq.isLocked,
    hasPendingChanges: false,
    items: items.map((item) => {
      const rate = latestRateByCode.get(item.itemCode);
      return {
        id: item.id,
        itemCode: item.itemCode,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        freightCost: item.freightCost,
        installationCost: item.installationCost,
        additionalCost: item.additionalCost,
        landedCost: item.landedCost,
        sellingRate: item.sellingRate,
        marginPercentage: item.marginPercentage,
        confidenceScore: item.confidenceScore,
        drawingReference: item.drawingReference,
        supplierRateExpiryDate:
          rate?.status === RateStatus.EXPIRED ? new Date(0) : rate?.expiryDate,
        status: item.status,
      };
    }),
  });
  const itemUpdatedAtById = new Map(items.map((item) => [item.id, item.updatedAt]));

  await prisma.$transaction(async (tx) => {
    const claimed = await tx.bOQ.updateMany({
      where: {
        id: boq.id,
        companyId,
        isLocked: false,
        version: boq.version,
      },
      data: {
        verifiedVersion: boq.version,
        verifiedAt: asOf,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictError(
        "BOQ_CHANGED_DURING_VERIFICATION",
        "The BOQ changed during verification. Reload and run verification again.",
      );
    }
    const resolved = await tx.verificationException.findMany({
      where: { companyId, boqId: boq.id, resolved: true },
      select: {
        id: true,
        type: true,
        boqItemId: true,
        currentValue: true,
        resolvedAt: true,
      },
    });
    const draftKeys = new Set(drafts.map((entry) => exceptionKey(entry.type, entry.boqItemId, entry.currentValue)));
    const staleResolvedIds = resolved
      .filter((entry) => {
        const keyNoLongerExists = !draftKeys.has(exceptionKey(entry.type, entry.boqItemId, entry.currentValue));
        if (keyNoLongerExists || !entry.resolvedAt) return true;

        const sourceUpdatedAt = entry.boqItemId
          ? itemUpdatedAtById.get(entry.boqItemId)
          : boq.updatedAt;
        return sourceUpdatedAt ? sourceUpdatedAt > entry.resolvedAt : true;
      })
      .map((entry) => entry.id);
    if (staleResolvedIds.length) {
      await tx.verificationException.deleteMany({
        where: { companyId, id: { in: staleResolvedIds } },
      });
    }
    const resolvedKeys = new Set(
      resolved
        .filter((entry) => !staleResolvedIds.includes(entry.id))
        .map((entry) => exceptionKey(entry.type, entry.boqItemId, entry.currentValue)),
    );
    await tx.verificationException.deleteMany({
      where: { companyId, boqId: boq.id, resolved: false },
    });
    const currentDrafts = drafts.filter(
      (draft) => !resolvedKeys.has(exceptionKey(draft.type, draft.boqItemId, draft.currentValue)),
    );
    if (currentDrafts.length) {
      await tx.verificationException.createMany({
        data: currentDrafts.map((draft) => ({
          companyId,
          boqId: boq.id,
          boqItemId: draft.boqItemId,
          type: draft.type,
          severity: draft.severity,
          message: draft.message,
          currentValue: draft.currentValue,
          suggestedValue: draft.suggestedValue,
          resolved: false,
        })),
      });
    }
    const statusUpdated = await tx.bOQ.updateMany({
      where: {
        id: boq.id,
        companyId,
        isLocked: false,
        version: boq.version,
        verifiedVersion: boq.version,
      },
      data: {
        status: currentDrafts.length ? BOQStatus.NEEDS_VERIFICATION : BOQStatus.CALCULATED,
      },
    });
    if (statusUpdated.count !== 1) {
      throw new ConflictError(
        "BOQ_CHANGED_DURING_VERIFICATION",
        "The BOQ changed during verification. Reload and run verification again.",
      );
    }
    await createAuditLog(companyId, {
      entityType: "BOQ",
      entityId: boq.id,
      action: "VERIFICATION_RUN",
      payload: {
        generatedCount: currentDrafts.length,
        verifiedVersion: boq.version,
        asOf: asOf.toISOString(),
      },
    }, tx);
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return getBOQVerification(companyId, boq.id);
}

export async function resolveVerificationException(
  companyId: string,
  exceptionId: string,
  resolutionNote: string,
  actorName = "Development User",
) {
  return prisma.$transaction(async (tx) => {
    const exception = await tx.verificationException.findFirst({
      where: { id: exceptionId, companyId },
    });
    if (!exception) throw new NotFoundError("Verification exception not found.");
    if (exception.resolved) return exception;

    const editableParent = await tx.$queryRaw<Array<{ id: string }>>(Prisma.sql`
      SELECT "id"
      FROM "BOQ"
      WHERE "id" = CAST(${exception.boqId} AS uuid)
        AND "companyId" = CAST(${companyId} AS uuid)
        AND "isLocked" = false
      FOR UPDATE
    `);
    if (editableParent.length !== 1) {
      throw new ConflictError(
        "BOQ_LOCKED",
        "Verification exceptions on a locked revision cannot be changed.",
      );
    }

    const resolvedAt = new Date();
    const claimed = await tx.verificationException.updateMany({
      where: { id: exception.id, companyId, resolved: false },
      data: { resolved: true, resolvedAt, resolutionNote },
    });
    if (claimed.count !== 1) {
      const alreadyResolved = await tx.verificationException.findFirst({
        where: { id: exception.id, companyId },
      });
      if (!alreadyResolved) throw new NotFoundError("Verification exception not found.");
      return alreadyResolved;
    }
    const result = await tx.verificationException.findFirst({
      where: { id: exception.id, companyId },
    });
    if (!result) throw new NotFoundError("Verification exception not found.");
    await createAuditLog(companyId, {
      entityType: "VerificationException",
      entityId: result.id,
      action: "EXCEPTION_RESOLVED",
      actorName,
      payload: { boqId: result.boqId, resolutionNote },
    }, tx);
    return result;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
