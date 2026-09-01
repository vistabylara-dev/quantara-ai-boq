import {
  BoqItemSourceType,
  BOQItemStatus,
  BOQStatus,
  ExtractedEntityStatus,
  MarginMode,
  Prisma,
  RateProvenanceSource,
  VerificationSeverity,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { assertBOQCanBeLocked, assertBOQEditable } from "@/lib/domain/boq-guards";
import { calculateBOQItem, calculateBOQTotals } from "@/lib/calculations/boq-calculator";
import { evaluateBOQFinalizationGate } from "@/lib/boq/finalization-gate";
import {
  computeFurnitureInputSignature,
  FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX,
} from "@/lib/furniture/canonical-output";
import type { FurnitureCandidateDiscipline } from "@/lib/furniture/candidate-mapper";
import {
  FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
  FURNITURE_MANAGED_ITEM_CODE_PREFIX,
  FURNITURE_MANAGED_SOURCE_PREFIX,
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  FurnitureDiscipline,
  JOINERY_INDUSTRY_KEY,
  isStrictFurnitureManagedNonCommercialRow,
  readStrictFurnitureManagedKey,
} from "@/lib/furniture/types";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { RETIRED_COMBINED_INDUSTRY_KEY } from "@/lib/repositories/industry-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import type { BOQ, BOQItem, BOQItemPricingMetadata, BOQSection } from "@/types/boq";
import {
  confirmManualQuantityProvenance,
  confirmManualRateProvenance,
  copyItemProvenance,
  freezeRevisionItemEvidence,
  initializeManualItemProvenance,
  recordConfirmedCalculationQuantity,
  recordReviewedExtractionQuantity,
  recordRateProvenance,
  type IntegrityActor,
} from "@/lib/services/estimate-integrity-service";

const boqInclude = {
  project: {
    include: {
      client: true,
      industryEngine: true,
    },
  },
  sections: {
    orderBy: { sortOrder: "asc" },
    include: {
      items: {
        orderBy: { sortOrder: "asc" },
        include: {
          options: { orderBy: { createdAt: "asc" } },
          sourceMasterItem: { select: { isPremium: true } },
          quantityProvenance: true,
          rateProvenance: true,
        },
      },
    },
  },
  verificationExceptions: {
    orderBy: [{ resolved: "asc" }, { severity: "desc" }, { createdAt: "desc" }],
    include: { boqItem: true },
  },
} satisfies Prisma.BOQInclude;

export type BOQRecord = Prisma.BOQGetPayload<{ include: typeof boqInclude }>;

function isUuid(value: string) {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function formatRevision(revisionNumber: number) {
  return `R${String(revisionNumber).padStart(2, "0")}`;
}

function managedIdentityFor(
  industryKey: string,
  sectionCode: string,
  item: BOQRecord["sections"][number]["items"][number],
) {
  return {
    industryKey,
    sectionCode,
    sourceType: item.sourceType,
    itemCode: item.itemCode,
    sourceReference: item.sourceReference,
    notes: item.notes,
    category: item.category,
  };
}

async function assertFurnitureManagedInputsCurrent(
  tx: Prisma.TransactionClient,
  current: BOQRecord,
): Promise<void> {
  if (current.project.industryEngine.key !== JOINERY_INDUSTRY_KEY) return;

  const rows = current.sections.flatMap((section) =>
    section.items.map((item) => ({ sectionCode: section.code, item })));
  const managedRows = rows.filter(({ item }) =>
    item.itemCode.startsWith(FURNITURE_MANAGED_ITEM_CODE_PREFIX)
      || item.sourceReference.startsWith(FURNITURE_MANAGED_SOURCE_PREFIX)
      || item.notes.startsWith(FURNITURE_MANAGED_SOURCE_PREFIX));
  if (managedRows.length === 0) return;

  for (const { item } of managedRows) {
    if (!readStrictFurnitureManagedKey(item)) {
      throw new AppError(
        "FURNITURE_MANAGED_IDENTITY_INVALID",
        "A managed furniture row has incomplete identity markers. Regenerate the managed BOQ before locking.",
        409,
      );
    }
  }

  const signatureRows = managedRows.filter(({ item }) =>
    readStrictFurnitureManagedKey(item) === "integrity:input-signature");
  if (signatureRows.length !== 1) {
    throw new AppError(
      "FURNITURE_REGENERATION_REQUIRED",
      "The managed furniture source signature is missing or duplicated. Regenerate before locking.",
      409,
    );
  }
  const signatureRow = signatureRows[0].item;
  if (!signatureRow.specification.startsWith(FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX)) {
    throw new AppError(
      "FURNITURE_REGENERATION_REQUIRED",
      "The managed furniture source signature is invalid. Regenerate before locking.",
      409,
    );
  }
  const persistedSignature = signatureRow.specification.slice(FURNITURE_INPUT_SIGNATURE_SPECIFICATION_PREFIX.length);
  if (!/^[0-9a-f]{64}$/.test(persistedSignature)) {
    throw new AppError(
      "FURNITURE_REGENERATION_REQUIRED",
      "The managed furniture source signature is invalid. Regenerate before locking.",
      409,
    );
  }

  const entities = await tx.extractedEntity.findMany({
    where: {
      companyId: current.companyId,
      projectId: current.projectId,
      categoryKey: {
        in: [FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND, FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND],
      },
      status: { not: ExtractedEntityStatus.REJECTED },
    },
    select: { id: true, categoryKey: true, status: true, confirmedAt: true, updatedAt: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
  });
  const partEntities = entities.filter((entity) => entity.categoryKey === FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND);
  if (
    partEntities.length === 0
    || entities.some((entity) => entity.status !== "CONFIRMED" || !entity.confirmedAt)
  ) {
    throw new AppError(
      "FURNITURE_REGENERATION_REQUIRED",
      "Furniture source candidates changed or require review. Confirm them and regenerate before locking.",
      409,
    );
  }
  const discipline = FurnitureDiscipline.JOINERY_CABINETRY;
  const signatureEntity = (entity: (typeof entities)[number]) => ({
    entityId: entity.id,
    status: "CONFIRMED" as const,
    confirmedAt: entity.confirmedAt!.toISOString(),
    updatedAt: entity.updatedAt.toISOString(),
  });
  const currentSignature = computeFurnitureInputSignature({
    discipline: discipline as FurnitureCandidateDiscipline,
    wastagePercentage: signatureRow.wastagePercentage.toNumber(),
    partEntities: partEntities.map(signatureEntity),
    orderEntities: entities
      .filter((entity) => entity.categoryKey === FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND)
      .map(signatureEntity),
  });
  if (currentSignature !== persistedSignature) {
    throw new AppError(
      "FURNITURE_REGENERATION_REQUIRED",
      "Furniture source candidates changed after managed output generation. Regenerate before locking.",
      409,
    );
  }
}

function toFrontendBOQStatus(status: BOQStatus): "draft" | "locked" | "approved" {
  if (status === BOQStatus.LOCKED || status === BOQStatus.ISSUED) return "locked";
  if (status === BOQStatus.APPROVED) return "approved";
  return "draft";
}

export function toBOQDTO(
  boq: BOQRecord,
): BOQ & { databaseId: string; taxRate: number; version: number; revisionNumber: number } {
  const itemRows = boq.sections.flatMap((section) =>
    section.items.map((item) => ({ item, sectionCode: section.code })));
  const items = itemRows.map(({ item }) => item);
  const totals = calculateBOQTotals(items, boq.discountPercentage, boq.taxRate);
  const unresolvedCritical = (boq.verificationExceptions ?? []).filter(
    (exception) => !exception.resolved && exception.severity === VerificationSeverity.CRITICAL,
  ).length;
  const finalization = evaluateBOQFinalizationGate({
    isLocked: boq.isLocked,
    version: boq.version,
    verifiedVersion: boq.verifiedVersion,
    verifiedAt: boq.verifiedAt,
    unresolvedCritical,
    items: itemRows.map(({ item, sectionCode }) => ({
      status: item.status,
      quantityConfirmed: Boolean(item.quantityProvenance?.confirmedAt) && item.quantityProvenance?.sourceType !== "LEGACY_UNVERIFIED",
      rateConfirmed: Boolean(item.rateProvenance?.confirmedAt) && item.rateProvenance?.sourceType !== "LEGACY_UNVERIFIED",
      rateConfirmationRequired: !isStrictFurnitureManagedNonCommercialRow(
        managedIdentityFor(boq.project.industryEngine.key, sectionCode, item),
      ),
    })),
  });

  return {
    id: boq.id,
    databaseId: boq.id,
    projectId: boq.project.slug,
    title: boq.title,
    taxRate: boq.taxRate.toNumber(),
    revision: formatRevision(boq.revisionNumber),
    // TAYQAN-1 — raw, comparable fields alongside the existing formatted
    // `revision` string. The TAYQAN hire screen needs these to detect
    // whether a BOQ has changed since its latest review (see
    // src/lib/worker/tayqan-presentation.ts's isReviewStale) without
    // inventing new persistence — WorkerRun already stores this same
    // sourceBoqVersion/sourceRevisionNumber snapshot at hire time.
    version: boq.version,
    revisionNumber: boq.revisionNumber,
    status: toFrontendBOQStatus(boq.status),
    sections: boq.sections.map((section) => ({
      id: section.id,
      code: section.code,
      title: section.title,
      description: section.description,
      order: section.sortOrder,
      collapsed: false,
      items: section.items.map((item) => ({
        id: item.id,
        itemNumber: item.itemNumber,
        itemCode: item.itemCode,
        category: item.category,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity.toNumber(),
        unit: item.unit,
        unitCost: item.unitCost.toNumber(),
        freightCost: item.freightCost.toNumber(),
        installationCost: item.installationCost.toNumber(),
        additionalCost: item.additionalCost.toNumber(),
        landedCost: item.landedCost.toNumber(),
        marginMode: item.marginMode.toLowerCase() as "markup" | "gross_margin",
        marginPercentage: item.marginPercentage.toNumber(),
        sellingRate: item.sellingRate.toNumber(),
        totalAmount: item.totalAmount.toNumber(),
        wastagePercentage: item.wastagePercentage.toNumber(),
        taxApplicable: item.taxApplicable,
        sourceReference: item.sourceReference,
        roomOrZone: item.roomOrZone,
        drawingReference: item.drawingReference,
        confidenceScore: item.confidenceScore.toNumber(),
        status: item.status.toLowerCase(),
        notes: item.notes,
        pricingMetadata: (item.pricingMetadataJson as BOQItemPricingMetadata | null) ?? null,
        isPremiumSource: item.sourceMasterItem?.isPremium ?? false,
        integrity: {
          quantity: {
            sourceType: item.quantityProvenance?.sourceType ?? null,
            confirmed: Boolean(item.quantityProvenance?.confirmedAt) && item.quantityProvenance?.sourceType !== "LEGACY_UNVERIFIED",
          },
          rate: {
            sourceType: item.rateProvenance?.sourceType ?? null,
            confirmed: Boolean(item.rateProvenance?.confirmedAt) && item.rateProvenance?.sourceType !== "LEGACY_UNVERIFIED",
          },
        },
        options: item.options.map((option) => ({
          id: option.id,
          label: option.label,
          description: option.description,
          specification: option.specification,
          rate: option.rate.toNumber(),
          selected: option.isSelected,
        })),
      })),
    })),
    totals: {
      directCost: totals.directCost.toNumber(),
      landedCost: totals.landedCost.toNumber(),
      grossProfit: totals.grossProfit.toNumber(),
      grossMarginPercentage: totals.grossMarginPercentage.toNumber(),
      subtotal: totals.subtotal.toNumber(),
      discountPercentage: totals.discountPercentage.toNumber(),
      discountAmount: totals.discountAmount.toNumber(),
      taxableAmount: totals.taxableAmount.toNumber(),
      taxAmount: totals.taxAmount.toNumber(),
      grandTotal: totals.grandTotal.toNumber(),
    },
    createdAt: boq.createdAt.toISOString(),
    lockedAt: boq.lockedAt?.toISOString(),
    lockedByUserId: boq.lockedByUserId ?? undefined,
    approvedBy: boq.approvedByName ?? undefined,
    finalization,
  };
}

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function getBOQRecord(companyId: string, boqId: string, db: DbClient = prisma) {
  const boq = await db.bOQ.findFirst({
    where: {
      id: boqId,
      companyId,
      project: { industryEngine: { key: { not: RETIRED_COMBINED_INDUSTRY_KEY } } },
    },
    include: boqInclude,
  });
  if (!boq) throw new NotFoundError("BOQ not found.");
  return boq;
}

export async function getBOQ(companyId: string, boqId: string, db: DbClient = prisma) {
  return toBOQDTO(await getBOQRecord(companyId, boqId, db));
}

export async function listProjectBOQs(companyId: string, projectIdentifier: string) {
  const project = await getProjectRecord(companyId, projectIdentifier);
  const boqs = await prisma.bOQ.findMany({
    where: { companyId, projectId: project.id },
    include: boqInclude,
    orderBy: { revisionNumber: "desc" },
  });
  return boqs.map(toBOQDTO);
}

type SectionTemplate = { code: string; title: string; description?: string; order?: number };

function engineSectionTemplates(configJson: Prisma.JsonValue): SectionTemplate[] {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) return [];
  const sections = (configJson as Record<string, unknown>).boqSections;
  if (!Array.isArray(sections)) return [];
  return sections.flatMap((section, index) => {
    if (!section || typeof section !== "object" || Array.isArray(section)) return [];
    const value = section as Record<string, unknown>;
    if (typeof value.code !== "string" || typeof value.title !== "string") return [];
    return [{
      code: value.code,
      title: value.title,
      description: typeof value.description === "string" ? value.description : "",
      order: typeof value.order === "number" ? value.order : index + 1,
    }];
  });
}

function engineDefaultBOQTitle(configJson: Prisma.JsonValue, fallback: string): string {
  if (!configJson || typeof configJson !== "object" || Array.isArray(configJson)) return fallback;
  const labels = (configJson as Record<string, unknown>).documentLabels;
  if (!labels || typeof labels !== "object" || Array.isArray(labels)) return fallback;
  const boqLabel = (labels as Record<string, unknown>).boq;
  return typeof boqLabel === "string" && boqLabel.trim() ? boqLabel : fallback;
}

/**
 * Accepts an optional externally-managed transaction so the project-creation
 * service can create the project and its default R01 BOQ atomically. Without
 * one, this opens and commits its own transaction (unchanged standalone
 * behavior for the existing "create a BOQ for an existing project" route).
 */
export async function createProjectBOQ(
  companyId: string,
  projectIdentifier: string,
  input?: { title?: string; sections?: SectionTemplate[] },
  externalTx?: Prisma.TransactionClient,
) {
  const db = externalTx ?? prisma;
  const project = await getProjectRecord(companyId, projectIdentifier, db);
  const existing = await db.bOQ.findFirst({
    where: { companyId, projectId: project.id },
    orderBy: { revisionNumber: "asc" },
    select: { id: true },
  });
  if (existing) {
    return getBOQ(companyId, existing.id, db);
  }

  const templates = input?.sections ?? engineSectionTemplates(project.industryEngine.configJson);
  const defaultTitle = engineDefaultBOQTitle(project.industryEngine.configJson, `${project.industryEngine.name} BOQ`);

  const run = async (tx: Prisma.TransactionClient) => {
    const created = await tx.bOQ.create({
      data: {
        companyId,
        projectId: project.id,
        title: input?.title ?? defaultTitle,
        revisionNumber: 1,
        status: BOQStatus.DRAFT,
        taxRate: project.taxRate,
        sections: {
          create: templates.map((section, index) => ({
            companyId,
            code: section.code,
            title: section.title,
            description: section.description ?? "",
            sortOrder: section.order ?? index + 1,
          })),
        },
      },
    });
    await createAuditLog(companyId, {
      entityType: "BOQ",
      entityId: created.id,
      action: "BOQ_CREATED",
      payload: { projectId: project.id, revisionNumber: 1, sectionCount: templates.length },
    }, tx);
    return created;
  };

  const boq = externalTx ? await run(externalTx) : await prisma.$transaction(run);
  return getBOQ(companyId, boq.id, db);
}

function calculatedItemData(item: BOQItem, current?: BOQRecord["sections"][number]["items"][number]) {
  const freightCost = item.freightCost ?? current?.freightCost ?? 0;
  const installationCost = item.installationCost ?? current?.installationCost ?? 0;
  const additionalCost = item.additionalCost ?? current?.additionalCost ?? 0;
  const marginMode = item.marginMode
    ? item.marginMode.toUpperCase() === "GROSS_MARGIN"
      ? MarginMode.GROSS_MARGIN
      : MarginMode.MARKUP
    : current?.marginMode ?? MarginMode.MARKUP;
  const amounts = calculateBOQItem({
    quantity: item.quantity,
    unitCost: item.unitCost,
    freightCost,
    installationCost,
    additionalCost,
    marginMode,
    marginPercentage: item.marginPercentage,
  });
  return {
    landedCost: amounts.landedCost,
    sellingRate: amounts.sellingRate,
    totalAmount: amounts.totalAmount,
    freightCost: new Prisma.Decimal(freightCost),
    installationCost: new Prisma.Decimal(installationCost),
    additionalCost: new Prisma.Decimal(additionalCost),
    marginMode,
  };
}

async function syncSectionItems(
  tx: Prisma.TransactionClient,
  companyId: string,
  boqId: string,
  projectId: string,
  sectionId: string,
  incomingItems: BOQItem[],
  currentItems: BOQRecord["sections"][number]["items"],
) {
  const currentById = new Map(currentItems.map((item) => [item.id, item]));
  const incomingExistingIds = new Set(incomingItems.filter((item) => isUuid(item.id)).map((item) => item.id));
  const deleted = currentItems.filter((item) => !incomingExistingIds.has(item.id));

  for (const item of deleted) {
    await tx.bOQItem.delete({ where: { id: item.id, companyId } });
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "ITEM_DELETED",
      payload: { boqId, sectionId, itemCode: item.itemCode },
    }, tx);
  }

  for (const [index, item] of incomingItems.entries()) {
    const current = currentById.get(item.id);
    const calculated = calculatedItemData(item, current);
    const data = {
      itemNumber: item.itemNumber,
      itemCode: item.itemCode,
      category: item.category,
      description: item.description,
      specification: item.specification ?? "",
      quantity: new Prisma.Decimal(item.quantity),
      unit: item.unit,
      unitCost: new Prisma.Decimal(item.unitCost),
      freightCost: calculated.freightCost,
      installationCost: calculated.installationCost,
      additionalCost: calculated.additionalCost,
      landedCost: calculated.landedCost,
      marginMode: calculated.marginMode,
      marginPercentage: new Prisma.Decimal(item.marginPercentage),
      sellingRate: calculated.sellingRate,
      totalAmount: calculated.totalAmount,
      wastagePercentage: new Prisma.Decimal(item.wastagePercentage),
      taxApplicable: item.taxApplicable,
      sourceReference: item.sourceReference ?? "",
      roomOrZone: item.roomOrZone ?? "",
      drawingReference: item.drawingReference ?? "",
      confidenceScore: new Prisma.Decimal(item.confidenceScore),
      notes: item.notes ?? "",
      sortOrder: index + 1,
    };

    if (current) {
      const quantityChanged = !current.quantity.equals(data.quantity) || current.unit !== data.unit;
      const rateChanged =
        !current.unitCost.equals(data.unitCost) ||
        !current.freightCost.equals(data.freightCost) ||
        !current.installationCost.equals(data.installationCost) ||
        !current.additionalCost.equals(data.additionalCost) ||
        current.marginMode !== data.marginMode ||
        !current.marginPercentage.equals(data.marginPercentage);
      const itemChanged =
        current.itemNumber !== data.itemNumber ||
        current.itemCode !== data.itemCode ||
        current.category !== data.category ||
        current.description !== data.description ||
        current.specification !== data.specification ||
        quantityChanged ||
        !current.unitCost.equals(data.unitCost) ||
        !current.freightCost.equals(data.freightCost) ||
        !current.installationCost.equals(data.installationCost) ||
        !current.additionalCost.equals(data.additionalCost) ||
        !current.landedCost.equals(data.landedCost) ||
        current.marginMode !== data.marginMode ||
        !current.marginPercentage.equals(data.marginPercentage) ||
        !current.sellingRate.equals(data.sellingRate) ||
        !current.totalAmount.equals(data.totalAmount) ||
        !current.wastagePercentage.equals(data.wastagePercentage) ||
        current.taxApplicable !== data.taxApplicable ||
        current.sourceReference !== data.sourceReference ||
        current.roomOrZone !== data.roomOrZone ||
        current.drawingReference !== data.drawingReference ||
        !current.confidenceScore.equals(data.confidenceScore) ||
        current.notes !== data.notes ||
        current.sortOrder !== data.sortOrder;
      if (!itemChanged) continue;
      const updatedItem = await tx.bOQItem.update({ where: { id: current.id, companyId }, data });
      if (quantityChanged) {
        await confirmManualQuantityProvenance(tx, companyId, projectId, updatedItem);
      }
      if (rateChanged) {
        await confirmManualRateProvenance(tx, companyId, projectId, updatedItem);
      }
      await createAuditLog(companyId, {
        entityType: "BOQItem",
        entityId: current.id,
        action: "ITEM_CHANGED",
        payload: { boqId, sectionId, itemCode: item.itemCode },
      }, tx);
    } else {
      const created = await tx.bOQItem.create({
        data: {
          companyId,
          sectionId,
          ...data,
          status: BOQItemStatus.DRAFT,
          options: {
            create: (item.options ?? []).map((option) => ({
              companyId,
              label: option.label,
              description: option.description,
              specification: option.specification,
              rate: new Prisma.Decimal(option.rate),
              isSelected: option.selected,
            })),
          },
        },
      });
      await initializeManualItemProvenance(tx, companyId, projectId, created);
      await createAuditLog(companyId, {
        entityType: "BOQItem",
        entityId: created.id,
        action: "ITEM_ADDED",
        payload: { boqId, sectionId, itemCode: item.itemCode },
      }, tx);
    }
  }
}

