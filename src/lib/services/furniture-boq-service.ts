import {
  BOQItemStatus,
  BOQStatus,
  BoqItemSourceType,
  ExtractedEntityStatus,
  MarginMode,
  Prisma,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { calculateTotalAmount } from "@/lib/calculations/boq-calculator";
import { prisma } from "@/lib/db/prisma";
import { AppError, ConflictError, NotFoundError } from "@/lib/errors/app-error";
import {
  buildFurnitureCanonicalOutput,
  FURNITURE_CANONICAL_OUTPUT_VERSION,
  type ConfirmedFurnitureCandidate,
  type ConfirmedFurnitureOrderItem,
  type FurnitureCanonicalItem,
  type FurnitureCanonicalOutput,
  type FurnitureCanonicalSectionCode,
} from "@/lib/furniture/canonical-output";
import type { FurniturePartCandidate } from "@/lib/furniture/candidate-mapper";
import {
  FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
  type FurnitureOrderItemCandidate,
} from "@/lib/furniture/order-item-mapper";
import {
  FURNITURE_MANAGED_ITEM_CODE_PREFIX,
  FURNITURE_MANAGED_SOURCE_PREFIX,
  FurnitureDiscipline,
  JOINERY_INDUSTRY_KEY,
  furnitureManagedItemCodeForKey,
  isStrictFurnitureManagedNonCommercialRow,
  readStrictFurnitureManagedKey,
} from "@/lib/furniture/types";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import {
  confirmManualRateProvenance,
  confirmManualQuantityProvenance,
  recordReviewedExtractionQuantity,
} from "@/lib/services/estimate-integrity-service";
import { FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND } from "@/lib/services/furniture-candidate-service";

export const FURNITURE_MANAGED_ROW_VERSION = 1 as const;
export {
  FURNITURE_MANAGED_ITEM_CODE_PREFIX,
  FURNITURE_MANAGED_SOURCE_PREFIX,
} from "@/lib/furniture/types";

const BOQ_SOURCE_REFERENCE_MAX_LENGTH = 500;
const CALLER_OWNED_WASTAGE_ASSUMPTION_KEY = "assumption:wastage";
const FURNITURE_SECTION_TITLES: Record<FurnitureCanonicalSectionCode, string> = {
  PRJ: "PROJECT SUMMARY",
  BRD: "BOARD / SHEET MATERIAL — ORDER QUANTITIES",
  HWA: "HARDWARE & ACCESSORIES — ORDER QUANTITIES",
  CUT: "FULL CUTTING LIST — ALL ROOMS",
  VER: "NOTES, ASSUMPTIONS & VERIFICATION ITEMS",
};

type FurnitureCandidateEnvelope = {
  kind: typeof FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND;
  candidate: FurniturePartCandidate;
};

export type ExistingFurnitureManagedBOQItem = {
  id: string;
  sectionId: string;
  sectionCode: string;
  sourceType?: BoqItemSourceType;
  itemCode: string;
  sourceReference: string;
  category: string;
  description: string;
  specification: string;
  quantity: Prisma.Decimal;
  unit: string;
  wastagePercentage: Prisma.Decimal;
  roomOrZone: string;
  drawingReference: string;
  confidenceScore: Prisma.Decimal;
  notes: string;
  itemNumber: number;
  sortOrder: number;
  sellingRate: Prisma.Decimal;
  unitCost?: Prisma.Decimal;
  freightCost?: Prisma.Decimal;
  installationCost?: Prisma.Decimal;
  additionalCost?: Prisma.Decimal;
  landedCost?: Prisma.Decimal;
  marginMode?: MarginMode;
  marginPercentage?: Prisma.Decimal;
  rateProvenance?: {
    sourceType: string;
    confirmedAt: Date | null;
  } | null;
  createdAt: Date;
};

type ExistingBOQSection = {
  id: string;
  code: string;
  title: string;
  description: string;
  sortOrder: number;
};

export type FurnitureManagedMutationPlan = {
  create: FurnitureCanonicalItem[];
  update: Array<{ id: string; item: FurnitureCanonicalItem }>;
  deleteIds: string[];
  unchangedIds: string[];
  manualOrUnmarkedIds: string[];
};

export type RegenerateFurnitureManagedBOQInput = {
  projectIdentifier: string;
  boqId: string;
  /** Required caller-owned setting. The exported UI default is 10%. */
  wastagePercentage: number;
  /** Immutable autonomous operation identity. Human-triggered generation omits it. */
  systemValidatedOperationHash?: string;
};

export type RegenerateFurnitureManagedBOQResult = {
  changed: boolean;
  boqId: string;
  projectId: string;
  output: FurnitureCanonicalOutput;
  createdItems: number;
  updatedItems: number;
  removedManagedItems: number;
  preservedManualItems: number;
};

// Large governed workbooks persist every managed row plus quantity provenance.
// Keep the serializable transaction bounded while allowing the audited bulk
// generation path to complete on managed Postgres.
export const FURNITURE_MANAGED_BOQ_TRANSACTION_TIMEOUT_MS = 30_000;

export function furnitureManagedItemCode(managedKey: string): string {
  return furnitureManagedItemCodeForKey(managedKey);
}

export function furnitureManagedSourceReference(item: FurnitureCanonicalItem): string {
  const marker = `${FURNITURE_MANAGED_SOURCE_PREFIX}${encodeURIComponent(item.managedKey)}]`;
  if (marker.length > BOQ_SOURCE_REFERENCE_MAX_LENGTH) {
    throw new AppError(
      "FURNITURE_MANAGED_KEY_TOO_LONG",
      "The managed furniture row identity is too long for a BOQ source reference.",
      409,
    );
  }
  const sources = uniqueStrings(item.evidence.sourceReferences.map((source) => source.trim()).filter(Boolean));
  if (sources.length === 0) return marker;

  const remaining = BOQ_SOURCE_REFERENCE_MAX_LENGTH - marker.length - 1;
  if (remaining <= 0) return marker;
  const more = sources.length > 1 ? ` (+${sources.length - 1} more)` : "";
  const firstSourceLength = Math.max(0, remaining - more.length);
  const firstSource = sources[0].slice(0, firstSourceLength);
  const conciseSummary = `${firstSource}${more}`.slice(0, remaining).trim();
  return conciseSummary ? `${marker} ${conciseSummary}` : marker;
}

export function readFurnitureManagedKey(
  item: Pick<ExistingFurnitureManagedBOQItem, "itemCode" | "sourceReference"> & { notes?: string },
): string | null {
  return readStrictFurnitureManagedKey({
    itemCode: item.itemCode,
    sourceReference: item.sourceReference,
    notes: item.notes ?? "",
  });
}

export function furnitureManagedNotes(item: FurnitureCanonicalItem): string {
  const marker = `${FURNITURE_MANAGED_SOURCE_PREFIX}${encodeURIComponent(item.managedKey)}]`;
  const evidence = [
    item.evidence.extractedEntityIds.length > 0
      ? `Extracted entities: ${item.evidence.extractedEntityIds.join(", ")}`
      : "",
    item.evidence.candidateIds.length > 0 ? `Candidates: ${item.evidence.candidateIds.join(", ")}` : "",
    item.evidence.sourceFileIds.length > 0 ? `Source files: ${item.evidence.sourceFileIds.join(", ")}` : "",
    item.evidence.sourceFileNames.length > 0
      ? `Source file names: ${item.evidence.sourceFileNames.join(", ")}`
      : "",
    item.evidence.sourceReferences.length > 0
      ? `Source references: ${item.evidence.sourceReferences.join(" | ")}`
      : "",
    item.evidence.sourceCellReferences.length > 0
      ? `Source cells: ${item.evidence.sourceCellReferences.join(", ")}`
      : "",
    item.evidence.confirmationTimestamps.length > 0
      ? `Confirmed at: ${item.evidence.confirmationTimestamps.join(", ")}`
      : "",
    item.evidence.sourceMethods.length > 0
      ? `Source methods: ${item.evidence.sourceMethods.join(", ")}`
      : "",
  ].filter(Boolean).join("\n");
  const sectionTitle = FURNITURE_SECTION_TITLES[item.sectionCode];
  const measurementRule = item.sectionCode === "BRD"
    ? "specialized-sheet-optimization"
    : item.unit === "lm"
      ? "specialized-linear-edge"
      : "specialized-verified-count";
  const categoryPath = `Category path: joinery → Joinery → Cabinet drawing → Kitchen cabinetry → ${sectionTitle} → ${item.description} → ${measurementRule} → ${item.unit}`;
  return [marker, item.notes, categoryPath, evidence].filter(Boolean).join("\n");
}

function sameGeneratedFields(current: ExistingFurnitureManagedBOQItem, item: FurnitureCanonicalItem, index: number): boolean {
  return current.sectionCode === item.sectionCode
    && current.itemCode === furnitureManagedItemCode(item.managedKey)
    && current.sourceReference === furnitureManagedSourceReference(item)
    && current.category === item.category
    && current.description === item.description
    && current.specification === item.specification
    && current.quantity.equals(item.quantity)
    && current.unit === item.unit
    && current.wastagePercentage.equals(item.wastagePercentage)
    && current.roomOrZone === item.roomOrZone
    && current.drawingReference === item.drawingReference
    && current.confidenceScore.equals(item.confidenceScore)
    && current.notes === furnitureManagedNotes(item)
    && current.itemNumber === 10_000 + index
    && current.sortOrder === 10_000 + index;
}

/**
 * Pure reconciliation plan. Only rows carrying both matching managed markers
 * participate; every other row is returned as manual/unmarked and untouched.
 */
export function planFurnitureManagedRows(
  existingItems: readonly ExistingFurnitureManagedBOQItem[],
  desiredItems: readonly FurnitureCanonicalItem[],
): FurnitureManagedMutationPlan {
  const managedByKey = new Map<string, ExistingFurnitureManagedBOQItem[]>();
  const manualOrUnmarkedIds: string[] = [];
  for (const current of existingItems) {
    const key = readFurnitureManagedKey(current);
    if (!key) {
      manualOrUnmarkedIds.push(current.id);
      continue;
    }
    const rows = managedByKey.get(key) ?? [];
    rows.push(current);
    managedByKey.set(key, rows);
  }
  for (const rows of managedByKey.values()) {
    rows.sort((left, right) => left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id));
  }

  const create: FurnitureCanonicalItem[] = [];
  const update: Array<{ id: string; item: FurnitureCanonicalItem }> = [];
  const deleteIds: string[] = [];
  const unchangedIds: string[] = [];
  const desiredKeys = new Set(desiredItems.map((item) => item.managedKey));
  const sectionIndexes = new Map<FurnitureCanonicalSectionCode, number>();
  for (const desired of desiredItems) {
    const index = sectionIndexes.get(desired.sectionCode) ?? 0;
    sectionIndexes.set(desired.sectionCode, index + 1);
    const matches = managedByKey.get(desired.managedKey) ?? [];
    const keeper = chooseManagedDuplicateKeeper(desired.managedKey, matches);
    if (!keeper) create.push(desired);
    else if (sameGeneratedFields(keeper, desired, index)) unchangedIds.push(keeper.id);
    else update.push({ id: keeper.id, item: desired });
    deleteIds.push(...matches.filter((row) => row.id !== keeper?.id).map((row) => row.id));
  }
  for (const [managedKey, rows] of managedByKey) {
    if (!desiredKeys.has(managedKey)) deleteIds.push(...rows.map((row) => row.id));
  }
  return { create, update, deleteIds: uniqueStrings(deleteIds), unchangedIds, manualOrUnmarkedIds };
}

