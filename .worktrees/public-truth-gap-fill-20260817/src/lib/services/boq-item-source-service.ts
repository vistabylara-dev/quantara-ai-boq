import { BoqItemSourceType, MarginMode, RateProvenanceSource } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireCapability } from "@/lib/auth/rbac";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { AppError, NotFoundError } from "@/lib/errors/app-error";
import { createBOQItem, getBOQ, getBOQRecord } from "@/lib/repositories/boq-repository";
import { getMasterItemRecord } from "@/lib/repositories/master-item-repository";
import { getLibraryItemRecord, recordItemUsage } from "@/lib/repositories/company-library-repository";
import { recordRateProvenance } from "@/lib/services/estimate-integrity-service";

type ResolvedDefaults = {
  itemCode: string;
  category: string;
  description: string;
  specification: string;
  unit: string;
  unitCost: number;
  marginMode: MarginMode;
  marginPercentage: number;
  /** MASTER-BOQ-1A BOQ snapshot behavior — only ever populated for MASTER_ITEM sources. */
  masterItemVersionId?: string | null;
  masterItemSnapshotJson?: unknown;
  rateCurrency?: string;
  rateEffectiveDate?: Date | null;
  rateExpiryDate?: Date | null;
};

const EMPTY_DEFAULTS: ResolvedDefaults = {
  itemCode: "",
  category: "Uncategorized",
  description: "",
  specification: "",
  unit: "",
  unitCost: 0,
  marginMode: MarginMode.MARKUP,
  marginPercentage: 0,
};

export type AddBoqItemFromSourceInput = {
  sourceType: BoqItemSourceType;
  sourceId?: string;
  sectionId?: string;
  itemNumber: number;
  quantity: string;
  sortOrder?: number;
  drawingReference?: string;
  roomOrZone?: string;
  overrides?: Partial<Pick<ResolvedDefaults, "itemCode" | "category" | "description" | "specification" | "unit" | "unitCost" | "marginMode" | "marginPercentage">>;
};

/**
 * CANVA-MODEL-1 — owner-authorized product-policy change: revenue
 * enforcement for premium MasterItems moves from "block at add-time" to
 * "gate at clean-output time." A company with no package/trial access can
 * still add a premium item to a working BOQ draft — this function no longer
 * calls assertMasterItemAccessEffective() or recordPremiumItemUnlock() (the
 * latter isn't just analytics: it enforces the legacy 5-item trial cap and
 * would still block a 6th premium item mid-draft, which the new model
 * forbids). Full provenance (sourceMasterItemId, sourceMasterItemVersionId,
 * masterItemSnapshotJson) is still captured exactly as before — that
 * provenance is the source of truth the commercial-requirements resolver
 * uses to gate the clean final export later. This never grants package
 * ownership, never creates a CompanyPackageSubscription, never mutates the
 * MasterItem/IndustryDataPackage, and never marks the item "purchased" —
 * it only allows the item to exist in the working draft. The
 * company-library copy path (createFromMaster) is a distinct feature and
 * keeps its own entitlement gate untouched.
 */
async function resolveMasterItemDefaults(actor: CurrentActor, masterItemId: string): Promise<ResolvedDefaults> {
  const master = await getMasterItemRecord(masterItemId);
  const discipline = await prisma.masterDiscipline.findUnique({ where: { id: master.disciplineId } });

  // MASTER-BOQ-1A BOQ snapshot behavior: capture the current published
  // version + classification/region at the moment this item is added, so
  // editing this BOQ line never touches the master item, and a later master
  // item edit never retroactively changes this already-created line.
  // Defensive: the MASTER-BOQ-1A tables ship in a code deploy that lands
  // before its `prisma migrate deploy` is run against production (Vercel's
  // build never runs migrations automatically) — until that migration runs,
  // fall back to no snapshot rather than breaking this core, previously-
  // working "add item to BOQ" action.
  let publishedVersion: { id: string; versionNumber: number; name: string; specificationTemplate: string; primaryUnit: string } | null = null;
  let classifications: unknown[] = [];
  let regionalApplicability: unknown[] = [];
  try {
    [publishedVersion, classifications, regionalApplicability] = await Promise.all([
      prisma.masterItemVersion.findFirst({ where: { masterItemId, status: "PUBLISHED" } }),
      prisma.masterItemClassification.findMany({ where: { masterItemId }, select: { system: true, code: true, label: true, isPrimary: true } }),
      prisma.masterItemRegionalApplicability.findMany({ where: { masterItemId }, select: { scope: true, countryCode: true } }),
    ]);
  } catch {
    // Tables not migrated yet — see comment above.
  }

  return {
    itemCode: master.itemCode,
    category: discipline?.name ?? "Uncategorized",
    description: publishedVersion?.name ?? master.name,
    specification: publishedVersion?.specificationTemplate || master.shortDescription,
    unit: publishedVersion?.primaryUnit ?? master.defaultUnit,
    unitCost: 0,
    marginMode: MarginMode.MARKUP,
    marginPercentage: 0,
    masterItemVersionId: publishedVersion?.id ?? null,
    masterItemSnapshotJson: {
      masterItemId,
      masterItemVersionId: publishedVersion?.id ?? null,
      versionNumber: publishedVersion?.versionNumber ?? null,
      itemCode: master.itemCode,
      classifications,
      regionalApplicability,
    },
  };
}