export type BOQDocumentWriteInput = Omit<BOQ, "approvedBy" | "taxRate"> & {
  approvedBy?: string | null;
  taxRate?: Prisma.Decimal.Value;
};

export const BOQ_DOCUMENT_WRITE_TRANSACTION_TIMEOUT_MS = 30_000;

export async function updateBOQ(companyId: string, boqId: string, input: BOQDocumentWriteInput) {
  const current = await getBOQRecord(companyId, boqId);
  assertBOQEditable(current, "edit");

  await prisma.$transaction(async (tx) => {
    const updated = await tx.bOQ.updateMany({
      where: { id: current.id, companyId, isLocked: false, version: current.version },
      data: {
        title: input.title,
        discountPercentage: new Prisma.Decimal(input.totals.discountPercentage),
        ...(input.approvedBy !== undefined ? { approvedByName: input.approvedBy } : {}),
        ...(input.taxRate !== undefined ? { taxRate: new Prisma.Decimal(input.taxRate) } : {}),
        status: BOQStatus.NEEDS_VERIFICATION,
        version: { increment: 1 },
        verifiedVersion: null,
        verifiedAt: null,
      },
    });
    if (updated.count !== 1) assertBOQEditable({ ...current, isLocked: true }, "edit");

    const currentSections = new Map(current.sections.map((section) => [section.id, section]));
    for (const [sectionIndex, section] of input.sections.entries()) {
      const existingSection = currentSections.get(section.id);
      let sectionId: string;
      if (existingSection) {
        await tx.bOQSection.update({
          where: { id: existingSection.id, companyId },
          data: {
            code: section.code,
            title: section.title,
            description: section.description ?? "",
            sortOrder: section.order ?? sectionIndex + 1,
          },
        });
        sectionId = existingSection.id;
      } else {
        const createdSection = await tx.bOQSection.create({
          data: {
            companyId,
            boqId: current.id,
            code: section.code,
            title: section.title,
            description: section.description ?? "",
            sortOrder: section.order ?? sectionIndex + 1,
          },
        });
        sectionId = createdSection.id;
      }
      await syncSectionItems(tx, companyId, current.id, current.projectId, sectionId, section.items, existingSection?.items ?? []);
    }
  }, { timeout: BOQ_DOCUMENT_WRITE_TRANSACTION_TIMEOUT_MS });
  return getBOQ(companyId, current.id);
}