function commercialPricingSnapshot(item: ExistingFurnitureManagedBOQItem): string {
  return [
    item.unitCost,
    item.freightCost,
    item.installationCost,
    item.additionalCost,
    item.landedCost,
    item.marginMode,
    item.marginPercentage,
    item.sellingRate,
  ].map((value) => value instanceof Prisma.Decimal ? value.toString() : String(value ?? "")).join("|");
}

function hasNonzeroCommercialPricing(item: ExistingFurnitureManagedBOQItem): boolean {
  return [
    item.unitCost,
    item.freightCost,
    item.installationCost,
    item.additionalCost,
    item.landedCost,
    item.marginPercentage,
    item.sellingRate,
  ].some((value) => value !== undefined && new Prisma.Decimal(value).greaterThan(0));
}

function hasConfirmedCommercialPricing(item: ExistingFurnitureManagedBOQItem): boolean {
  return Boolean(
    item.rateProvenance?.confirmedAt
    && item.rateProvenance.sourceType !== "LEGACY_UNVERIFIED",
  );
}

function chooseManagedDuplicateKeeper(
  managedKey: string,
  rows: readonly ExistingFurnitureManagedBOQItem[],
): ExistingFurnitureManagedBOQItem | undefined {
  if (rows.length <= 1) return rows[0];
  const priced = rows.filter((row) => hasConfirmedCommercialPricing(row) || hasNonzeroCommercialPricing(row));
  const distinctPricedSnapshots = new Set(priced.map(commercialPricingSnapshot));
  if (distinctPricedSnapshots.size > 1) {
    throw new ConflictError(
      "FURNITURE_MANAGED_PRICING_CONFLICT",
      `Managed furniture row ${managedKey} has duplicates with different commercial pricing. Resolve them before regeneration.`,
    );
  }
  return [...rows].sort((left, right) => {
    const confirmedDifference = Number(hasConfirmedCommercialPricing(right)) - Number(hasConfirmedCommercialPricing(left));
    if (confirmedDifference !== 0) return confirmedDifference;
    const pricedDifference = Number(hasNonzeroCommercialPricing(right)) - Number(hasNonzeroCommercialPricing(left));
    if (pricedDifference !== 0) return pricedDifference;
    return left.createdAt.getTime() - right.createdAt.getTime() || left.id.localeCompare(right.id);
  })[0];
}

