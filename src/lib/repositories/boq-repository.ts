import {
  BOQItemStatus,
  BOQStatus,
  MarginMode,
  Prisma,
  VerificationSeverity,
} from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { ConflictError, NotFoundError } from "@/lib/errors/app-error";
import { assertBOQCanBeLocked, assertBOQEditable } from "@/lib/domain/boq-guards";
import { calculateBOQItem, calculateBOQTotals } from "@/lib/calculations/boq-calculator";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import type { BOQ, BOQItem, BOQSection } from "@/types/boq";

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
        include: { options: { orderBy: { createdAt: "asc" } } },
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

function toFrontendBOQStatus(status: BOQStatus): "draft" | "locked" | "approved" {
  if (status === BOQStatus.LOCKED || status === BOQStatus.ISSUED) return "locked";
  if (status === BOQStatus.APPROVED) return "approved";
  return "draft";
}

export function toBOQDTO(boq: BOQRecord): BOQ & { databaseId: string; taxRate: number } {
  const items = boq.sections.flatMap((section) => section.items);
  const totals = calculateBOQTotals(items, boq.discountPercentage, boq.taxRate);

  return {
    id: boq.id,
    databaseId: boq.id,
    projectId: boq.project.slug,
    title: boq.title,
    taxRate: boq.taxRate.toNumber(),
    revision: formatRevision(boq.revisionNumber),
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
    approvedBy: boq.approvedByName ?? undefined,
  };
}

type DbClient = typeof prisma | Prisma.TransactionClient;

export async function getBOQRecord(companyId: string, boqId: string, db: DbClient = prisma) {
  const boq = await db.bOQ.findFirst({ where: { id: boqId, companyId }, include: boqInclude });
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
    orderBy: { revisionNumber: "desc" },
    select: { revisionNumber: true },
  });
  if (existing) {
    throw new ConflictError("BOQ_ALREADY_EXISTS", "Create a revision from the existing BOQ instead.");
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
      await tx.bOQItem.update({ where: { id: current.id, companyId }, data });
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
      await syncSectionItems(tx, companyId, current.id, sectionId, section.items, existingSection?.items ?? []);
    }
  });
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

export async function lockBOQ(companyId: string, boqId: string, actorName = "Development User") {
  const existing = await getBOQRecord(companyId, boqId);
  if (existing.isLocked) return toBOQDTO(existing);

  const lockedId = await prisma.$transaction(async (tx) => {
    const current = await tx.bOQ.findFirst({
      where: { id: boqId, companyId },
      include: boqInclude,
    });
    if (!current) throw new NotFoundError("BOQ not found.");
    if (current.isLocked) return current.id;

    if (current.verifiedVersion === null || current.verifiedAt === null) {
      throw new ConflictError("VERIFICATION_REQUIRED", "Run verification before locking this BOQ.");
    }
    if (current.verifiedVersion !== current.version) {
      throw new ConflictError(
        "VERIFICATION_STALE",
        "The BOQ changed after verification. Re-run verification before locking.",
      );
    }
    assertBOQCanBeLocked(current.verificationExceptions);

    await tx.bOQRevisionSnapshot.create({
      data: {
        companyId,
        projectId: current.projectId,
        boqId: current.id,
        revisionNumber: current.revisionNumber,
        snapshotJson: snapshotValue(current),
        createdByName: actorName,
      },
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
      data: { isLocked: true, lockedAt, status: BOQStatus.LOCKED },
    });
    if (updated.count !== 1) throw new ConflictError("BOQ_LOCK_CONFLICT", "The BOQ was locked by another request.");
    const itemIds = current.sections.flatMap((section) => section.items.map((item) => item.id));
    if (itemIds.length) {
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

async function getSectionRecord(companyId: string, sectionId: string) {
  const section = await prisma.bOQSection.findFirst({
    where: { id: sectionId, companyId },
    include: { boq: true, items: { orderBy: { sortOrder: "asc" }, include: { options: true } } },
  });
  if (!section) throw new NotFoundError("BOQ section not found.");
  return section;
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
};

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

export async function createBOQItem(companyId: string, sectionId: string, input: BOQItemWriteInput) {
  const section = await getSectionRecord(companyId, sectionId);
  assertBOQEditable(section.boq, "edit");
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
  const created = await prisma.$transaction(async (tx) => {
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
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "ITEM_ADDED",
      payload: { boqId: section.boqId, sectionId: section.id, itemCode: item.itemCode },
    }, tx);
    return item;
  });
  return { item: created, boq: await getBOQ(companyId, section.boqId) };
}

export async function updateBOQItem(
  companyId: string,
  itemId: string,
  input: Partial<BOQItemWriteInput>,
) {
  const current = await getItemRecord(companyId, itemId);
  assertBOQEditable(current.section.boq, "edit");
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
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, current.section.boqId, current.section.boq.version);
    await tx.bOQItem.update({
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
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: current.id,
      action: "ITEM_CHANGED",
      payload: { boqId: current.section.boqId, sectionId: current.sectionId, itemCode: input.itemCode ?? current.itemCode },
    }, tx);
  });
  return getBOQ(companyId, current.section.boqId);
}

export async function deleteBOQItem(companyId: string, itemId: string) {
  const item = await getItemRecord(companyId, itemId);
  assertBOQEditable(item.section.boq, "edit");
  await prisma.$transaction(async (tx) => {
    await claimEditableBOQ(tx, companyId, item.section.boqId, item.section.boq.version);
    await tx.bOQItem.delete({ where: { id: item.id, companyId } });
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: item.id,
      action: "ITEM_DELETED",
      payload: { boqId: item.section.boqId, sectionId: item.sectionId, itemCode: item.itemCode },
    }, tx);
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
    await createAuditLog(companyId, {
      entityType: "BOQItem",
      entityId: duplicate.id,
      action: "ITEM_ADDED",
      payload: { boqId: item.section.boqId, duplicatedFrom: item.id },
    }, tx);
  });
  return getBOQ(companyId, item.section.boqId);
}