export async function recalculateBOQ(companyId: string, boqId: string) {
  const current = await getBOQRecord(companyId, boqId);
  assertBOQEditable(current, "recalculat");
  await prisma.$transaction(async (tx) => {
    const claimed = await tx.bOQ.updateMany({
      where: { id: current.id, companyId, isLocked: false, version: current.version },
      data: {
        status: BOQStatus.NEEDS_VERIFICATION,
        version: { increment: 1 },
        verifiedVersion: null,
        verifiedAt: null,
      },
    });
    if (claimed.count !== 1) {
      throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "The BOQ changed or was locked. Reload and retry.");
    }
    for (const section of current.sections) {
      for (const item of section.items) {
        const amounts = calculateBOQItem({
          quantity: item.quantity,
          unitCost: item.unitCost,
          freightCost: item.freightCost,
          installationCost: item.installationCost,
          additionalCost: item.additionalCost,
          marginMode: item.marginMode,
          marginPercentage: item.marginPercentage,
        });
        await tx.bOQItem.update({
          where: { id: item.id, companyId },
          data: amounts,
        });
      }
    }
    await createAuditLog(companyId, {
      entityType: "BOQ",
      entityId: current.id,
      action: "RECALCULATED",
      payload: { revisionNumber: current.revisionNumber },
    }, tx);
  });
  return getBOQ(companyId, current.id);
}

