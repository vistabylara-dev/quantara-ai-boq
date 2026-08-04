import type { MasterAttributeVerificationState, MasterClassificationSystem, MasterItemVersionStatus, MasterQuantityMethod, MasterRegionScope } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { AppError, NotFoundError, PermissionDeniedError } from "@/lib/errors/app-error";
import type { PlatformActor } from "@/lib/auth/platform-authorization";
import { recordPlatformActionAudit } from "@/lib/repositories/platform-action-audit-repository";
import { getMasterItemRecord } from "@/lib/repositories/master-item-repository";
import { getFieldDefinition } from "@/lib/repositories/master-taxonomy-repository";
import { getHierarchyAncestorChain } from "@/lib/repositories/master-hierarchy-repository";

/**
 * MASTER-BOQ-1A — owner-only governance actions on a MasterItem: versioning,
 * classification mapping, regional applicability, drawing/BIM profile, and
 * technical attribute values. Every mutation is audited (spec section 10).
 * Nothing here is reachable by a normal company user — see the API route
 * layer, which gates every one of these behind requirePlatformActor([OWNER]).
 */

function requireOwner(actor: PlatformActor): void {
  if (actor.platformRole !== "PLATFORM_OWNER") {
    throw new PermissionDeniedError("Master item administration is restricted to the platform owner.");
  }
}