async function resolveLibraryItemDefaults(companyId: string, libraryItemId: string): Promise<ResolvedDefaults> {
  const item = await getLibraryItemRecord(companyId, libraryItemId);
  const discipline = item.disciplineId ? await prisma.masterDiscipline.findUnique({ where: { id: item.disciplineId } }) : null;
  return {
    itemCode: item.companyItemCode,
    category: discipline?.name ?? "Uncategorized",
    description: item.name,
    specification: item.description,
    unit: item.unit,
    unitCost: item.defaultCost.toNumber(),
    marginMode: item.defaultMarginMode,
    marginPercentage: item.defaultMargin.toNumber(),
  };
}

async function resolveCatalogueItemDefaults(companyId: string, rateCatalogueItemId: string): Promise<ResolvedDefaults> {
  const item = await prisma.rateCatalogueItem.findFirst({ where: { id: rateCatalogueItemId, companyId } });
  if (!item) throw new NotFoundError("Rate catalogue item not found.");
  return {
    itemCode: item.itemCode,
    category: item.category,
    description: item.description,
    specification: item.specification ?? "",
    unit: item.unit,
    unitCost: item.landedCost.toNumber(),
    marginMode: item.marginMode,
    marginPercentage: item.defaultMargin.toNumber(),
    rateCurrency: item.currency,
    rateEffectiveDate: item.effectiveDate,
    rateExpiryDate: item.expiryDate,
  };
}

async function resolvePreviousBoqItemDefaults(companyId: string, boqItemId: string): Promise<ResolvedDefaults> {
  const item = await prisma.bOQItem.findFirst({ where: { id: boqItemId, companyId } });
  if (!item) throw new NotFoundError("Source BOQ item not found.");
  return {
    itemCode: item.itemCode,
    category: item.category,
    description: item.description,
    specification: item.specification,
    unit: item.unit,
    unitCost: item.unitCost.toNumber(),
    marginMode: item.marginMode,
    marginPercentage: item.marginPercentage.toNumber(),
  };
}

/**
 * Copies an item from any source into a new, independent BOQItem, recording
 * provenance (sourceType + the relevant source id) without ever mutating the
 * source itself — the master item, company library item, catalogue rate,
 * and previous BOQ item are all left untouched (spec section 1/16/17).
 */