export async function createBOQRevision(companyId: string, boqId: string, actorName = "Development User") {
  const createdId = await prisma.$transaction(async (tx) => {
    const source = await tx.bOQ.findFirst({
      where: { id: boqId, companyId },
      include: boqInclude,
    });
    if (!source) throw new NotFoundError("BOQ not found.");
    const latest = await tx.bOQ.findFirst({
      where: { companyId, projectId: source.projectId },
      orderBy: { revisionNumber: "desc" },
      select: { id: true, revisionNumber: true },
    });
    if (latest && latest.id !== source.id) {
      throw new ConflictError(
        "REVISION_SOURCE_STALE",
        "Create the next revision from the latest BOQ revision.",
      );
    }
    const revisionNumber = (latest?.revisionNumber ?? source.revisionNumber) + 1;
    const created = await tx.bOQ.create({
      data: {
        companyId,
        projectId: source.projectId,
        title: source.title,
        revisionNumber,
        status: BOQStatus.DRAFT,
        isLocked: false,
        approvedByName: null,
        discountPercentage: source.discountPercentage,
        taxRate: source.taxRate,
        sections: {
          create: source.sections.map((section) => ({
            companyId,
            code: section.code,
            title: section.title,
            description: section.description,
            sortOrder: section.sortOrder,
            items: {
              create: section.items.map((item) => ({
                companyId,
                itemNumber: item.itemNumber,
                itemCode: item.itemCode,
                category: item.category,
                description: item.description,
                specification: item.specification,
                quantity: item.quantity,
                unit: item.unit,
                unitCost: item.unitCost,
                freightCost: item.freightCost,
                installationCost: item.installationCost,
                additionalCost: item.additionalCost,
                landedCost: item.landedCost,
                marginMode: item.marginMode,
                marginPercentage: item.marginPercentage,
                sellingRate: item.sellingRate,
                totalAmount: item.totalAmount,
                wastagePercentage: item.wastagePercentage,
                taxApplicable: item.taxApplicable,
                sourceReference: item.sourceReference,
                roomOrZone: item.roomOrZone,
                drawingReference: item.drawingReference,
                confidenceScore: item.confidenceScore,
                status: BOQItemStatus.DRAFT,
                notes: item.notes,
                sortOrder: item.sortOrder,
                sourceType: BoqItemSourceType.PREVIOUS_BOQ,
                sourcePreviousBoqItemId: item.id,
                copiedAt: new Date(),
                options: {
                  create: item.options.map((option) => ({
                    companyId,
                    label: option.label,
                    description: option.description,
                    specification: option.specification,
                    rate: option.rate,
                    isSelected: option.isSelected,
                  })),
                },
              })),
            },
          })),
        },
      },
    });
    const copiedItems = await tx.bOQItem.findMany({
      where: {
        companyId,
        section: { boqId: created.id },
        sourcePreviousBoqItemId: { not: null },
      },
    });
    for (const item of copiedItems) {
      if (!item.sourcePreviousBoqItemId) continue;
      await copyItemProvenance(tx, {
        companyId,
        projectId: source.projectId,
        sourceItemId: item.sourcePreviousBoqItemId,
        item,
        rateSourceType: RateProvenanceSource.PREVIOUS_BOQ,
        actor: { name: actorName },
      });
    }
    await tx.project.update({
      where: { id: source.projectId, companyId },
      data: { currentRevisionNumber: revisionNumber },
    });
    await createAuditLog(companyId, {
      entityType: "BOQ",
      entityId: created.id,
      action: "REVISION_CREATED",
      actorName,
      payload: { sourceBoqId: source.id, revisionNumber },
    }, tx);
    return created.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  return getBOQ(companyId, createdId);
}

function snapshotValue(record: BOQRecord): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(record)) as Prisma.InputJsonValue;
}