function uniqueStrings(values: readonly string[]): string[] {
  return [...new Set(values)];
}

function asJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

function parseCandidate(value: Prisma.JsonValue): FurniturePartCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("FURNITURE_CANDIDATE_INVALID", "A confirmed furniture candidate has invalid data.", 409);
  }
  const envelope = value as unknown as Partial<FurnitureCandidateEnvelope>;
  const candidate = envelope.candidate as Partial<FurniturePartCandidate> | undefined;
  if (
    envelope.kind !== FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND
    || !candidate
    || typeof candidate.candidateId !== "string"
    || typeof candidate.part !== "string"
    || typeof candidate.room !== "string"
    || !candidate.dimensions
    || !candidate.evidence
  ) {
    throw new AppError("FURNITURE_CANDIDATE_INVALID", "A confirmed furniture candidate has invalid data.", 409);
  }
  return candidate as FurniturePartCandidate;
}

function parseOrderItemCandidate(value: Prisma.JsonValue): FurnitureOrderItemCandidate {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new AppError("FURNITURE_ORDER_ITEM_INVALID", "A confirmed furniture order item has invalid data.", 409);
  }
  const envelope = value as Record<string, unknown>;
  const candidate = envelope.candidate;
  if (
    envelope.kind !== FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND
    || !candidate
    || typeof candidate !== "object"
    || Array.isArray(candidate)
  ) {
    throw new AppError("FURNITURE_ORDER_ITEM_INVALID", "A confirmed furniture order item has invalid data.", 409);
  }
  const record = candidate as Partial<FurnitureOrderItemCandidate>;
  if (typeof record.id !== "string" || typeof record.description !== "string" || !record.evidence) {
    throw new AppError("FURNITURE_ORDER_ITEM_INVALID", "A confirmed furniture order item has invalid data.", 409);
  }
  return record as FurnitureOrderItemCandidate;
}

