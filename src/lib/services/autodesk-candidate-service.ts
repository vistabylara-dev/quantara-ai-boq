import { createHash } from "crypto";
import {
  ExtractedEntityStatus,
  ExtractedEntityType,
  ExtractionMethod,
  Prisma,
  ProjectFileClassification,
  ProjectFileStatus,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { AppError } from "@/lib/errors/app-error";
import {
  getAutodeskDerivativeManifest,
  getAutodeskItemTipVersion,
  getAutodeskModelMetadata,
  getAutodeskModelProperties,
  type AutodeskItemTipVersion,
  type AutodeskModelProperty,
} from "@/lib/integrations/connectors/autodesk-client";
import { prisma } from "@/lib/db/prisma";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { withAutodeskReadAccess } from "@/lib/services/autodesk-integration-service";

const CANDIDATE_GENERATION_VERSION = "autodesk-dwg-v1";
const EXTERNAL_SOURCE_KIND = "EXTERNAL_REFERENCE";
const REVIEWED_STATUSES = new Set<ExtractedEntityStatus>([
  ExtractedEntityStatus.CONFIRMED,
  ExtractedEntityStatus.CORRECTED,
  ExtractedEntityStatus.REJECTED,
  ExtractedEntityStatus.IMPORTED,
]);

type ScalarPropertyValue = string | number | boolean;

type AutodeskCandidateEvidence = {
  modelGuid: string;
  objectId: number;
  externalId: string | null;
  name: string;
  layer: ScalarPropertyValue | null;
  category: ScalarPropertyValue | null;
  objectType: ScalarPropertyValue | null;
  material: ScalarPropertyValue | null;
  properties: Record<string, Record<string, ScalarPropertyValue>>;
};

type AutodeskCandidateIdentity = Pick<AutodeskCandidateEvidence, "modelGuid" | "objectId" | "externalId"> & {
  autodeskProjectId: string;
  itemId: string;
  versionId: string;
};

export type GenerateAutodeskDwgCandidatesInput = {
  /** Quantara project slug or UUID. */
  projectId: string;
  /** APS project identifier selected from the connected Autodesk account. */
  autodeskProjectId: string;
  /** APS item identifier selected from the connected Autodesk account. */
  itemId: string;
};

export type GenerateAutodeskDwgCandidatesResult = {
  candidatesCreated: number;
  candidatesPreserved: number;
  modelsProcessed: number;
  sourceFileId: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function asScalar(value: unknown): ScalarPropertyValue | null {
  if (typeof value === "string" || typeof value === "boolean") return value;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizedPropertyName(value: string): string {
  return value.trim().toLocaleLowerCase("en-US").replace(/[^a-z0-9]+/g, " ").trim();
}

const EVIDENCE_PROPERTY_NAMES = new Set([
  "layer",
  "name",
  "category",
  "type",
  "object type",
  "description",
  "material",
  "length",
  "area",
  "volume",
  "width",
  "height",
  "depth",
  "diameter",
]);

function findEvidenceValue(
  properties: Record<string, Record<string, ScalarPropertyValue>>,
  propertyName: string,
): ScalarPropertyValue | null {
  const expected = normalizedPropertyName(propertyName);
  for (const group of Object.values(properties)) {
    for (const [name, value] of Object.entries(group)) {
      if (normalizedPropertyName(name) === expected) return value;
    }
  }
  return null;
}

/**
 * Retains a deliberately small, explicit evidence snapshot. In particular,
 * handles, colours, object IDs, and arbitrary numeric fields are not treated
 * as quantities or candidate evidence values.
 */
function selectEvidenceProperties(
  properties: AutodeskModelProperty["properties"],
): Record<string, Record<string, ScalarPropertyValue>> {
  const selected: Record<string, Record<string, ScalarPropertyValue>> = {};
  for (const [groupName, group] of Object.entries(properties)) {
    const selectedGroup: Record<string, ScalarPropertyValue> = {};
    for (const [propertyName, rawValue] of Object.entries(group)) {
      if (!EVIDENCE_PROPERTY_NAMES.has(normalizedPropertyName(propertyName))) continue;
      const value = asScalar(rawValue);
      if (value !== null) selectedGroup[propertyName] = value;
    }
    if (Object.keys(selectedGroup).length > 0) selected[groupName] = selectedGroup;
  }
  return selected;
}

function evidenceFromProperty(modelGuid: string, property: AutodeskModelProperty): AutodeskCandidateEvidence {
  const properties = selectEvidenceProperties(property.properties);
  return {
    modelGuid,
    objectId: property.objectId,
    externalId: property.externalId,
    name: property.name,
    layer: findEvidenceValue(properties, "layer"),
    category: findEvidenceValue(properties, "category"),
    objectType: findEvidenceValue(properties, "object type") ?? findEvidenceValue(properties, "type"),
    material: findEvidenceValue(properties, "material"),
    properties,
  };
}

function candidateLabel(evidence: AutodeskCandidateEvidence): string {
  const propertyName = findEvidenceValue(evidence.properties, "name");
  const label = typeof propertyName === "string" && propertyName.trim() ? propertyName.trim() : evidence.name.trim();
  return label.slice(0, 200) || `Autodesk object ${evidence.objectId}`;
}

function sourceText(evidence: AutodeskCandidateEvidence): string {
  const parts = [`Object: ${candidateLabel(evidence)}`];
  if (evidence.layer !== null) parts.push(`Layer: ${String(evidence.layer)}`);
  if (evidence.category !== null) parts.push(`Category: ${String(evidence.category)}`);
  if (evidence.objectType !== null) parts.push(`Type: ${String(evidence.objectType)}`);
  if (evidence.material !== null) parts.push(`Material: ${String(evidence.material)}`);
  return parts.join("; ").slice(0, 4000);
}

function derivativeNotReady(): AppError {
  return new AppError(
    "AUTODESK_DERIVATIVE_NOT_READY",
    "Autodesk model metadata is not available for this DWG version yet.",
    409,
  );
}

function referenceFingerprint(
  companyId: string,
  projectId: string,
  input: GenerateAutodeskDwgCandidatesInput,
  tip: AutodeskItemTipVersion,
): string {
  return createHash("sha256")
    .update(JSON.stringify({
      provider: "autodesk",
      companyId,
      projectId,
      autodeskProjectId: input.autodeskProjectId,
      itemId: input.itemId,
      versionId: tip.versionId,
      derivativeUrn: tip.derivativeUrn,
    }))
    .digest("hex");
}

function externalSourceMetadata(
  input: GenerateAutodeskDwgCandidatesInput,
  tip: AutodeskItemTipVersion,
  fingerprint: string,
): Prisma.InputJsonValue {
  return {
    sourceKind: EXTERNAL_SOURCE_KIND,
    localCopy: false,
    externalSource: {
      provider: "autodesk",
      sourceFormat: "DWG",
      autodeskProjectId: input.autodeskProjectId,
      itemId: input.itemId,
      versionId: tip.versionId,
      derivativeUrn: tip.derivativeUrn,
      referenceFingerprint: fingerprint,
    },
  } as Prisma.InputJsonValue;
}

function hasMatchingExternalSource(
  metadataJson: unknown,
  fingerprint: string,
): boolean {
  if (!isRecord(metadataJson) || metadataJson.sourceKind !== EXTERNAL_SOURCE_KIND || metadataJson.localCopy !== false) {
    return false;
  }
  return isRecord(metadataJson.externalSource)
    && metadataJson.externalSource.referenceFingerprint === fingerprint;
}

function candidateIdentity(
  input: GenerateAutodeskDwgCandidatesInput,
  tip: AutodeskItemTipVersion,
  evidence: AutodeskCandidateEvidence,
): AutodeskCandidateIdentity {
  return {
    autodeskProjectId: input.autodeskProjectId,
    itemId: input.itemId,
    versionId: tip.versionId,
    modelGuid: evidence.modelGuid,
    objectId: evidence.objectId,
    externalId: evidence.externalId,
  };
}

function candidateIdentityKey(identity: AutodeskCandidateIdentity): string {
  return JSON.stringify(identity);
}

function matchesCandidateIdentity(
  technicalDataJson: unknown,
  identity: AutodeskCandidateIdentity,
): boolean {
  if (!isRecord(technicalDataJson)) return false;
  return technicalDataJson.provider === "autodesk"
    && technicalDataJson.sourceFormat === "DWG"
    && technicalDataJson.candidateGenerationVersion === CANDIDATE_GENERATION_VERSION
    && technicalDataJson.autodeskProjectId === identity.autodeskProjectId
    && technicalDataJson.itemId === identity.itemId
    && technicalDataJson.versionId === identity.versionId
    && technicalDataJson.modelGuid === identity.modelGuid
    && technicalDataJson.objectId === identity.objectId
    && technicalDataJson.externalId === identity.externalId;
}

function isDwg(tip: AutodeskItemTipVersion): boolean {
  return tip.name.toLocaleLowerCase("en-US").endsWith(".dwg");
}

/**
 * Creates a deliberate metadata-only ProjectFile source bridge. It contains
 * no DWG bytes, no storage object, and explicitly declares `localCopy: false`;
 * it exists only because ExtractedEntity requires a tenant-owned ProjectFile FK.
 */
async function ensureExternalSourceRecord(
  tx: Prisma.TransactionClient,
  actor: CurrentActor,
  canonicalProjectId: string,
  input: GenerateAutodeskDwgCandidatesInput,
  tip: AutodeskItemTipVersion,
) {
  const fingerprint = referenceFingerprint(actor.companyId, canonicalProjectId, input, tip);
  const existing = await tx.projectFile.findMany({
    where: { companyId: actor.companyId, projectId: canonicalProjectId },
    select: { id: true, metadataJson: true },
  });
  const matched = existing.find((file) => hasMatchingExternalSource(file.metadataJson, fingerprint));
  if (matched) return { id: matched.id, fingerprint };

  const safeFileName = `autodesk-${fingerprint.slice(0, 24)}.dwg`;
  const created = await tx.projectFile.create({
    data: {
      companyId: actor.companyId,
      projectId: canonicalProjectId,
      uploadedByUserId: actor.userId,
      originalName: tip.name,
      safeFileName,
      // This key is a declared external-reference namespace, never a storage upload path.
      storageKey: `external-references/autodesk/${fingerprint}`,
      mimeType: tip.mimeType ?? "application/acad",
      extension: "dwg",
      fileSize: 0,
      // Required legacy field: this is an identity fingerprint, never a claimed file-content checksum.
      checksum: fingerprint,
      status: ProjectFileStatus.COMPLETED,
      classification: ProjectFileClassification.UNKNOWN,
      metadataJson: externalSourceMetadata(input, tip, fingerprint),
    },
    select: { id: true },
  });
  return { id: created.id, fingerprint };
}

function sortModelsForExtraction<T extends { role: "2d" | "3d" | null }>(models: T[]): T[] {
  return [...models].sort((left, right) => Number(right.role === "3d") - Number(left.role === "3d"));
}

/**
 * Resolves only Autodesk-generated model metadata/properties for a selected
 * DWG and creates untrusted, human-review candidates. It never downloads or
 * uploads the DWG, calls an LLM, assigns a BOQ quantity, or inserts a BOQ item.
 */
export async function generateAutodeskDwgCandidates(
  actor: CurrentActor,
  input: GenerateAutodeskDwgCandidatesInput,
): Promise<GenerateAutodeskDwgCandidatesResult> {
  requireCapability(actor, "files:manage");
  const project = await getProjectRecord(actor.companyId, input.projectId);

  return withAutodeskReadAccess(actor, async (accessToken) => {
    const tip = await getAutodeskItemTipVersion(accessToken, input.autodeskProjectId, input.itemId);
    if (!isDwg(tip)) {
      throw new AppError("AUTODESK_DWG_REQUIRED", "Select a DWG file before generating review candidates.", 400);
    }
    if (!tip.derivativeUrn) throw derivativeNotReady();

    await getAutodeskDerivativeManifest(accessToken, tip.derivativeUrn);
    const models = sortModelsForExtraction(await getAutodeskModelMetadata(accessToken, tip.derivativeUrn));
    if (models.length === 0) throw derivativeNotReady();

    const candidates: AutodeskCandidateEvidence[] = [];
    for (const model of models) {
      const properties = await getAutodeskModelProperties(accessToken, tip.derivativeUrn, model.modelGuid);
      candidates.push(...properties.map((property) => evidenceFromProperty(model.modelGuid, property)));
    }

    const candidatesByIdentity = new Map<string, AutodeskCandidateEvidence>();
    for (const candidate of candidates) {
      candidatesByIdentity.set(candidateIdentityKey(candidateIdentity(input, tip, candidate)), candidate);
    }
    if (candidatesByIdentity.size === 0) {
      return { candidatesCreated: 0, candidatesPreserved: 0, modelsProcessed: models.length, sourceFileId: null };
    }

    return prisma.$transaction(async (tx) => {
      // PostgreSQL advisory transaction lock prevents concurrent reruns of the same immutable DWG version.
      const lockKey = `${actor.companyId}:${project.id}:${input.autodeskProjectId}:${input.itemId}:${tip.versionId}`;
      await tx.$executeRaw(Prisma.sql`SELECT pg_advisory_xact_lock(hashtext(${lockKey}))`);

      const source = await ensureExternalSourceRecord(tx, actor, project.id, input, tip);
      const existing = await tx.extractedEntity.findMany({
        where: {
          companyId: actor.companyId,
          projectId: project.id,
          projectFileId: source.id,
          extractionMethod: ExtractionMethod.VECTOR_BLOCK,
        },
        select: { id: true, status: true, technicalDataJson: true },
      });

      const deleteIds: string[] = [];
      let candidatesCreated = 0;
      let candidatesPreserved = 0;

      for (const evidence of candidatesByIdentity.values()) {
        const identity = candidateIdentity(input, tip, evidence);
        const matching = existing.filter((row) => matchesCandidateIdentity(row.technicalDataJson, identity));
        if (matching.some((row) => REVIEWED_STATUSES.has(row.status))) {
          candidatesPreserved += 1;
          continue;
        }
        deleteIds.push(...matching.map((row) => row.id));
      }

      if (deleteIds.length > 0) {
        await tx.extractedEntity.deleteMany({
          where: { companyId: actor.companyId, id: { in: deleteIds } },
        });
      }

      for (const evidence of candidatesByIdentity.values()) {
        const identity = candidateIdentity(input, tip, evidence);
        const matching = existing.filter((row) => matchesCandidateIdentity(row.technicalDataJson, identity));
        if (matching.some((row) => REVIEWED_STATUSES.has(row.status))) continue;

        const label = candidateLabel(evidence);
        const technicalData = {
          provider: "autodesk",
          sourceFormat: "DWG",
          sourceDwgName: tip.name,
          autodeskProjectId: input.autodeskProjectId,
          itemId: input.itemId,
          versionId: tip.versionId,
          versionNumber: tip.versionNumber,
          derivativeUrn: tip.derivativeUrn,
          modelGuid: evidence.modelGuid,
          objectId: evidence.objectId,
          externalId: evidence.externalId,
          name: evidence.name,
          layer: evidence.layer,
          category: evidence.category,
          objectType: evidence.objectType,
          material: evidence.material,
          properties: evidence.properties,
          candidateGenerationVersion: CANDIDATE_GENERATION_VERSION,
        };
        await tx.extractedEntity.create({
          data: {
            companyId: actor.companyId,
            projectId: project.id,
            projectFileId: source.id,
            entityType: ExtractedEntityType.CUSTOM,
            label,
            normalizedLabel: label.toLocaleLowerCase("en-US"),
            // DWG property values are traceability evidence, never a BOQ quantity without human review.
            quantity: null,
            unit: null,
            confidence: 50,
            extractionMethod: ExtractionMethod.VECTOR_BLOCK,
            sourceText: sourceText(evidence),
            sourceReference: `Autodesk DWG ${tip.name} · version ${tip.versionNumber} · object ${evidence.objectId}`,
            technicalDataJson: technicalData as Prisma.InputJsonValue,
            status: ExtractedEntityStatus.NEEDS_REVIEW,
          },
        });
        candidatesCreated += 1;
      }

      await createAuditLog(actor.companyId, {
        entityType: "Project",
        entityId: project.id,
        action: "AUTODESK_DWG_CANDIDATES_GENERATED",
        payload: {
          projectId: project.id,
          autodeskProjectId: input.autodeskProjectId,
          itemId: input.itemId,
          versionId: tip.versionId,
          modelsProcessed: models.length,
          candidatesCreated,
          candidatesPreserved,
          generationVersion: CANDIDATE_GENERATION_VERSION,
        },
      }, tx);

      return {
        candidatesCreated,
        candidatesPreserved,
        modelsProcessed: models.length,
        sourceFileId: source.id,
      };
    });
  });
}