export async function lockBOQ(companyId: string, boqId: string, actorName = "Development User", lockedByUserId?: string) {
  const existing = await getBOQRecord(companyId, boqId);
  if (existing.isLocked) return toBOQDTO(existing);

  const { canCreateBoq, recordBoqCompleted } = await import("@/lib/entitlements/entitlement-service");
  const boqCheck = await canCreateBoq(companyId);
  if (!boqCheck.allowed) {
    throw new ConflictError("TRIAL_BOQ_LIMIT_REACHED", boqCheck.reason ?? "BOQ completion limit reached.");
  }

  const lockedId = await prisma.$transaction(async (tx) => {
    const current = await tx.bOQ.findFirst({
      where: { id: boqId, companyId },
      include: boqInclude,
    });
    if (!current) throw new NotFoundError("BOQ not found.");
    if (current.isLocked) return current.id;

    if (current.verifiedVersion === null || current.verifiedAt === null) {
      throw new AppError("VERIFICATION_REQUIRED", "Run verification before locking this BOQ.", 400);
    }
    if (current.verifiedVersion !== current.version) {
      throw new AppError("VERIFICATION_STALE", "The BOQ changed after verification. Re-run verification before locking.", 400);
    }

    const allItemRows = current.sections.flatMap((section) =>
      section.items.map((item) => ({ item, sectionCode: section.code })));
    const allItems = allItemRows.map(({ item }) => item);
    if (allItems.length === 0) {
      throw new AppError("BOQ_REVISION_EMPTY", "This revision contains no BOQ items. Add at least one item before locking.", 400);
    }

    let hasInvalidTotals = false;
    for (const { item, sectionCode } of allItemRows) {
      const displayId = item.itemCode || `Item ${item.itemNumber}`;
      if (!item.description || item.description.trim() === "") {
        throw new AppError("BOQ_ITEM_INVALID_DESCRIPTION", `${displayId} is missing a description.`, 400);
      }
      if (!item.unit || item.unit.trim() === "") {
        throw new AppError("BOQ_ITEM_INVALID_UNIT", `${displayId} is missing a unit.`, 400);
      }
      if (item.quantity.toNumber() <= 0) {
        throw new AppError("BOQ_ITEM_INVALID_QUANTITY", `${displayId} has a quantity less than or equal to zero.`, 400);
      }
      if (item.unitCost.toNumber() < 0) {
        throw new AppError("BOQ_ITEM_INVALID_RATE", `${displayId} has an invalid rate.`, 400);
      }
      if (item.totalAmount.toNumber() < 0) {
        hasInvalidTotals = true;
      }
      const quantityProvenance = item.quantityProvenance;
      const rateProvenance = item.rateProvenance;
      const quantityTraceable =
        quantityProvenance &&
        quantityProvenance.sourceType !== "LEGACY_UNVERIFIED" &&
        quantityProvenance.confirmedAt !== null &&
        quantityProvenance.quantitySnapshot.equals(item.quantity) &&
        quantityProvenance.unitSnapshot === item.unit;
      const rateTraceable =
        rateProvenance &&
        rateProvenance.sourceType !== "LEGACY_UNVERIFIED" &&
        rateProvenance.confirmedAt !== null &&
        rateProvenance.unitCostSnapshot.equals(item.unitCost) &&
        rateProvenance.freightCostSnapshot.equals(item.freightCost) &&
        rateProvenance.installationCostSnapshot.equals(item.installationCost) &&
        rateProvenance.additionalCostSnapshot.equals(item.additionalCost) &&
        rateProvenance.marginModeSnapshot === item.marginMode &&
        rateProvenance.marginPercentageSnapshot.equals(item.marginPercentage);
      const rateConfirmationRequired = !isStrictFurnitureManagedNonCommercialRow(
        managedIdentityFor(current.project.industryEngine.key, sectionCode, item),
      );
      if (!quantityTraceable || (rateConfirmationRequired && !rateTraceable)) {
        throw new AppError(
          "ESTIMATE_INTEGRITY_REQUIRED",
          rateConfirmationRequired
            ? `${displayId} needs confirmed quantity and rate provenance before this BOQ can be locked.`
            : `${displayId} needs confirmed quantity provenance before this BOQ can be locked.`,
          400,
        );
      }
    }

    if (hasInvalidTotals || current.taxRate.toNumber() < 0 || current.discountPercentage.toNumber() < 0) {
      throw new AppError("BOQ_INVALID_TOTALS", "The BOQ contains invalid calculated totals.", 400);
    }

    // Check critical unresolved issues explicitly, mapping them to 400
    const unresolvedCriticals = current.verificationExceptions.filter(e => e.severity.toUpperCase() === "CRITICAL" && e.resolved !== true);
    if (unresolvedCriticals.length > 0) {
      throw new AppError("BOQ_LOCK_BLOCKED", `BOQ cannot be locked while ${unresolvedCriticals.length} critical verification exception(s) remain unresolved.`, 400);
    }

    await assertFurnitureManagedInputsCurrent(tx, current);

    const revisionSnapshot = await tx.bOQRevisionSnapshot.create({
      data: {
        companyId,
        projectId: current.projectId,
        boqId: current.id,
        revisionNumber: current.revisionNumber,
        snapshotJson: snapshotValue(current),
        createdByName: actorName,
      },
    });
    await freezeRevisionItemEvidence(tx, {
      companyId,
      projectId: current.projectId,
      snapshotId: revisionSnapshot.id,
      items: allItems,
    });
    const lockedAt = new Date();
    const updated = await tx.bOQ.updateMany({
      where: {
        id: current.id,
        companyId,
        isLocked: false,
        version: current.version,
        verifiedVersion: current.version,
      },
      data: { isLocked: true, lockedAt, status: BOQStatus.LOCKED, lockedByUserId: lockedByUserId ?? null },
    });
    if (updated.count !== 1) throw new ConflictError("BOQ_LOCK_CONFLICT", "The BOQ was locked by another request.");
    
    const itemIds = allItems.map((item) => item.id);
    if (itemIds.length > 0) {
      await tx.bOQItem.updateMany({
        where: { companyId, id: { in: itemIds } },
        data: { status: BOQItemStatus.LOCKED },
      });
    }
    
    await createAuditLog(companyId, {
      entityType: "BOQ",
      entityId: current.id,
      action: "BOQ_LOCKED",
      actorName,
      payload: { revisionNumber: current.revisionNumber, lockedAt: lockedAt.toISOString() },
    }, tx);
    return current.id;
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
  await recordBoqCompleted(companyId);
  return getBOQ(companyId, lockedId);
}

async function claimEditableBOQ(
  tx: Prisma.TransactionClient,
  companyId: string,
  boqId: string,
  expectedVersion: number,
) {
  const claimed = await tx.bOQ.updateMany({
    where: {
      id: boqId,
      companyId,
      isLocked: false,
      status: { notIn: [BOQStatus.LOCKED, BOQStatus.ISSUED, BOQStatus.APPROVED] },
      version: expectedVersion,
    },
    data: {
      status: BOQStatus.NEEDS_VERIFICATION,
      version: { increment: 1 },
      verifiedVersion: null,
      verifiedAt: null,
    },
  });
  if (claimed.count !== 1) {
    throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "The BOQ changed or was locked. Reload and retry.");
  }
}

export type SectionWriteInput = {
  code: string;
  title: string;
  description?: string;
  sortOrder?: number;
};

async function getSectionRecord(companyId: string, sectionId: string, db: DbClient = prisma) {
  const section = await db.bOQSection.findFirst({
    where: { id: sectionId, companyId },
    include: { boq: true, items: { orderBy: { sortOrder: "asc" }, include: { options: true } } },
  });
  if (!section) throw new NotFoundError("BOQ section not found.");
  return section;
}

export async function getBOQSectionRecord(companyId: string, sectionId: string, db: DbClient = prisma) {
  return getSectionRecord(companyId, sectionId, db);
}

export async function createBOQSection(companyId: string, boqId: string, input: SectionWriteInput) {
  const boq = await getBOQRecord(companyId, boqId);
  assertBOQEditable(boq, "edit");
  const sortOrder = input.sortOrder ?? boq.sections.length + 1;
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, boq.id, boq.version);
    await tx.bOQSection.create({
      data: {
        companyId,
        boqId: boq.id,
        code: input.code,
        title: input.title,
        description: input.description ?? "",
        sortOrder,
      },
    });
  });
  return getBOQ(companyId, boq.id);
}

export async function updateBOQSection(companyId: string, sectionId: string, input: SectionWriteInput) {
  const section = await getSectionRecord(companyId, sectionId);
  assertBOQEditable(section.boq, "edit");
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, section.boqId, section.boq.version);
    await tx.bOQSection.update({
      where: { id: section.id, companyId },
      data: {
        code: input.code,
        title: input.title,
        description: input.description ?? section.description,
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
      },
    });
  });
  return getBOQ(companyId, section.boqId);
}

export async function deleteBOQSection(companyId: string, sectionId: string) {
  const section = await getSectionRecord(companyId, sectionId);
  assertBOQEditable(section.boq, "edit");
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, section.boqId, section.boq.version);
    for (const item of section.items) {
      await createAuditLog(companyId, {
        entityType: "BOQItem",
        entityId: item.id,
        action: "ITEM_DELETED",
        payload: { boqId: section.boqId, sectionId: section.id, itemCode: item.itemCode },
      }, tx);
    }
    await tx.bOQSection.delete({ where: { id: section.id, companyId } });
  });
  return { id: section.id, deleted: true };
}