function assertAutonomousOperationHash(value: string): void {
  if (!/^[a-f0-9]{64}$/i.test(value)) {
    throw new AppError(
      "AUTONOMOUS_JOINERY_IDENTITY_INVALID",
      "System-validated Joinery assembly requires an immutable operation hash.",
      409,
    );
  }
}

function systemValidatableCandidate(candidate: FurniturePartCandidate): boolean {
  return candidate.evidence.method.length > 0
    && candidate.evidence.sourceFileId !== null
    && candidate.verificationStatus !== "BLOCKED"
    && candidate.issues.every((issue) => issue.severity !== "BLOCKING");
}

function systemValidatableOrderItem(candidate: FurnitureOrderItemCandidate): boolean {
  return candidate.evidence.method.length > 0
    && candidate.evidence.sourceFileId !== null
    && candidate.verificationStatus !== "BLOCKED"
    && candidate.issues.every((issue) => issue.severity !== "BLOCKING");
}

function canonicalItemsForSection(output: FurnitureCanonicalOutput, code: FurnitureCanonicalSectionCode) {
  return output.sections.find((section) => section.code === code)?.items ?? [];
}

function sectionNeedsUpdate(existing: ExistingBOQSection | undefined, desired: FurnitureCanonicalOutput["sections"][number]) {
  return !existing
    || existing.title !== desired.title
    || existing.description !== desired.description
    || existing.sortOrder !== desired.sortOrder;
}

function itemCreateData(
  companyId: string,
  sectionId: string,
  item: FurnitureCanonicalItem,
  index: number,
): Prisma.BOQItemUncheckedCreateInput {
  return {
    companyId,
    sectionId,
    itemNumber: 10_000 + index,
    itemCode: furnitureManagedItemCode(item.managedKey),
    category: item.category,
    description: item.description,
    specification: item.specification,
    quantity: new Prisma.Decimal(item.quantity),
    unit: item.unit,
    unitCost: new Prisma.Decimal(0),
    freightCost: new Prisma.Decimal(0),
    installationCost: new Prisma.Decimal(0),
    additionalCost: new Prisma.Decimal(0),
    landedCost: new Prisma.Decimal(0),
    marginMode: MarginMode.MARKUP,
    marginPercentage: new Prisma.Decimal(0),
    sellingRate: new Prisma.Decimal(0),
    totalAmount: new Prisma.Decimal(0),
    wastagePercentage: new Prisma.Decimal(item.wastagePercentage),
    taxApplicable: true,
    sourceReference: furnitureManagedSourceReference(item),
    roomOrZone: item.roomOrZone,
    drawingReference: item.drawingReference,
    confidenceScore: new Prisma.Decimal(item.confidenceScore),
    status: BOQItemStatus.NEEDS_REVIEW,
    notes: furnitureManagedNotes(item),
    sortOrder: 10_000 + index,
    sourceType: BoqItemSourceType.IMPORT,
  };
}