export async function addBoqItemFromSource(actor: CurrentActor, boqId: string, input: AddBoqItemFromSourceInput) {
  requireCapability(actor, "boq:edit");
  const boqRecord = await getBOQRecord(actor.companyId, boqId);
  const boq = await getBOQ(actor.companyId, boqId);
  const section = (input.sectionId ? boq.sections.find((s) => s.id === input.sectionId) : undefined) ?? boq.sections[0];
  if (!section) throw new AppError("NO_SECTIONS", "This BOQ has no sections to add an item to.", 409);

  let defaults: ResolvedDefaults = EMPTY_DEFAULTS;
  switch (input.sourceType) {
    case BoqItemSourceType.MASTER_ITEM:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolveMasterItemDefaults(actor, input.sourceId);
      break;
    case BoqItemSourceType.COMPANY_LIBRARY:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolveLibraryItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.RATE_CATALOGUE:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolveCatalogueItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.PREVIOUS_BOQ:
      if (!input.sourceId) throw new AppError("SOURCE_ID_REQUIRED", "sourceId is required for this source type.", 400);
      defaults = await resolvePreviousBoqItemDefaults(actor.companyId, input.sourceId);
      break;
    case BoqItemSourceType.MANUAL:
    case BoqItemSourceType.IMPORT:
    default:
      defaults = EMPTY_DEFAULTS;
      break;
  }

  const merged = { ...defaults, ...input.overrides };

  // Item creation, source-attribution stamping, and library-usage recording
  // are one logical write (a mid-flow crash used to leave a fully-priced
  // BOQItem silently mis-tagged sourceType: MANUAL with no source id/
  // snapshot — provenance lost even though the item and its price persisted)
  // — now one transaction, all-or-nothing.
  const updated = await prisma.$transaction(async (tx) => {
    const result = await createBOQItem(actor.companyId, section.id, {
      itemNumber: input.itemNumber,
      itemCode: merged.itemCode,
      category: merged.category,
      description: merged.description,
      specification: merged.specification,
      quantity: input.quantity,
      unit: merged.unit,
      unitCost: merged.unitCost,
      marginMode: merged.marginMode,
      marginPercentage: merged.marginPercentage,
      drawingReference: input.drawingReference,
      roomOrZone: input.roomOrZone,
      sortOrder: input.sortOrder,
    }, tx, { integrityActor: { userId: actor.userId, name: actor.fullName } });

    const item = await tx.bOQItem.update({
      where: { id: result.item.id, companyId: actor.companyId },
      data: {
        sourceType: input.sourceType,
        sourceMasterItemId: input.sourceType === BoqItemSourceType.MASTER_ITEM ? input.sourceId : null,
        sourceMasterItemVersionId: input.sourceType === BoqItemSourceType.MASTER_ITEM ? merged.masterItemVersionId ?? null : null,
        masterItemSnapshotJson: input.sourceType === BoqItemSourceType.MASTER_ITEM ? (merged.masterItemSnapshotJson as never) : undefined,
        sourceCompanyLibraryItemId: input.sourceType === BoqItemSourceType.COMPANY_LIBRARY ? input.sourceId : null,
        sourceCatalogueItemId: input.sourceType === BoqItemSourceType.RATE_CATALOGUE ? input.sourceId : null,
        sourcePreviousBoqItemId: input.sourceType === BoqItemSourceType.PREVIOUS_BOQ ? input.sourceId : null,
        copiedAt: new Date(),
        copiedByUserId: actor.userId,
      },
    });

    let rateSourceType: RateProvenanceSource = RateProvenanceSource.MANUAL_CONFIRMED;
    let sourceBoqItemRateProvenanceId: string | null = null;
    const hasCommercialOverride =
      input.overrides?.unitCost !== undefined ||
      input.overrides?.marginMode !== undefined ||
      input.overrides?.marginPercentage !== undefined;
    if (input.sourceType === BoqItemSourceType.RATE_CATALOGUE) {
      rateSourceType = RateProvenanceSource.RATE_CATALOGUE;
    } else if (input.sourceType === BoqItemSourceType.COMPANY_LIBRARY) {
      rateSourceType = RateProvenanceSource.COMPANY_LIBRARY;
    } else if (input.sourceType === BoqItemSourceType.PREVIOUS_BOQ && input.sourceId) {
      rateSourceType = RateProvenanceSource.PREVIOUS_BOQ;
      const sourceRate = await tx.bOQItemRateProvenance.findUnique({ where: { boqItemId: input.sourceId } });
      if (!sourceRate) throw new AppError("SOURCE_RATE_PROVENANCE_REQUIRED", "The source BOQ item has no rate provenance.", 409);
      sourceBoqItemRateProvenanceId = sourceRate.id;
    } else if (input.sourceType === BoqItemSourceType.IMPORT) {
      rateSourceType = RateProvenanceSource.IMPORT;
    } else if (input.sourceType === BoqItemSourceType.MASTER_ITEM) {
      rateSourceType = RateProvenanceSource.MASTER_ITEM;
    }
    if (hasCommercialOverride && input.sourceType !== BoqItemSourceType.MANUAL) {
      rateSourceType = RateProvenanceSource.MIXED_CONFIRMED;
    }
    await recordRateProvenance(tx, {
      companyId: actor.companyId,
      projectId: boqRecord.projectId,
      item,
      sourceType: rateSourceType,
      rateCatalogueItemId: input.sourceType === BoqItemSourceType.RATE_CATALOGUE ? input.sourceId : null,
      sourceBoqItemRateProvenanceId,
      currency: merged.rateCurrency,
      effectiveDate: merged.rateEffectiveDate,
      expiryDate: merged.rateExpiryDate,
      actor: { userId: actor.userId, name: actor.fullName },
    });

    if (input.sourceType === BoqItemSourceType.COMPANY_LIBRARY && input.sourceId) {
      await recordItemUsage(actor.companyId, input.sourceId, {
        projectId: boqRecord.projectId,
        boqId,
        boqItemId: item.id,
        usedByUserId: actor.userId,
      }, tx);
    }

    return item;
  });

  return { item: updated, boq: await getBOQ(actor.companyId, boqId) };
}