export type BOQItemOptionWriteInput = {
  label: string;
  description?: string;
  specification?: string;
  rate?: Prisma.Decimal.Value;
  isSelected?: boolean;
};

export type BOQItemWriteInput = {
  itemNumber: number;
  itemCode: string;
  category: string;
  description: string;
  specification?: string;
  quantity: Prisma.Decimal.Value;
  unit: string;
  unitCost: Prisma.Decimal.Value;
  freightCost?: Prisma.Decimal.Value;
  installationCost?: Prisma.Decimal.Value;
  additionalCost?: Prisma.Decimal.Value;
  marginMode?: MarginMode;
  marginPercentage: Prisma.Decimal.Value;
  wastagePercentage?: Prisma.Decimal.Value;
  taxApplicable?: boolean;
  sourceReference?: string;
  roomOrZone?: string;
  drawingReference?: string;
  confidenceScore?: Prisma.Decimal.Value;
  status?: BOQItemStatus;
  notes?: string;
  sortOrder?: number;
  options?: BOQItemOptionWriteInput[];
  pricingMetadataJson?: Prisma.InputJsonValue | null;
};

export type BOQItemExpectedCurrent =
  | { field: "quantity"; value: Prisma.Decimal.Value }
  | { field: "unit" | "description" | "notes"; value: string };

export type BOQItemMutationContext = {
  /**
   * Optional optimistic field guard for preview/confirm flows. The comparison
   * is made against updateBOQItem's own fresh tenant-scoped read, immediately
   * before the existing BOQ version claim. A stale preview therefore cannot
   * be applied to a newer item value.
   */
  expectedCurrent?: BOQItemExpectedCurrent | readonly BOQItemExpectedCurrent[];
  /** Written in the same transaction as ITEM_CHANGED and the item mutation. */
  additionalAudit?: {
    action: string;
    payload?: Prisma.InputJsonValue;
  };
  integrityActor?: IntegrityActor;
  quantityCalculationProvenance?: {
    quantityCalculationId: string;
    extractedEntityId?: string;
    projectFileId?: string;
  };
  rateProvenance?: {
    sourceType: RateProvenanceSource;
    rateCatalogueItemId?: string | null;
    sourceBoqItemRateProvenanceId?: string | null;
    currency?: string;
    effectiveDate?: Date | null;
    expiryDate?: Date | null;
  };
};

export type BOQItemLifecycleMutationContext = {
  expectedBoqVersion?: number;
  additionalAudit?: {
    action: string;
    payload?: Prisma.InputJsonValue;
  };
  integrityActor?: IntegrityActor;
  initialRateSource?: RateProvenanceSource;
};

/**
 * Immutable, pre-mutation context for one BOQ item creation. Preparing this
 * context performs every section/editability check and the existing
 * commercial calculation without writing anything. A workflow that needs an
 * outer transaction can therefore validate first, claim its workflow record,
 * then persist the already-prepared item without repeating reads or pricing
 * logic after that claim.
 */
export async function prepareBOQItemCreation(
  companyId: string,
  sectionId: string,
  input: BOQItemWriteInput,
  database: DbClient = prisma,
  expectedBoqId?: string,
  expectedBoqVersion?: number,
) {
  const section = await getSectionRecord(companyId, sectionId, database);
  if (expectedBoqId && section.boqId !== expectedBoqId) {
    throw new AppError(
      "SECTION_BOQ_MISMATCH",
      "The selected BOQ section does not belong to the target BOQ.",
      400,
    );
  }
  assertBOQEditable(section.boq, "edit");
  if (expectedBoqVersion !== undefined && section.boq.version !== expectedBoqVersion) {
    throw new ConflictError(
      "VOICE_PROPOSAL_STALE",
      "This BOQ changed after the voice preview. Review the current revision and try again.",
    );
  }
  const marginMode = input.marginMode ?? MarginMode.MARKUP;
  const amounts = calculateBOQItem({
    quantity: input.quantity,
    unitCost: input.unitCost,
    freightCost: input.freightCost ?? 0,
    installationCost: input.installationCost ?? 0,
    additionalCost: input.additionalCost ?? 0,
    marginMode,
    marginPercentage: input.marginPercentage,
  });
  return { section, input, marginMode, amounts };
}

export type PreparedBOQItemCreation = Awaited<ReturnType<typeof prepareBOQItemCreation>>;

/** Persist a context produced by prepareBOQItemCreation inside its caller's transaction. */
export async function createPreparedBOQItem(
  companyId: string,
  prepared: PreparedBOQItemCreation,
  tx: Prisma.TransactionClient,
  additionalAudit?: BOQItemLifecycleMutationContext["additionalAudit"],
  integrityActor?: IntegrityActor,
  initialRateSource?: RateProvenanceSource,
) {
  const { section, input, marginMode, amounts } = prepared;
  await claimEditableBOQ(tx, companyId, section.boqId, section.boq.version);
  const item = await tx.bOQItem.create({
    data: {
      companyId,
      sectionId: section.id,
      itemNumber: input.itemNumber,
      itemCode: input.itemCode,
      category: input.category,
      description: input.description,
      specification: input.specification ?? "",
      quantity: new Prisma.Decimal(input.quantity),
      unit: input.unit,
      unitCost: new Prisma.Decimal(input.unitCost),
      freightCost: new Prisma.Decimal(input.freightCost ?? 0),
      installationCost: new Prisma.Decimal(input.installationCost ?? 0),
      additionalCost: new Prisma.Decimal(input.additionalCost ?? 0),
      ...amounts,
      marginMode,
      marginPercentage: new Prisma.Decimal(input.marginPercentage),
      wastagePercentage: new Prisma.Decimal(input.wastagePercentage ?? 0),
      taxApplicable: input.taxApplicable ?? true,
      sourceReference: input.sourceReference ?? "",
      roomOrZone: input.roomOrZone ?? "",
      drawingReference: input.drawingReference ?? "",
      confidenceScore: new Prisma.Decimal(input.confidenceScore ?? 100),
      status: input.status ?? BOQItemStatus.DRAFT,
      notes: input.notes ?? "",
      sortOrder: input.sortOrder ?? section.items.length + 1,
      options: input.options
        ? {
            create: input.options.map((option) => ({
              companyId,
              label: option.label,
              description: option.description ?? "",
              specification: option.specification ?? "",
              rate: new Prisma.Decimal(option.rate ?? 0),
              isSelected: option.isSelected ?? false,
            })),
          }
        : undefined,
    },
    include: { options: true },
  });
  await initializeManualItemProvenance(
    tx,
    companyId,
    section.boq.projectId,
    item,
    integrityActor,
    initialRateSource,
  );
  await createAuditLog(companyId, {
    entityType: "BOQItem",
    entityId: item.id,
    action: "ITEM_ADDED",
    payload: { boqId: section.boqId, sectionId: section.id, itemCode: item.itemCode },
  }, tx);
  if (additionalAudit) {
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: additionalAudit.action,
      payload: additionalAudit.payload,
    }, tx);
  }
  return item;
}

async function getItemRecord(companyId: string, itemId: string) {
  const item = await prisma.bOQItem.findFirst({
    where: { id: itemId, companyId },
    include: {
      options: true,
      section: { include: { boq: true } },
    },
  });
  if (!item) throw new NotFoundError("BOQ item not found.");
  return item;
}

/** Public wrapper around the internal single-item lookup above — additive only, getItemRecord's own behavior/signature is unchanged for its existing callers in this file. */
export async function getBOQItemRecord(companyId: string, itemId: string) {
  return getItemRecord(companyId, itemId);
}