export async function recordFurnitureManagedQuantityProvenance(
  tx: Prisma.TransactionClient,
  companyId: string,
  projectId: string,
  persistedItem: Prisma.BOQItemGetPayload<Record<string, never>>,
  canonicalItem: FurnitureCanonicalItem,
  actor: CurrentActor,
): Promise<void> {
  const integrityActor = { userId: actor.userId, name: actor.fullName };
  const extractedEntityId = canonicalItem.evidence.extractedEntityIds[0];
  const projectFileId = canonicalItem.evidence.sourceFileIds[0];
  if (extractedEntityId && projectFileId) {
    await recordReviewedExtractionQuantity(tx, {
      companyId,
      projectId,
      item: persistedItem,
      extractedEntityId,
      projectFileId,
      actor: integrityActor,
    });
  } else if (
    canonicalItem.managedKey === CALLER_OWNED_WASTAGE_ASSUMPTION_KEY
    && canonicalItem.category === "ASSUMPTION"
  ) {
    await confirmManualQuantityProvenance(tx, companyId, projectId, persistedItem, integrityActor);
  } else {
    throw new AppError(
      "FURNITURE_QUANTITY_EVIDENCE_REQUIRED",
      `Managed furniture row ${canonicalItem.managedKey} has no reviewed extraction evidence for its quantity.`,
      409,
    );
  }

  if (isStrictFurnitureManagedNonCommercialRow({
    industryKey: JOINERY_INDUSTRY_KEY,
    sectionCode: canonicalItem.sectionCode,
    category: canonicalItem.category,
    sourceType: BoqItemSourceType.IMPORT,
    itemCode: furnitureManagedItemCode(canonicalItem.managedKey),
    sourceReference: furnitureManagedSourceReference(canonicalItem),
    notes: furnitureManagedNotes(canonicalItem),
  })) {
    await confirmManualRateProvenance(tx, companyId, projectId, persistedItem, integrityActor);
  }
}

export function buildFurnitureManagedItemUpdate(
  current: ExistingFurnitureManagedBOQItem,
  item: FurnitureCanonicalItem,
  index: number,
): Prisma.BOQItemUpdateManyMutationInput {
  return {
    itemNumber: 10_000 + index,
    itemCode: furnitureManagedItemCode(item.managedKey),
    category: item.category,
    description: item.description,
    specification: item.specification,
    quantity: new Prisma.Decimal(item.quantity),
    unit: item.unit,
    // Commercial rate inputs and sellingRate stay byte-for-byte unchanged.
    // Only the quantity extension is recalculated from the preserved rate.
    totalAmount: calculateTotalAmount(item.quantity, current.sellingRate),
    wastagePercentage: new Prisma.Decimal(item.wastagePercentage),
    sourceReference: furnitureManagedSourceReference(item),
    roomOrZone: item.roomOrZone,
    drawingReference: item.drawingReference,
    confidenceScore: new Prisma.Decimal(item.confidenceScore),
    status: BOQItemStatus.NEEDS_REVIEW,
    notes: furnitureManagedNotes(item),
    sortOrder: 10_000 + index,
  };
}

/**
 * Rebuilds only explicitly managed rows for one tenant-owned Joinery
 * project/BOQ. The serializable transaction and version claim make
 * concurrent runs fail closed rather than creating duplicate rows.
 */