function toVersionDTO(row: {
  id: string; masterItemId: string; versionNumber: number; status: MasterItemVersionStatus;
  effectiveDate: Date | null; supersededDate: Date | null; changeSummary: string; name: string;
  shortDescription: string; fullDescription: string; specificationTemplate: string; inclusionTemplate: string;
  exclusionTemplate: string; notesTemplate: string; primaryUnit: string; measurementMethod: string;
  quantityBasis: string; roundingRule: string; createdByUserId: string | null; reviewedByUserId: string | null;
  approvedByUserId: string | null; createdAt: Date; updatedAt: Date;
}) {
  return {
    id: row.id,
    masterItemId: row.masterItemId,
    versionNumber: row.versionNumber,
    status: row.status,
    effectiveDate: row.effectiveDate?.toISOString() ?? null,
    supersededDate: row.supersededDate?.toISOString() ?? null,
    changeSummary: row.changeSummary,
    name: row.name,
    shortDescription: row.shortDescription,
    fullDescription: row.fullDescription,
    specificationTemplate: row.specificationTemplate,
    inclusionTemplate: row.inclusionTemplate,
    exclusionTemplate: row.exclusionTemplate,
    notesTemplate: row.notesTemplate,
    primaryUnit: row.primaryUnit,
    measurementMethod: row.measurementMethod,
    quantityBasis: row.quantityBasis,
    roundingRule: row.roundingRule,
    createdByUserId: row.createdByUserId,
    reviewedByUserId: row.reviewedByUserId,
    approvedByUserId: row.approvedByUserId,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export type CreateDraftVersionInput = {
  name: string;
  shortDescription?: string;
  fullDescription?: string;
  specificationTemplate?: string;
  inclusionTemplate?: string;
  exclusionTemplate?: string;
  notesTemplate?: string;
  primaryUnit: string;
  measurementMethod?: string;
  quantityBasis?: string;
  roundingRule?: string;
  changeSummary?: string;
};

export async function createDraftVersion(owner: PlatformActor, masterItemId: string, input: CreateDraftVersionInput) {
  requireOwner(owner);
  await getMasterItemRecord(masterItemId);

  const latest = await prisma.masterItemVersion.findFirst({ where: { masterItemId }, orderBy: { versionNumber: "desc" } });
  const versionNumber = (latest?.versionNumber ?? 0) + 1;

  const created = await prisma.masterItemVersion.create({
    data: {
      masterItemId,
      versionNumber,
      status: "DRAFT",
      name: input.name,
      shortDescription: input.shortDescription ?? "",
      fullDescription: input.fullDescription ?? "",
      specificationTemplate: input.specificationTemplate ?? "",
      inclusionTemplate: input.inclusionTemplate ?? "",
      exclusionTemplate: input.exclusionTemplate ?? "",
      notesTemplate: input.notesTemplate ?? "",
      primaryUnit: input.primaryUnit,
      measurementMethod: input.measurementMethod ?? "",
      quantityBasis: input.quantityBasis ?? "",
      roundingRule: input.roundingRule ?? "",
      changeSummary: input.changeSummary ?? "",
      createdByUserId: owner.userId,
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_VERSION_DRAFT_CREATED",
    targetType: "MasterItemVersion",
    targetId: created.id,
    metadata: { masterItemId, versionNumber },
  });

  return toVersionDTO(created);
}

/**
 * DRAFT -> REVIEW -> APPROVED -> PUBLISHED. Publishing never deletes or
 * rewrites the previous PUBLISHED version — it transitions it to RETIRED
 * with a supersededDate, preserving it for any BOQ line that already
 * snapshotted it (spec: "published master items must not be destructively
 * overwritten").
 */
export async function transitionVersionStatus(owner: PlatformActor, versionId: string, nextStatus: MasterItemVersionStatus, reviewerNote?: string) {
  requireOwner(owner);
  const version = await prisma.masterItemVersion.findUnique({ where: { id: versionId } });
  if (!version) throw new NotFoundError("Master item version not found.");

  const allowedTransitions: Record<MasterItemVersionStatus, MasterItemVersionStatus[]> = {
    DRAFT: ["REVIEW"],
    REVIEW: ["APPROVED", "DRAFT"],
    APPROVED: ["PUBLISHED", "REVIEW"],
    PUBLISHED: ["RETIRED"],
    RETIRED: [],
  };
  if (!allowedTransitions[version.status].includes(nextStatus)) {
    throw new AppError("INVALID_VERSION_TRANSITION", `Cannot move a ${version.status} version to ${nextStatus}.`, 409);
  }

  const result = await prisma.$transaction(async (tx) => {
    if (nextStatus === "PUBLISHED") {
      const currentlyPublished = await tx.masterItemVersion.findFirst({
        where: { masterItemId: version.masterItemId, status: "PUBLISHED" },
      });
      if (currentlyPublished) {
        await tx.masterItemVersion.update({
          where: { id: currentlyPublished.id },
          data: { status: "RETIRED", supersededDate: new Date() },
        });
      }
      return tx.masterItemVersion.update({
        where: { id: versionId },
        data: { status: "PUBLISHED", effectiveDate: new Date(), approvedByUserId: owner.userId },
      });
    }
    return tx.masterItemVersion.update({
      where: { id: versionId },
      data: {
        status: nextStatus,
        reviewedByUserId: nextStatus === "REVIEW" || nextStatus === "APPROVED" ? owner.userId : version.reviewedByUserId,
        changeSummary: reviewerNote ?? version.changeSummary,
      },
    });
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_VERSION_STATUS_CHANGED",
    targetType: "MasterItemVersion",
    targetId: versionId,
    metadata: { masterItemId: version.masterItemId, from: version.status, to: nextStatus },
  });

  return toVersionDTO(result);
}

export async function listVersionsForItem(owner: PlatformActor, masterItemId: string) {
  requireOwner(owner);
  const rows = await prisma.masterItemVersion.findMany({ where: { masterItemId }, orderBy: { versionNumber: "desc" } });
  return rows.map(toVersionDTO);
}

export async function getCurrentPublishedVersion(masterItemId: string) {
  const row = await prisma.masterItemVersion.findFirst({ where: { masterItemId, status: "PUBLISHED" } });
  return row ? toVersionDTO(row) : null;
}

export async function retireMasterItem(owner: PlatformActor, masterItemId: string, replacementItemId?: string | null) {
  requireOwner(owner);
  await getMasterItemRecord(masterItemId);
  if (replacementItemId) await getMasterItemRecord(replacementItemId);

  const updated = await prisma.masterItem.update({
    where: { id: masterItemId },
    data: { status: "DEPRECATED", replacementItemId: replacementItemId ?? null },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_RETIRED",
    targetType: "MasterItem",
    targetId: masterItemId,
    metadata: { replacementItemId: replacementItemId ?? null },
  });

  return updated;
}

export type AddClassificationInput = {
  system: MasterClassificationSystem;
  code: string;
  label?: string;
  version?: string;
  isPrimary?: boolean;
  source?: string;
};

/** Upsert on (masterItemId, system, code) — calling twice with the same triple updates in place rather than duplicating. */
export async function addClassification(owner: PlatformActor, masterItemId: string, input: AddClassificationInput) {
  requireOwner(owner);
  await getMasterItemRecord(masterItemId);

  const row = await prisma.masterItemClassification.upsert({
    where: { masterItemId_system_code: { masterItemId, system: input.system, code: input.code } },
    update: { label: input.label ?? "", version: input.version ?? "", isPrimary: input.isPrimary ?? false, source: input.source ?? "" },
    create: {
      masterItemId,
      system: input.system,
      code: input.code,
      label: input.label ?? "",
      version: input.version ?? "",
      isPrimary: input.isPrimary ?? false,
      source: input.source ?? "",
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_CLASSIFICATION_SET",
    targetType: "MasterItem",
    targetId: masterItemId,
    metadata: { system: input.system, code: input.code },
  });

  return row;
}

export type AddRegionalApplicabilityInput = {
  scope: MasterRegionScope;
  countryCode?: string | null;
  effectiveFrom?: string | null;
  effectiveTo?: string | null;
};

export async function addRegionalApplicability(owner: PlatformActor, masterItemId: string, input: AddRegionalApplicabilityInput) {
  requireOwner(owner);
  await getMasterItemRecord(masterItemId);

  const row = await prisma.masterItemRegionalApplicability.upsert({
    where: { masterItemId_scope_countryCode: { masterItemId, scope: input.scope, countryCode: input.countryCode ?? "" } },
    update: {
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    },
    create: {
      masterItemId,
      scope: input.scope,
      countryCode: input.countryCode ?? "",
      effectiveFrom: input.effectiveFrom ? new Date(input.effectiveFrom) : null,
      effectiveTo: input.effectiveTo ? new Date(input.effectiveTo) : null,
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_REGION_SET",
    targetType: "MasterItem",
    targetId: masterItemId,
    metadata: { scope: input.scope, countryCode: input.countryCode ?? "" },
  });

  return row;
}

export type DrawingProfileInput = {
  drawingTypes?: string[];
  scheduleTypes?: string[];
  symbolReference?: string;
  cadLayerReference?: string;
  ifcClass?: string;
  revitCategory?: string;
  roomSpaceTypes?: string[];
  quantityMethod?: MasterQuantityMethod;
};

export async function upsertDrawingProfile(owner: PlatformActor, masterItemId: string, input: DrawingProfileInput) {
  requireOwner(owner);
  await getMasterItemRecord(masterItemId);

  const data = {
    drawingTypesJson: input.drawingTypes as never,
    scheduleTypesJson: input.scheduleTypes as never,
    symbolReference: input.symbolReference,
    cadLayerReference: input.cadLayerReference,
    ifcClass: input.ifcClass,
    revitCategory: input.revitCategory,
    roomSpaceTypesJson: input.roomSpaceTypes as never,
    quantityMethod: input.quantityMethod,
  };

  const row = await prisma.masterItemDrawingProfile.upsert({
    where: { masterItemId },
    update: data,
    create: { masterItemId, ...data },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_DRAWING_PROFILE_SET",
    targetType: "MasterItem",
    targetId: masterItemId,
    metadata: { quantityMethod: input.quantityMethod ?? null },
  });

  return row;
}

export type SetAttributeValueInput = {
  masterItemId?: string;
  variantId?: string;
  fieldDefinitionId: string;
  valueText?: string;
  valueNumber?: number;
  valueBoolean?: boolean;
  valueDate?: string;
  unit?: string;
  source?: string;
  verificationState?: MasterAttributeVerificationState;
};

/** Typed validation against the attribute definition's fieldType/enum options/allowed units before writing. */
export async function setAttributeValue(owner: PlatformActor, input: SetAttributeValueInput) {
  requireOwner(owner);
  if (!input.masterItemId && !input.variantId) {
    throw new AppError("ATTRIBUTE_TARGET_REQUIRED", "Either masterItemId or variantId is required.", 400);
  }
  if (input.masterItemId && input.variantId) {
    throw new AppError("ATTRIBUTE_TARGET_AMBIGUOUS", "Provide only one of masterItemId or variantId, not both.", 400);
  }
  if (input.masterItemId) await getMasterItemRecord(input.masterItemId);

  const definition = await getFieldDefinition(input.fieldDefinitionId);

  if (["SELECT", "MULTI_SELECT"].includes(definition.fieldType) && input.valueText) {
    const options = Array.isArray(definition.optionsJson) ? (definition.optionsJson as string[]) : [];
    if (options.length > 0 && !options.includes(input.valueText)) {
      throw new AppError("INVALID_ENUM_VALUE", `"${input.valueText}" is not one of this attribute's allowed options.`, 400);
    }
  }
  if (input.unit && Array.isArray(definition.allowedUnitsJson)) {
    const allowedUnits = definition.allowedUnitsJson as string[];
    if (allowedUnits.length > 0 && !allowedUnits.includes(input.unit)) {
      throw new AppError("INVALID_UNIT", `"${input.unit}" is not an allowed unit for this attribute.`, 400);
    }
  }
  if (definition.isRequired && input.valueText === undefined && input.valueNumber === undefined && input.valueBoolean === undefined && input.valueDate === undefined) {
    throw new AppError("VALUE_REQUIRED", "This attribute requires a value.", 400);
  }

  const row = await prisma.masterItemAttributeValue.create({
    data: {
      masterItemId: input.masterItemId ?? null,
      variantId: input.variantId ?? null,
      fieldDefinitionId: input.fieldDefinitionId,
      valueText: input.valueText,
      valueNumber: input.valueNumber,
      valueBoolean: input.valueBoolean,
      valueDate: input.valueDate ? new Date(input.valueDate) : undefined,
      unit: input.unit,
      source: input.source ?? "",
      verificationState: input.verificationState ?? "UNVERIFIED",
    },
  });

  await recordPlatformActionAudit({
    actorUserId: owner.userId,
    actorPlatformRole: owner.platformRole,
    action: "MASTER_ITEM_ATTRIBUTE_VALUE_SET",
    targetType: "MasterItem",
    targetId: input.masterItemId ?? input.variantId ?? null,
    metadata: { fieldDefinitionId: input.fieldDefinitionId },
  });

  return row;
}

/** Full detail for the owner-only admin surface — everything a customer detail view withholds. */
export async function getMasterItemAdminDetail(owner: PlatformActor, masterItemId: string) {
  requireOwner(owner);
  const item = await getMasterItemRecord(masterItemId);
  const [versions, classifications, regionalApplicability, drawingProfile, attributeValues, breadcrumb] = await Promise.all([
    prisma.masterItemVersion.findMany({ where: { masterItemId }, orderBy: { versionNumber: "desc" } }),
    prisma.masterItemClassification.findMany({ where: { masterItemId } }),
    prisma.masterItemRegionalApplicability.findMany({ where: { masterItemId } }),
    prisma.masterItemDrawingProfile.findUnique({ where: { masterItemId } }),
    prisma.masterItemAttributeValue.findMany({ where: { masterItemId }, include: { fieldDefinition: true } }),
    item.hierarchyNodeId ? getHierarchyAncestorChain(item.hierarchyNodeId) : Promise.resolve([]),
  ]);

  return {
    item,
    versions: versions.map(toVersionDTO),
    classifications,
    regionalApplicability,
    drawingProfile,
    attributeValues,
    hierarchyBreadcrumb: breadcrumb,
  };
}