/**
 * Accepts an optional externally-managed transaction (matching
 * createProject's pattern in project-repository.ts) so callers that need to
 * persist item creation atomically alongside further writes — e.g.
 * addBoqItemFromSource's source-attribution stamp — can do so in one
 * transaction instead of two separate commits. Without one, this opens and
 * commits its own transaction, unchanged standalone behavior for existing
 * callers (the direct "/api/sections/[sectionId]/items" route, extraction/
 * finding-to-BOQ imports).
 */
export async function createBOQItem(
  companyId: string,
  sectionId: string,
  input: BOQItemWriteInput,
  externalTx?: Prisma.TransactionClient,
  mutationContext?: BOQItemLifecycleMutationContext,
) {
  const prepared = await prepareBOQItemCreation(
    companyId,
    sectionId,
    input,
    externalTx ?? prisma,
    undefined,
    mutationContext?.expectedBoqVersion,
  );
  const created = externalTx
    ? await createPreparedBOQItem(companyId, prepared, externalTx, mutationContext?.additionalAudit, mutationContext?.integrityActor, mutationContext?.initialRateSource)
    : await prisma.$transaction((tx) => createPreparedBOQItem(companyId, prepared, tx, mutationContext?.additionalAudit, mutationContext?.integrityActor, mutationContext?.initialRateSource));
  // When called with an externally-managed transaction, the caller reads the
  // final BOQ state itself after that transaction commits — reading it here
  // via the top-level `prisma` client would see pre-commit state.
  if (externalTx) return { item: created };
  return { item: created, boq: await getBOQ(companyId, prepared.section.boqId) };
}

export async function updateBOQItem(
  companyId: string,
  itemId: string,
  input: Partial<BOQItemWriteInput>,
  mutationContext?: BOQItemMutationContext,
) {
  const current = await getItemRecord(companyId, itemId);
  assertBOQEditable(current.section.boq, "edit");
  const expectedValues = mutationContext?.expectedCurrent
    ? Array.isArray(mutationContext.expectedCurrent)
      ? mutationContext.expectedCurrent
      : [mutationContext.expectedCurrent]
    : [];
  for (const expected of expectedValues) {
    let matches = false;
    switch (expected.field) {
      case "quantity":
        matches = current.quantity.equals(new Prisma.Decimal(expected.value));
        break;
      case "unit":
        matches = current.unit === expected.value;
        break;
      case "description":
        matches = current.description === expected.value;
        break;
      case "notes":
        matches = current.notes === expected.value;
        break;
    }
    if (!matches) {
      throw new ConflictError(
        "VOICE_PROPOSAL_STALE",
        "This BOQ item changed after the voice preview. Review the current value and try again.",
      );
    }
  }
  const quantity = input.quantity ?? current.quantity;
  const unitCost = input.unitCost ?? current.unitCost;
  const freightCost = input.freightCost ?? current.freightCost;
  const installationCost = input.installationCost ?? current.installationCost;
  const additionalCost = input.additionalCost ?? current.additionalCost;
  const marginMode = input.marginMode ?? current.marginMode;
  const marginPercentage = input.marginPercentage ?? current.marginPercentage;
  const amounts = calculateBOQItem({
    quantity,
    unitCost,
    freightCost,
    installationCost,
    additionalCost,
    marginMode,
    marginPercentage,
  });
  const quantityEvidenceChanged =
    (input.quantity !== undefined && !new Prisma.Decimal(input.quantity).equals(current.quantity)) ||
    (input.unit !== undefined && input.unit !== current.unit);
  const rateEvidenceChanged =
    (input.unitCost !== undefined && !new Prisma.Decimal(input.unitCost).equals(current.unitCost)) ||
    (input.freightCost !== undefined && !new Prisma.Decimal(input.freightCost).equals(current.freightCost)) ||
    (input.installationCost !== undefined && !new Prisma.Decimal(input.installationCost).equals(current.installationCost)) ||
    (input.additionalCost !== undefined && !new Prisma.Decimal(input.additionalCost).equals(current.additionalCost)) ||
    (input.marginMode !== undefined && input.marginMode !== current.marginMode) ||
    (input.marginPercentage !== undefined && !new Prisma.Decimal(input.marginPercentage).equals(current.marginPercentage));

  // If this item was previously priced from the catalogue and a normal edit
  // (not an explicit pricingMetadataJson write from the apply-rate service)
  // changes a commercial field, record it as a manual override instead of
  // silently losing the fact that it once tracked the catalogue.
  let pricingMetadataUpdate: Prisma.InputJsonValue | typeof Prisma.JsonNull | undefined;
  if (input.pricingMetadataJson === undefined) {
    const existingMeta = current.pricingMetadataJson as unknown as BOQItemPricingMetadata | null;
    if (existingMeta?.commercialSource === "catalogue") {
      const changedFields: string[] = [];
      if (input.unitCost !== undefined && !new Prisma.Decimal(input.unitCost).equals(current.unitCost)) changedFields.push("unitCost");
      if (input.freightCost !== undefined && !new Prisma.Decimal(input.freightCost).equals(current.freightCost)) changedFields.push("freightCost");
      if (input.installationCost !== undefined && !new Prisma.Decimal(input.installationCost).equals(current.installationCost)) changedFields.push("installationCost");
      if (input.additionalCost !== undefined && !new Prisma.Decimal(input.additionalCost).equals(current.additionalCost)) changedFields.push("additionalCost");
      if (input.marginPercentage !== undefined && !new Prisma.Decimal(input.marginPercentage).equals(current.marginPercentage)) changedFields.push("marginPercentage");
      if (input.marginMode !== undefined && input.marginMode !== current.marginMode) changedFields.push("marginMode");
      if (changedFields.length > 0) {
        const merged = Array.from(new Set([...(existingMeta.manuallyOverriddenFields ?? []), ...changedFields]));
        pricingMetadataUpdate = { ...existingMeta, manuallyOverriddenFields: merged } as unknown as Prisma.InputJsonValue;
      }
    }
  }

  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, current.section.boqId, current.section.boq.version);
    const updatedItem = await tx.bOQItem.update({
      where: { id: current.id, companyId },
      data: {
        ...(input.itemNumber !== undefined ? { itemNumber: input.itemNumber } : {}),
        ...(input.itemCode !== undefined ? { itemCode: input.itemCode } : {}),
        ...(input.category !== undefined ? { category: input.category } : {}),
        ...(input.description !== undefined ? { description: input.description } : {}),
        ...(input.specification !== undefined ? { specification: input.specification } : {}),
        quantity: new Prisma.Decimal(quantity),
        ...(input.unit !== undefined ? { unit: input.unit } : {}),
        unitCost: new Prisma.Decimal(unitCost),
        freightCost: new Prisma.Decimal(freightCost),
        installationCost: new Prisma.Decimal(installationCost),
        additionalCost: new Prisma.Decimal(additionalCost),
        ...amounts,
        marginMode,
        marginPercentage: new Prisma.Decimal(marginPercentage),
        ...(input.wastagePercentage !== undefined ? { wastagePercentage: new Prisma.Decimal(input.wastagePercentage) } : {}),
        ...(input.taxApplicable !== undefined ? { taxApplicable: input.taxApplicable } : {}),
        ...(input.sourceReference !== undefined ? { sourceReference: input.sourceReference } : {}),
        ...(input.roomOrZone !== undefined ? { roomOrZone: input.roomOrZone } : {}),
        ...(input.drawingReference !== undefined ? { drawingReference: input.drawingReference } : {}),
        ...(input.confidenceScore !== undefined ? { confidenceScore: new Prisma.Decimal(input.confidenceScore) } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.notes !== undefined ? { notes: input.notes } : {}),
        ...(input.sortOrder !== undefined ? { sortOrder: input.sortOrder } : {}),
        ...(pricingMetadataUpdate !== undefined
          ? { pricingMetadataJson: pricingMetadataUpdate }
          : input.pricingMetadataJson !== undefined
            ? { pricingMetadataJson: input.pricingMetadataJson ?? Prisma.JsonNull }
            : {}),
        ...(input.options !== undefined
          ? {
              options: {
                deleteMany: { companyId },
                create: input.options.map((option) => ({
                  companyId,
                  label: option.label,
                  description: option.description ?? "",
                  specification: option.specification ?? "",
                  rate: new Prisma.Decimal(option.rate ?? 0),
                  isSelected: option.isSelected ?? false,
                })),
              },
            }
          : {}),
      },
    });
    if (mutationContext?.quantityCalculationProvenance) {
      const provenance = mutationContext.quantityCalculationProvenance;
      if (provenance.extractedEntityId && provenance.projectFileId) {
        await recordReviewedExtractionQuantity(tx, {
          companyId,
          projectId: current.section.boq.projectId,
          item: updatedItem,
          extractedEntityId: provenance.extractedEntityId,
          projectFileId: provenance.projectFileId,
          quantityCalculationId: provenance.quantityCalculationId,
          actor: mutationContext.integrityActor ?? { name: "Authorized BOQ editor" },
        });
      } else {
        await recordConfirmedCalculationQuantity(tx, {
          companyId,
          projectId: current.section.boq.projectId,
          item: updatedItem,
          quantityCalculationId: provenance.quantityCalculationId,
          actor: mutationContext.integrityActor ?? { name: "Authorized BOQ editor" },
        });
      }
    } else if (quantityEvidenceChanged) {
      await confirmManualQuantityProvenance(
        tx,
        companyId,
        current.section.boq.projectId,
        updatedItem,
        mutationContext?.integrityActor,
      );
    }
    if (mutationContext?.rateProvenance) {
      await recordRateProvenance(tx, {
        companyId,
        projectId: current.section.boq.projectId,
        item: updatedItem,
        ...mutationContext.rateProvenance,
        actor: mutationContext.integrityActor ?? { name: "Authorized BOQ editor" },
      });
    } else if (rateEvidenceChanged) {
      await confirmManualRateProvenance(
        tx,
        companyId,
        current.section.boq.projectId,
        updatedItem,
        mutationContext?.integrityActor,
      );
    }
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: current.id,
      action: "ITEM_CHANGED",
      payload: { boqId: current.section.boqId, sectionId: current.sectionId, itemCode: input.itemCode ?? current.itemCode },
    }, tx);
    if (mutationContext?.additionalAudit) {
      await createAuditLog(companyId, {
        entityType: "BOQItem",
        entityId: current.id,
        action: mutationContext.additionalAudit.action,
        payload: mutationContext.additionalAudit.payload,
      }, tx);
    }
    if (pricingMetadataUpdate && pricingMetadataUpdate !== Prisma.JsonNull) {
      await createAuditLog(companyId, {
        entityType: "BOQItem",
        entityId: current.id,
        action: "MANUAL_COMMERCIAL_OVERRIDE",
        payload: {
          boqId: current.section.boqId,
          itemCode: input.itemCode ?? current.itemCode,
          overriddenFields: (pricingMetadataUpdate as unknown as BOQItemPricingMetadata).manuallyOverriddenFields,
        },
      }, tx);
    }
  });
  return getBOQ(companyId, current.section.boqId);
}