export async function regenerateFurnitureManagedBOQ(
  actor: CurrentActor,
  input: RegenerateFurnitureManagedBOQInput,
): Promise<RegenerateFurnitureManagedBOQResult> {
  requireCapability(actor, "boq:edit");
  try {
    return await prisma.$transaction(async (tx) => {
    const project = await getProjectRecord(actor.companyId, input.projectIdentifier, tx);
    if (project.industryEngine.key !== JOINERY_INDUSTRY_KEY) {
      throw new AppError(
        "FURNITURE_PROJECT_REQUIRED",
        "Managed cutting-list output is available only for Joinery projects.",
        400,
      );
    }
    const discipline = FurnitureDiscipline.JOINERY_CABINETRY;
    const entities = await tx.extractedEntity.findMany({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        categoryKey: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
        status: { not: ExtractedEntityStatus.REJECTED },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        confirmedAt: true,
        updatedAt: true,
        technicalDataJson: true,
      },
    });
    let systemValidatedCandidateCount = 0;
    if (input.systemValidatedOperationHash) {
      assertAutonomousOperationHash(input.systemValidatedOperationHash);
      for (const entity of entities) {
        if (entity.status === ExtractedEntityStatus.CONFIRMED && entity.confirmedAt) continue;
        const candidate = parseCandidate(entity.technicalDataJson);
        if (!systemValidatableCandidate(candidate)) continue;
        const validatedAt = new Date();
        const approved: FurniturePartCandidate = {
          ...candidate,
          verificationStatus: "APPROVED_LOCKED",
        };
        const claimed = await tx.extractedEntity.updateMany({
          where: {
            id: entity.id,
            companyId: actor.companyId,
            projectId: project.id,
            status: { in: [ExtractedEntityStatus.EXTRACTED, ExtractedEntityStatus.NEEDS_REVIEW, ExtractedEntityStatus.CORRECTED] },
            updatedAt: entity.updatedAt,
          },
          data: {
            technicalDataJson: asJson({ kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND, candidate: approved }),
            status: ExtractedEntityStatus.CONFIRMED,
            confirmedByUserId: null,
            confirmedAt: validatedAt,
            correctionJson: asJson({
              schemaVersion: "autonomous-joinery-validation-v1",
              validationType: "SYSTEM_VALIDATED",
              operationHash: input.systemValidatedOperationHash,
              validatedAt: validatedAt.toISOString(),
              retainedReviewIssues: approved.issues.map((issue) => issue.code),
            }),
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A Joinery candidate changed during deterministic validation.");
        }
        entity.status = ExtractedEntityStatus.CONFIRMED;
        entity.confirmedAt = validatedAt;
        entity.technicalDataJson = asJson({
          kind: FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
          candidate: approved,
        }) as unknown as Prisma.JsonValue;
        systemValidatedCandidateCount += 1;
      }
    }
    if (entities.length === 0) {
      throw new AppError(
        "FURNITURE_CONFIRMED_CANDIDATES_REQUIRED",
        "Confirm at least one furniture candidate before generating the managed BOQ and cutting list.",
        409,
      );
    }
    if (entities.some((entity) => entity.status !== ExtractedEntityStatus.CONFIRMED || !entity.confirmedAt)) {
      throw new AppError(
        "FURNITURE_CANDIDATES_REQUIRE_REVIEW",
        "Review and lock every furniture part candidate before generating the managed BOQ and cutting list.",
        409,
      );
    }
    const confirmedCandidates: ConfirmedFurnitureCandidate[] = entities.map((entity) => {
      if (entity.status !== ExtractedEntityStatus.CONFIRMED || !entity.confirmedAt) {
        throw new AppError(
          "FURNITURE_CONFIRMED_CANDIDATES_REQUIRED",
          "Only confirmed furniture candidates can be generated.",
          409,
        );
      }
      return {
        entityId: entity.id,
        status: "CONFIRMED",
        confirmedAt: entity.confirmedAt.toISOString(),
        updatedAt: entity.updatedAt.toISOString(),
        candidate: parseCandidate(entity.technicalDataJson),
      };
    });
    const orderEntities = await tx.extractedEntity.findMany({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        categoryKey: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
        status: { not: ExtractedEntityStatus.REJECTED },
      },
      orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      select: {
        id: true,
        status: true,
        confirmedAt: true,
        updatedAt: true,
        technicalDataJson: true,
      },
    });
    let systemValidatedOrderItemCount = 0;
    if (input.systemValidatedOperationHash) {
      for (const entity of orderEntities) {
        if (entity.status === ExtractedEntityStatus.CONFIRMED && entity.confirmedAt) continue;
        const candidate = parseOrderItemCandidate(entity.technicalDataJson);
        if (!systemValidatableOrderItem(candidate)) continue;
        const validatedAt = new Date();
        const approved: FurnitureOrderItemCandidate = {
          ...candidate,
          verificationStatus: "APPROVED_LOCKED",
        };
        const claimed = await tx.extractedEntity.updateMany({
          where: {
            id: entity.id,
            companyId: actor.companyId,
            projectId: project.id,
            status: { in: [ExtractedEntityStatus.EXTRACTED, ExtractedEntityStatus.NEEDS_REVIEW, ExtractedEntityStatus.CORRECTED] },
            updatedAt: entity.updatedAt,
          },
          data: {
            technicalDataJson: asJson({ kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND, candidate: approved }),
            status: ExtractedEntityStatus.CONFIRMED,
            confirmedByUserId: null,
            confirmedAt: validatedAt,
            correctionJson: asJson({
              schemaVersion: "autonomous-joinery-validation-v1",
              validationType: "SYSTEM_VALIDATED",
              operationHash: input.systemValidatedOperationHash,
              validatedAt: validatedAt.toISOString(),
            }),
          },
        });
        if (claimed.count !== 1) {
          throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A Joinery order item changed during deterministic validation.");
        }
        entity.status = ExtractedEntityStatus.CONFIRMED;
        entity.confirmedAt = validatedAt;
        entity.technicalDataJson = asJson({
          kind: FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
          candidate: approved,
        }) as unknown as Prisma.JsonValue;
        systemValidatedOrderItemCount += 1;
      }
    }
    if (orderEntities.some((entity) => entity.status !== ExtractedEntityStatus.CONFIRMED || !entity.confirmedAt)) {
      throw new AppError(
        "FURNITURE_ORDER_ITEMS_REQUIRE_REVIEW",
        "Review and lock every detected hardware or order item before generating managed outputs.",
        409,
      );
    }
    const confirmedOrderItems: ConfirmedFurnitureOrderItem[] = orderEntities.map((entity) => ({
      entityId: entity.id,
      status: "CONFIRMED",
      confirmedAt: entity.confirmedAt!.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
      item: parseOrderItemCandidate(entity.technicalDataJson),
    } as ConfirmedFurnitureOrderItem));
    const output = buildFurnitureCanonicalOutput({
      projectId: project.id,
      projectReference: project.reference,
      projectName: project.name,
      discipline,
      wastagePercentage: input.wastagePercentage,
      confirmedCandidates,
      confirmedOrderItems,
    });

    const boq = await tx.bOQ.findFirst({
      where: { id: input.boqId, companyId: actor.companyId, projectId: project.id },
      include: {
        sections: {
          orderBy: { sortOrder: "asc" },
          include: {
            items: {
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              include: { rateProvenance: true },
            },
          },
        },
      },
    });
    if (!boq) throw new NotFoundError("BOQ not found for this furniture project.");
    if (
      boq.isLocked
      || boq.status === BOQStatus.LOCKED
      || boq.status === BOQStatus.ISSUED
      || boq.status === BOQStatus.APPROVED
    ) {
      throw new ConflictError("BOQ_LOCKED", "Unlock the BOQ before regenerating managed furniture rows.");
    }

    const existingByCode = new Map(boq.sections.map((section) => [section.code, section as ExistingBOQSection]));
    const sectionChanges = output.sections.some((section) => sectionNeedsUpdate(existingByCode.get(section.code), section));
    const existingItems: ExistingFurnitureManagedBOQItem[] = boq.sections.flatMap((section) =>
      section.items.map((item) => ({ ...item, sectionId: section.id, sectionCode: section.code })));
    const desiredItems = output.sections.flatMap((section) => section.items);
    const plan = planFurnitureManagedRows(existingItems, desiredItems);
    const createdItems = plan.create.length;
    const updatedItems = plan.update.length;
    const removedManagedItems = plan.deleteIds.length;
    const preservedManualItems = plan.manualOrUnmarkedIds.length;
    const nonCommercialRateBackfillItems = existingItems.filter((item) =>
      plan.unchangedIds.includes(item.id)
      && isStrictFurnitureManagedNonCommercialRow({
        industryKey: JOINERY_INDUSTRY_KEY,
        sectionCode: item.sectionCode,
        category: item.category,
        sourceType: item.sourceType ?? BoqItemSourceType.IMPORT,
        itemCode: item.itemCode,
        sourceReference: item.sourceReference,
        notes: item.notes,
      })
      && (!item.rateProvenance
        || item.rateProvenance.sourceType === "LEGACY_UNVERIFIED"
        || item.rateProvenance.confirmedAt === null));
    const changed = sectionChanges || createdItems > 0 || updatedItems > 0
      || removedManagedItems > 0 || nonCommercialRateBackfillItems.length > 0;
    if (!changed) {
      return {
        changed: false,
        boqId: boq.id,
        projectId: project.id,
        output,
        createdItems: 0,
        updatedItems: 0,
        removedManagedItems: 0,
        preservedManualItems,
      };
    }

    const claimed = await tx.bOQ.updateMany({
      where: {
        id: boq.id,
        companyId: actor.companyId,
        projectId: project.id,
        version: boq.version,
        isLocked: false,
        status: { notIn: [BOQStatus.LOCKED, BOQStatus.ISSUED, BOQStatus.APPROVED] },
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

    const persistedSections = new Map<FurnitureCanonicalSectionCode, string>();
    for (const section of output.sections) {
      const existing = existingByCode.get(section.code);
      const persistedSection = existing
        ? await tx.bOQSection.update({
            where: { id: existing.id, companyId: actor.companyId },
            data: { title: section.title, description: section.description, sortOrder: section.sortOrder },
          })
        : await tx.bOQSection.create({
            data: {
              companyId: actor.companyId,
              boqId: boq.id,
              code: section.code,
              title: section.title,
              description: section.description,
              sortOrder: section.sortOrder,
            },
          });
      persistedSections.set(section.code, persistedSection.id);
    }
    for (const id of plan.deleteIds) {
      const current = existingItems.find((candidate) => candidate.id === id);
      if (!current) throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A managed furniture row changed. Reload and retry.");
      const removed = await tx.bOQItem.deleteMany({
        where: {
          id,
          companyId: actor.companyId,
          sectionId: current.sectionId,
          itemCode: current.itemCode,
          sourceReference: current.sourceReference,
          notes: current.notes,
        },
      });
      if (removed.count !== 1) {
        throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A managed furniture row changed. Reload and retry.");
      }
    }
    for (const { id, item } of plan.update) {
      const current = existingItems.find((candidate) => candidate.id === id);
      const targetSectionId = persistedSections.get(item.sectionCode);
      if (!current || !targetSectionId) {
        throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A managed furniture row changed. Reload and retry.");
      }
      const index = canonicalItemsForSection(output, item.sectionCode)
        .findIndex((candidate) => candidate.managedKey === item.managedKey);
      const updated = await tx.bOQItem.updateMany({
        where: {
          id,
          companyId: actor.companyId,
          sectionId: current.sectionId,
          itemCode: current.itemCode,
          sourceReference: current.sourceReference,
          notes: current.notes,
        },
        data: buildFurnitureManagedItemUpdate(current, item, index),
      });
      if (updated.count !== 1) {
        throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A managed furniture row changed. Reload and retry.");
      }
      if (current.sectionId !== targetSectionId) {
        await tx.bOQItem.update({
          where: { id, companyId: actor.companyId },
          data: { section: { connect: { id: targetSectionId } } },
        });
      }
      const persistedItem = await tx.bOQItem.findFirstOrThrow({
        where: { id, companyId: actor.companyId },
      });
      await recordFurnitureManagedQuantityProvenance(
        tx,
        actor.companyId,
        project.id,
        persistedItem,
        item,
        actor,
      );
    }
    for (const item of plan.create) {
      const targetSectionId = persistedSections.get(item.sectionCode);
      if (!targetSectionId) {
        throw new ConflictError("CONCURRENT_WRITE_CONFLICT", "A managed furniture section changed. Reload and retry.");
      }
      const index = canonicalItemsForSection(output, item.sectionCode)
        .findIndex((candidate) => candidate.managedKey === item.managedKey);
      const created = await tx.bOQItem.create({
        data: itemCreateData(actor.companyId, targetSectionId, item, index),
      });
      await recordFurnitureManagedQuantityProvenance(
        tx,
        actor.companyId,
        project.id,
        created,
        item,
        actor,
      );
    }
    for (const item of nonCommercialRateBackfillItems) {
      const persistedItem = await tx.bOQItem.findFirstOrThrow({
        where: { id: item.id, companyId: actor.companyId, sectionId: item.sectionId },
      });
      await confirmManualRateProvenance(
        tx,
        actor.companyId,
        project.id,
        persistedItem,
        { userId: actor.userId, name: actor.fullName },
      );
    }

    await createAuditLog(actor.companyId, {
      entityType: "BOQ",
      entityId: boq.id,
      action: "FURNITURE_MANAGED_BOQ_REGENERATED",
      actorName: actor.fullName,
      payload: {
        projectId: project.id,
        outputVersion: FURNITURE_CANONICAL_OUTPUT_VERSION,
        confirmedCandidateCount: confirmedCandidates.length,
        validationType: input.systemValidatedOperationHash ? "SYSTEM_VALIDATED" : "HUMAN_CONFIRMED",
        systemValidatedOperationHash: input.systemValidatedOperationHash ?? null,
        systemValidatedCandidateCount,
        systemValidatedOrderItemCount,
        wastagePercentage: input.wastagePercentage,
        createdItems,
        updatedItems,
        removedManagedItems,
        preservedManualItems,
        nonCommercialRateProvenanceBackfillCount: nonCommercialRateBackfillItems.length,
      },
    }, tx);
    return {
      changed: true,
      boqId: boq.id,
      projectId: project.id,
      output,
      createdItems,
      updatedItems,
      removedManagedItems,
      preservedManualItems,
    };
    }, {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable,
      timeout: FURNITURE_MANAGED_BOQ_TRANSACTION_TIMEOUT_MS,
    });
  } catch (error) {
    if (error && typeof error === "object" && "code" in error && error.code === "P2034") {
      throw new ConflictError(
        "CONCURRENT_WRITE_CONFLICT",
        "Another BOQ update completed at the same time. Reload and retry.",
      );
    }
    throw error;
  }
}