/**
 * Explicit professional acknowledgement for migrated/manual items whose
 * values are already correct. This is the non-destructive path out of
 * LEGACY_UNVERIFIED; locking never promotes legacy rows implicitly.
 */
export async function confirmBOQItemIntegrity(
  companyId: string,
  itemId: string,
  actor: IntegrityActor,
) {
  const current = await getItemRecord(companyId, itemId);
  assertBOQEditable(current.section.boq, "confirm integrity for");
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, current.section.boqId, current.section.boq.version);
    await confirmManualQuantityProvenance(tx, companyId, current.section.boq.projectId, current, actor);
    await confirmManualRateProvenance(tx, companyId, current.section.boq.projectId, current, actor);
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: current.id,
      action: "ITEM_INTEGRITY_CONFIRMED",
      actorName: actor.name,
      payload: {
        boqId: current.section.boqId,
        itemCode: current.itemCode,
        quantity: current.quantity.toString(),
        unit: current.unit,
        unitCost: current.unitCost.toString(),
      },
    }, tx);
  });
  return getBOQ(companyId, current.section.boqId);
}

export async function deleteBOQItem(
  companyId: string,
  itemId: string,
  mutationContext?: BOQItemLifecycleMutationContext,
) {
  const item = await getItemRecord(companyId, itemId);
  assertBOQEditable(item.section.boq, "edit");
  if (mutationContext?.expectedBoqVersion !== undefined && item.section.boq.version !== mutationContext.expectedBoqVersion) {
    throw new ConflictError(
      "VOICE_PROPOSAL_STALE",
      "This BOQ changed after the voice preview. Review the current revision and try again.",
    );
  }
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, item.section.boqId, item.section.boq.version);
    await tx.bOQItem.delete({ where: { id: item.id, companyId } });
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "ITEM_DELETED",
      payload: { boqId: item.section.boqId, sectionId: item.sectionId, itemCode: item.itemCode },
    }, tx);
    if (mutationContext?.additionalAudit) {
      await createAuditLog(companyId, {
        entityType: "BOQItem",
        entityId: item.id,
        action: mutationContext.additionalAudit.action,
        payload: mutationContext.additionalAudit.payload,
      }, tx);
    }
  });
  return { id: item.id, deleted: true };
}

export async function duplicateBOQItem(companyId: string, itemId: string) {
  const item = await getItemRecord(companyId, itemId);
  assertBOQEditable(item.section.boq, "edit");
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, item.section.boqId, item.section.boq.version);
    const last = await tx.bOQItem.findFirst({
      where: { companyId, sectionId: item.sectionId },
      orderBy: [{ sortOrder: "desc" }, { itemNumber: "desc" }],
    });
    const duplicate = await tx.bOQItem.create({
      data: {
        companyId,
        sectionId: item.sectionId,
        itemNumber: (last?.itemNumber ?? item.itemNumber) + 1,
        itemCode: `${item.itemCode}-COPY`,
        category: item.category,
        description: item.description,
        specification: item.specification,
        quantity: item.quantity,
        unit: item.unit,
        unitCost: item.unitCost,
        freightCost: item.freightCost,
        installationCost: item.installationCost,
        additionalCost: item.additionalCost,
        landedCost: item.landedCost,
        marginMode: item.marginMode,
        marginPercentage: item.marginPercentage,
        sellingRate: item.sellingRate,
        totalAmount: item.totalAmount,
        wastagePercentage: item.wastagePercentage,
        taxApplicable: item.taxApplicable,
        sourceReference: item.sourceReference,
        roomOrZone: item.roomOrZone,
        drawingReference: item.drawingReference,
        confidenceScore: item.confidenceScore,
        status: BOQItemStatus.DRAFT,
        notes: item.notes,
        sortOrder: (last?.sortOrder ?? item.sortOrder) + 1,
        sourceType: BoqItemSourceType.PREVIOUS_BOQ,
        sourcePreviousBoqItemId: item.id,
        copiedAt: new Date(),
        options: {
          create: item.options.map((option) => ({
            companyId,
            label: option.label,
            description: option.description,
            specification: option.specification,
            rate: option.rate,
            isSelected: option.isSelected,
          })),
        },
      },
    });
    await copyItemProvenance(tx, {
      companyId,
      projectId: item.section.boq.projectId,
      sourceItemId: item.id,
      item: duplicate,
      actor: { name: "Authorized BOQ editor" },
    });
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: duplicate.id,
      action: "ITEM_ADDED",
      payload: { boqId: item.section.boqId, duplicatedFrom: item.id },
    }, tx);
  });
  return getBOQ(companyId, item.section.boqId);
}
