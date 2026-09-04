import {
  BOQItemStatus,
  BOQStatus,
  BoqItemSourceType,
  MarginMode,
  Prisma,
  QuantityProvenanceSource,
  RateProvenanceSource,
} from "@prisma/client";
import type { CurrentActor } from "@/lib/auth/current-actor";
import { requireCapability } from "@/lib/auth/rbac";
import { calculateBOQItem } from "@/lib/calculations/boq-calculator";
import { prisma } from "@/lib/db/prisma";
import { assertBOQEditable } from "@/lib/domain/boq-guards";
import { ConflictError } from "@/lib/errors/app-error";
import {
  chooseAiDraftSection,
  formatAiDraftCategory,
  getAiDraftExtractedEntityId,
  getAiDraftQuantityValue,
  isAiDraftCandidateUsable,
  isAiDraftMeasurementComplete,
  summarizeAiDraftCandidates,
  type AiDraftCandidate,
  type AiDraftSection,
} from "@/lib/guidance/ai-draft-boq";
import {
  applyAiMeasurementSuggestion,
  formatAiMeasurementSuggestionMarker,
  hasAiMeasurementSuggestion,
  inferAiDraftMeasurement,
  type AiMeasurementEvidencePage,
  type AiMeasurementSuggestion,
} from "@/lib/guidance/ai-measurement-inference";
import {
  formatMeasurementMethodSuggestionMarker,
  recommendMeasurementMethod,
} from "@/lib/calculations/measurement-method-recommender";
import { createAuditLog } from "@/lib/repositories/audit-repository";
import {
  createProjectBOQ,
  getBOQRecord,
} from "@/lib/repositories/boq-repository";
import { getProjectRecord } from "@/lib/repositories/project-repository";
import { TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX } from "@/lib/tayqan/tayqan-measurement-contract";
import { FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND } from "@/lib/furniture/types";
import { FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND } from "@/lib/furniture/order-item-mapper";
import {
  resolveAutonomousMeasurementPolicyRule,
  type AutonomousMeasurementPolicyRule,
} from "@/lib/autonomous-boq/measurement-policy";

const AI_DRAFT_FALLBACK_CODE = "AI-DRAFT";
const REVIEWABLE_ENTITY_STATUSES = new Set(["EXTRACTED", "NEEDS_REVIEW"]);
const REVIEWED_ENTITY_STATUSES = new Set(["CONFIRMED", "CORRECTED", "IMPORTED"]);

function extractionMarker(entityId: string): string {
  return `EXTRACTED_ENTITY:${entityId}`;
}

function jsonRecord(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function formatAutonomousCategoryPath(value: unknown): string | null {
  const path = jsonRecord(value);
  if (!path) return null;
  const segments = [
    path.industry,
    path.discipline,
    path.drawingType,
    path.workPackage,
    path.boqSectionTitle,
    path.boqItemClassification,
    path.measurementRuleId,
    path.unit,
  ].filter((segment): segment is string => typeof segment === "string" && segment.trim().length > 0);
  return segments.length === 8 ? `Category path: ${segments.join(" → ")}` : null;
}

function toMeasurementEvidencePage(row: {
  projectFileId: string;
  pageNumber: number;
  textLayerJson: Prisma.JsonValue | null;
}): AiMeasurementEvidencePage {
  const layer = jsonRecord(row.textLayerJson);
  const signals = jsonRecord(layer?.signals);
  const rawTitles = signals?.drawingTitles;
  return {
    projectFileId: row.projectFileId,
    pageNumber: row.pageNumber,
    text: typeof layer?.text === "string" ? layer.text : null,
    normalizedText: typeof layer?.normalizedText === "string" ? layer.normalizedText : null,
    drawingTitles: Array.isArray(rawTitles)
      ? rawTitles.filter((value): value is string => typeof value === "string")
      : [],
  };
}

function toCandidate(entity: {
  id: string;
  entityType: string;
  label: string;
  quantity: Prisma.Decimal | null;
  unit: string | null;
  confidence: Prisma.Decimal;
  sourceText: string | null;
  status: string;
}): AiDraftCandidate {
  return {
    id: entity.id,
    entityType: entity.entityType,
    label: entity.label,
    quantity: entity.quantity?.toNumber() ?? null,
    unit: entity.unit,
    confidence: entity.confidence.toNumber(),
    sourceText: entity.sourceText,
    status: entity.status,
  };
}

function sectionView(section: {
  id: string;
  code: string;
  title: string;
  description: string;
}): AiDraftSection {
  return {
    id: section.id,
    code: section.code,
    title: section.title,
    description: section.description,
  };
}

export function missingAutonomousBoqSections(
  existingSections: readonly { code: string }[],
  rules: readonly { sectionCode: string; title: string }[],
): Array<{ code: string; title: string }> {
  const existingCodes = new Set(existingSections.map((section) => section.code));
  return [...new Map(
    rules
      .filter((rule) => !existingCodes.has(rule.sectionCode))
      .map((rule) => [rule.sectionCode, { code: rule.sectionCode, title: rule.title }] as const),
  ).values()];
}

function assertAiDraftEditable(boq: Awaited<ReturnType<typeof getBOQRecord>>) {
  if (
    boq.isLocked
    || boq.status === BOQStatus.LOCKED
    || boq.status === BOQStatus.ISSUED
    || boq.status === BOQStatus.APPROVED
  ) {
    throw new ConflictError(
      "AI_DRAFT_REQUIRES_EDITABLE_BOQ",
      "The latest BOQ revision is locked. Create a new editable revision before generating another AI Draft.",
    );
  }
  assertBOQEditable(boq, "edit");
}

export type AiDraftGenerationOptions = {
  targetBoqId?: string;
  projectFileIds?: readonly string[];
  /** Default preserves normal Quantara. TAYQAN opts in explicitly. */
  quantityMode?: "EXTRACTION_ONLY" | "TAYQAN_MEASUREMENT_PROPOSAL"
    | "AUTONOMOUS_SYSTEM_VALIDATED";
  /** Required only by AUTONOMOUS_SYSTEM_VALIDATED. */
  autonomousPolicy?: {
    operationHash: string;
    rules: ReadonlyArray<AutonomousMeasurementPolicyRule & {
      sectionCode: string;
      title: string;
    }>;
  };
  /** Forces a non-payable review schedule into one clearly labelled section. */
  reviewSection?: {
    code: string;
    title: string;
    description: string;
  };
};

export async function generateAiDraftBoq(
  actor: CurrentActor,
  projectIdentifier: string,
  options: AiDraftGenerationOptions = {},
) {
  requireCapability(actor, "boq:edit");
  const autonomousMode = options.quantityMode === "AUTONOMOUS_SYSTEM_VALIDATED";
  if (
    autonomousMode
    && (
      !options.autonomousPolicy
      || !/^[a-f0-9]{64}$/i.test(options.autonomousPolicy.operationHash)
      || options.autonomousPolicy.rules.length === 0
    )
  ) {
    throw new ConflictError(
      "AUTONOMOUS_AI_DRAFT_POLICY_REQUIRED",
      "Autonomous BOQ assembly requires the frozen operation hash and at least one allowed industry rule.",
    );
  }
  const project = await getProjectRecord(actor.companyId, projectIdentifier);

  const latest = options.targetBoqId
    ? null
    : await prisma.bOQ.findFirst({
        where: { companyId: actor.companyId, projectId: project.id },
        orderBy: { revisionNumber: "desc" },
        select: { id: true },
      });

  const targetBoqId = options.targetBoqId
    ?? latest?.id
    ?? (await createProjectBOQ(actor.companyId, project.id)).id;

  const explicitSourceScope = options.projectFileIds !== undefined;
  const scopedProjectFileIds = [
    ...new Set(
      (options.projectFileIds ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

  if (explicitSourceScope && scopedProjectFileIds.length === 0) {
    throw new ConflictError(
      "AI_DRAFT_SOURCE_SCOPE_EMPTY",
      "The requested AI Draft source scope is empty. Quantara will not silently widen it to unrelated project files.",
    );
  }

  return prisma.$transaction(async (tx) => {
    const current = await getBOQRecord(actor.companyId, targetBoqId, tx);
    assertAiDraftEditable(current);

    if (current.projectId !== project.id) {
      throw new ConflictError(
        "AI_DRAFT_BOQ_PROJECT_MISMATCH",
        "The requested AI Draft BOQ belongs to another project.",
      );
    }

    const rows = await tx.extractedEntity.findMany({
      where: {
        companyId: actor.companyId,
        projectId: project.id,
        // The furniture workspace preserves Room → Elevation → Assembly
        // → Part. The generic draft path must never flatten or duplicate it.
        OR: [
          { categoryKey: null },
          { categoryKey: { notIn: [
            FURNITURE_CANDIDATE_TECHNICAL_DATA_KIND,
            FURNITURE_ORDER_ITEM_TECHNICAL_DATA_KIND,
          ] } },
        ],
        ...(scopedProjectFileIds.length > 0
          ? { projectFileId: { in: scopedProjectFileIds } }
          : {}),
        status: { in: ["EXTRACTED", "NEEDS_REVIEW", "CONFIRMED", "CORRECTED"] },
      },
      orderBy: [{ projectFileId: "asc" }, { createdAt: "asc" }],
    });

    const calculatedMeasurements =
      (options.quantityMode === "TAYQAN_MEASUREMENT_PROPOSAL" || autonomousMode)
      && rows.length > 0
        ? await tx.quantityCalculation.findMany({
            where: {
              companyId: actor.companyId,
              projectId: project.id,
              extractedEntityId: {
                in: rows.map((row) => row.id),
              },
              calculatedBy: {
                startsWith:
                  autonomousMode
                    ? `UNIVERSAL:autonomous-boq/v1:${options.autonomousPolicy!.operationHash}:`
                    : TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,
              },
              ...(autonomousMode
                ? {
                    status: "CONFIRMED" as const,
                    confirmedAt: { not: null },
                    confirmedByUserId: null,
                  }
                : { status: { not: "REJECTED" as const } }),
            },
            orderBy: {
              updatedAt: "desc",
            },
          })
        : [];

    // Preserves the original tayqanMeasurementByEntityId one-latest-result-per-entity
    // invariant while extending the same map to operation-bound autonomous results.
    const measurementByEntityId =
      new Map<string, (typeof calculatedMeasurements)[number]>();

    for (const measurement of calculatedMeasurements) {
      if (
        measurement.extractedEntityId
        && !measurementByEntityId.has(
          measurement.extractedEntityId
        )
      ) {
        measurementByEntityId.set(
          measurement.extractedEntityId,
          measurement
        );
      }
    }

    const useQuantaraMeasurementIntelligence =
      options.quantityMode !== "TAYQAN_MEASUREMENT_PROPOSAL"
      && !autonomousMode;

    const sourceFileIds =
      useQuantaraMeasurementIntelligence
        ? [...new Set(
            rows.map((row) => row.projectFileId)
          )]
        : [];
    const pageRows = sourceFileIds.length > 0
      ? await tx.drawingPage.findMany({
          where: {
            companyId: actor.companyId,
            projectFileId: { in: sourceFileIds },
          },
          orderBy: [{ projectFileId: "asc" }, { pageNumber: "asc" }],
          select: {
            projectFileId: true,
            pageNumber: true,
            textLayerJson: true,
          },
        })
      : [];

    const pagesByFileId = new Map<string, AiMeasurementEvidencePage[]>();
    for (const pageRow of pageRows) {
      const page = toMeasurementEvidencePage(pageRow);
      const existing = pagesByFileId.get(page.projectFileId) ?? [];
      existing.push(page);
      pagesByFileId.set(page.projectFileId, existing);
    }

    const suggestionByEntityId =
      new Map<string, AiMeasurementSuggestion>();

    const autonomousRuleByEntityId = new Map<
      string,
      NonNullable<AiDraftGenerationOptions["autonomousPolicy"]>["rules"][number]
    >();

    if (autonomousMode) {
      for (const row of rows) {
        const measurement = measurementByEntityId.get(row.id);
        if (!measurement) continue;
        const technicalData = jsonRecord(row.technicalDataJson);
        const workPackage = typeof technicalData?.workPackage === "string"
          ? technicalData.workPackage
          : "";
        const binding = resolveAutonomousMeasurementPolicyRule({
          workPackage,
          calculationType: measurement.calculationType,
          calculatedResultUnit: measurement.resultUnit,
          allowedRules: options.autonomousPolicy!.rules,
        });
        const selectedRule = options.autonomousPolicy!.rules.find(
          (rule) => rule.id === binding.ruleId,
        );
        if (!selectedRule || measurement.resultUnit !== binding.resultUnit) {
          throw new ConflictError(
            "AUTONOMOUS_MEASUREMENT_POLICY_DRIFT",
            "A preserved autonomous calculation no longer matches its frozen industry rule and payable unit.",
          );
        }
        autonomousRuleByEntityId.set(row.id, selectedRule);
      }
    }

    const candidates = rows.map((row) => {
      const extractedCandidate =
        toCandidate(row);

      const calculatedMeasurement =
        measurementByEntityId.get(row.id)
        ?? null;

      const baseCandidate: AiDraftCandidate =
        calculatedMeasurement
          ? {
              ...extractedCandidate,
              quantity:
                calculatedMeasurement.resultValue.toNumber(),
              unit:
                calculatedMeasurement.resultUnit,
              confidence:
                Math.min(
                  extractedCandidate.confidence,
                  calculatedMeasurement.confidence.toNumber(),
                ),
            }
          : extractedCandidate;

      const suggestion =
        useQuantaraMeasurementIntelligence
          ? inferAiDraftMeasurement(
              {
                ...baseCandidate,
                technicalDataJson:
                  row.technicalDataJson,
              },
              pagesByFileId.get(row.projectFileId)
                ?? [],
            )
          : null;

      if (suggestion) {
        suggestionByEntityId.set(
          row.id,
          suggestion
        );
      }

      return applyAiMeasurementSuggestion(
        baseCandidate,
        suggestion
      );
    });

    const candidateByEntityId =
      new Map(
        candidates.map(
          (candidate) =>
            [candidate.id, candidate] as const
        )
      );

    const summary =
      summarizeAiDraftCandidates(candidates);

    const currentItems =
      current.sections.flatMap(
        (section) => section.items
      );

    const alreadyPresentIds =
      new Set(
        currentItems
          .map(
            (item) =>
              item.quantityProvenance?.extractedEntityId
              ?? getAiDraftExtractedEntityId(
                item.sourceReference
              )
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      );

    const toAdd = rows
      .map((row) => {
        const candidate =
          candidateByEntityId.get(row.id)
          ?? toCandidate(row);

        const calculatedMeasurement =
          measurementByEntityId.get(row.id)
          ?? null;

        const autonomousRule = autonomousMode
          ? autonomousRuleByEntityId.get(row.id) ?? null
          : null;

        const suggestion =
          useQuantaraMeasurementIntelligence
            ? suggestionByEntityId.get(row.id)
              ?? null
            : null;

        return {
          row,
          candidate,
          suggestion,
          calculatedMeasurement,
          autonomousRule,

          methodRecommendation:
            useQuantaraMeasurementIntelligence
              ? recommendMeasurementMethod({
                  entityType: row.entityType,
                  label: candidate.label,
                  sourceText: row.sourceText,
                  unit: candidate.unit,
                })
              : null,
        };
      })
      .filter(({ row, candidate, calculatedMeasurement, autonomousRule }) =>
        !alreadyPresentIds.has(row.id)
        && isAiDraftCandidateUsable(candidate)
        && (!autonomousMode || Boolean(calculatedMeasurement && autonomousRule))
      );

    if (toAdd.length === 0) {
      const autonomousAlreadyAssembled = autonomousMode
        && autonomousRuleByEntityId.size > 0
        && [...autonomousRuleByEntityId.keys()].every((entityId) =>
          alreadyPresentIds.has(entityId)
        );
      return {
        boqId: current.id,
        addedCount: 0,
        skippedCount: summary.skippedCount,
        alreadyPresentCount: alreadyPresentIds.size,
        unreviewedAddedCount: 0,
        reviewedAddedCount: 0,
        measurementIncompleteAddedCount: 0,
        inferredMeasurementAddedCount: 0,
        systemValidated: autonomousMode,
        readyForRates: autonomousAlreadyAssembled,
      };
    }

    let businessSections = current.sections
      .filter((section) => section.code !== AI_DRAFT_FALLBACK_CODE)
      .map(sectionView);

    if (autonomousMode) {
      const requiredRules = toAdd.flatMap(({ autonomousRule }) => autonomousRule ? [autonomousRule] : []);
      const missingSections = missingAutonomousBoqSections(businessSections, requiredRules);
      if (missingSections.length > 0) {
        const firstSortOrder = Math.max(0, ...current.sections.map((section) => section.sortOrder)) + 1;
        await tx.bOQSection.createMany({
          data: missingSections.map((section, index) => ({
            companyId: actor.companyId,
            boqId: current.id,
            code: section.code,
            title: section.title,
            description: "Section synchronized from the frozen autonomous industry policy.",
            sortOrder: firstSortOrder + index,
          })),
          skipDuplicates: true,
        });
        const synchronized = await tx.bOQSection.findMany({
          where: {
            companyId: actor.companyId,
            boqId: current.id,
            code: { in: missingSections.map((section) => section.code) },
          },
          select: { id: true, code: true, title: true, description: true },
        });
        businessSections = [
          ...businessSections,
          ...synchronized
            .filter((section) => !businessSections.some((existing) => existing.code === section.code))
            .map(sectionView),
        ];
      }
    }

    if (
      autonomousMode
      && toAdd.some(({ autonomousRule }) =>
        !autonomousRule
        || !businessSections.some((section) => section.code === autonomousRule.sectionCode)
      )
    ) {
      throw new ConflictError(
        "AUTONOMOUS_BOQ_SECTION_POLICY_DRIFT",
        "The target BOQ no longer contains the exact section required by its frozen industry policy.",
      );
    }

    const fallbackSectionCode = options.reviewSection?.code ?? AI_DRAFT_FALLBACK_CODE;
    const needsFallbackSection = Boolean(options.reviewSection)
      || (!autonomousMode && toAdd.some(({ candidate }) =>
        chooseAiDraftSection(businessSections, candidate) === null,
      ));

    const claimed = await tx.bOQ.updateMany({
      where: {
        id: current.id,
        companyId: actor.companyId,
        isLocked: false,
        version: current.version,
      },
      data: {
        status: BOQStatus.NEEDS_VERIFICATION,
        version: { increment: 1 },
        verifiedVersion: null,
        verifiedAt: null,
      },
    });

    if (claimed.count !== 1) {
      throw new ConflictError(
        "CONCURRENT_WRITE_CONFLICT",
        "The BOQ changed while Quantara was preparing the AI Draft. Reload and try again.",
      );
    }

    let fallbackSectionId = current.sections.find(
      (section) => section.code === fallbackSectionCode,
    )?.id ?? null;

    if (needsFallbackSection && !fallbackSectionId) {
      const created = await tx.bOQSection.create({
        data: {
          companyId: actor.companyId,
          boqId: current.id,
          code: fallbackSectionCode,
          title: options.reviewSection?.title ?? "AI Draft - Review",
          description: options.reviewSection?.description
            ?? "Extracted project items that could not be matched safely to an existing industry BOQ section. Professional review required.",
          sortOrder:
            Math.max(0, ...current.sections.map((section) => section.sortOrder)) + 1,
        },
        select: { id: true },
      });
      fallbackSectionId = created.id;
    }

    const nextSortOrderBySection = new Map<string, number>();
    for (const section of current.sections) {
      nextSortOrderBySection.set(section.id, section.items.length + 1);
    }
    if (fallbackSectionId && !nextSortOrderBySection.has(fallbackSectionId)) {
      nextSortOrderBySection.set(fallbackSectionId, 1);
    }

    let itemNumber = Math.max(
      0,
      ...currentItems.map((item) => item.itemNumber),
    );
    let reviewedAddedCount = 0;
    let unreviewedAddedCount = 0;
    let measurementIncompleteAddedCount = 0;
    let inferredMeasurementAddedCount = 0;

    for (const {
      row,
      candidate,
      suggestion,
      calculatedMeasurement,
      autonomousRule,
      methodRecommendation,
    } of toAdd) {
      const matchedSectionId = options.reviewSection
        ? null
        : autonomousRule
        ? businessSections.find((section) => section.code === autonomousRule.sectionCode)?.id ?? null
        : chooseAiDraftSection(businessSections, candidate);
      const sectionId = matchedSectionId ?? fallbackSectionId;

      if (!sectionId) {
        throw new ConflictError(
          "AI_DRAFT_SECTION_UNAVAILABLE",
          "Quantara could not identify a safe BOQ section for the AI Draft item.",
        );
      }

      itemNumber += 1;
      const sortOrder = nextSortOrderBySection.get(sectionId) ?? 1;
      nextSortOrderBySection.set(sectionId, sortOrder + 1);

      const measurementComplete = isAiDraftMeasurementComplete(candidate);
      const quantity = new Prisma.Decimal(getAiDraftQuantityValue(candidate));
      const unit = candidate.unit?.trim() ?? "";
      if (!measurementComplete) measurementIncompleteAddedCount += 1;
      if (suggestion && measurementComplete) inferredMeasurementAddedCount += 1;

      const zero = new Prisma.Decimal(0);
      const marginMode = MarginMode.MARKUP;
      const amounts = calculateBOQItem({
        quantity,
        unitCost: zero,
        freightCost: zero,
        installationCost: zero,
        additionalCost: zero,
        marginMode,
        marginPercentage: zero,
      });

      const marker = extractionMarker(row.id);
      const retainedSourceReference = row.sourceReference?.trim();
      const measurementMarker = suggestion
        ? formatAiMeasurementSuggestionMarker(suggestion)
        : null;
      const methodMarker = methodRecommendation
        ? formatMeasurementMethodSuggestionMarker(methodRecommendation)
        : null;
      const sourceReference = [
        retainedSourceReference,
        marker,
        measurementMarker,
        methodMarker,
      ].filter((value): value is string => Boolean(value)).join(" | ");

      const categoryPath = formatAutonomousCategoryPath(
        jsonRecord(row.technicalDataJson)?.categoryPath,
      );

      const specification = [
        row.sourceText?.trim() || null,
        suggestion?.evidenceSummary
          ? `AI measurement evidence: ${suggestion.evidenceSummary}`
          : null,
        methodRecommendation
          ? `Quantara measurement method: ${methodRecommendation.label} (${methodRecommendation.resultUnit}). ${methodRecommendation.reason}`
          : null,
      ].filter((value): value is string => Boolean(value)).join("\n\n");

      const methodRecommendationNote = methodRecommendation
        ? ` Quantara recommends ${methodRecommendation.label} (${methodRecommendation.resultUnit}) as the measurement method for this item.`
        : "";

      const item = await tx.bOQItem.create({
        data: {
          companyId: actor.companyId,
          sectionId,
          itemNumber,
          itemCode: `AI-${row.id.replace(/-/g, "").slice(0, 16).toUpperCase()}`,
          category: matchedSectionId
            ? current.sections.find((section) => section.id === matchedSectionId)?.title
              ?? formatAiDraftCategory(row.entityType)
            : formatAiDraftCategory(row.entityType),
          description: row.label,
          specification,
          quantity,
          unit,
          unitCost: zero,
          freightCost: zero,
          installationCost: zero,
          additionalCost: zero,
          ...amounts,
          marginMode,
          marginPercentage: zero,
          wastagePercentage: zero,
          taxApplicable: true,
          sourceReference,
          confidenceScore: row.confidence,
          status: BOQItemStatus.DRAFT,
          notes: options.reviewSection
            ? "Preliminary concept quantity schedule only. Not for contract or payment. The source quantity remains linked to its extracted drawing evidence and cannot pass payable lock while concept blockers remain."
            : autonomousMode
            ? [
                "Quantara system-validated this quantity against the frozen project drawing scope and deterministic industry rule. Only the unit rate is awaiting user input.",
                categoryPath,
              ].filter(Boolean).join("\n")
            : calculatedMeasurement
              ? "TAYQAN measured this draft quantity from project drawing evidence using the deterministic quantity engine. Professional review is still required; unit price is intentionally left for the engineer."
            : measurementComplete
              ? suggestion
                ? `AI Draft from extracted project evidence with an AI-suggested measurement. Review the quantity/unit once in this BOQ before confirmation. Commercial rate selection is still required.${methodRecommendationNote}`
                : `AI Draft from extracted project evidence. Professional quantity review and commercial rate selection are still required.${methodRecommendationNote}`
              : `AI Draft from extracted project evidence. Quantity and/or unit is unresolved and must be completed in the BOQ before validation.${methodRecommendationNote}`,
          sortOrder,
          sourceType: BoqItemSourceType.IMPORT,
        },
      });

      const calculatedMeasurementConfirmed =
        Boolean(
          calculatedMeasurement
          && calculatedMeasurement.status === "CONFIRMED"
          && calculatedMeasurement.confirmedAt !== null
        );

      const previouslyReviewed = (
        !calculatedMeasurement
        && !suggestion
        && measurementComplete
        && (
          row.status === "CONFIRMED"
          || row.status === "CORRECTED"
        )
        && row.confirmedAt !== null
      );

      await tx.bOQItemQuantityProvenance.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          boqItemId: item.id,
          sourceType: calculatedMeasurementConfirmed
            ? QuantityProvenanceSource.CONFIRMED_CALCULATION
            : previouslyReviewed
              ? QuantityProvenanceSource.REVIEWED_EXTRACTION
              : QuantityProvenanceSource.LEGACY_UNVERIFIED,
          extractedEntityId: row.id,
          quantityCalculationId:
            calculatedMeasurement?.id ?? null,
          projectFileId: row.projectFileId,
          quantitySnapshot: quantity,
          unitSnapshot: unit,
          confirmedByUserId:
            calculatedMeasurementConfirmed
              ? calculatedMeasurement?.confirmedByUserId ?? null
              : previouslyReviewed
                ? row.confirmedByUserId
                : null,
          confirmedByName:
            calculatedMeasurementConfirmed
              ? autonomousMode
                ? "Quantara system validation"
                : "Confirmed TAYQAN calculation"
              : previouslyReviewed
                ? "Previously reviewed extraction"
                : calculatedMeasurement
                  ? "TAYQAN measurement - professional review pending"
                  : "AI draft - professional review pending",
          confirmedAt:
            calculatedMeasurementConfirmed
              ? calculatedMeasurement?.confirmedAt ?? null
              : previouslyReviewed
                ? row.confirmedAt
                : null,
        },
      });

      await tx.bOQItemRateProvenance.create({
        data: {
          companyId: actor.companyId,
          projectId: project.id,
          boqItemId: item.id,
          sourceType: RateProvenanceSource.LEGACY_UNVERIFIED,
          unitCostSnapshot: zero,
          freightCostSnapshot: zero,
          installationCostSnapshot: zero,
          additionalCostSnapshot: zero,
          marginModeSnapshot: marginMode,
          marginPercentageSnapshot: zero,
          currencySnapshot: current.project.currency,
          confirmedByUserId: null,
          confirmedByName: autonomousMode
            ? "Autonomous BOQ - unit rate pending"
            : "AI draft - rate selection pending",
          confirmedAt: null,
        },
      });

      if (previouslyReviewed) {
        const imported = await tx.extractedEntity.updateMany({
          where: {
            id: row.id,
            companyId: actor.companyId,
            projectId: project.id,
            status: { in: ["CONFIRMED", "CORRECTED"] },
          },
          data: { status: "IMPORTED" },
        });
        if (imported.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_ENTITY_IMPORT_CONFLICT",
            "A reviewed extraction changed while the AI Draft was being prepared. Reload and try again.",
          );
        }

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: row.id,
          action: "ENTITY_IMPORTED_TO_BOQ",
          actorName: actor.fullName,
          payload: { boqId: current.id, source: "AI_DRAFT" },
        }, tx);
        reviewedAddedCount += 1;
      } else {
        unreviewedAddedCount += 1;
      }

      await createAuditLog(actor.companyId, {
        entityType: "BOQItem",
        entityId: item.id,
        action: autonomousMode
          ? "AUTONOMOUS_BOQ_ITEM_ASSEMBLED"
          : "AI_DRAFT_ITEM_ADDED",
        actorName: actor.fullName,
        payload: {
          boqId: current.id,
          extractedEntityId: row.id,
          quantity: quantity.toString(),
          unit,
          confidence: row.confidence.toString(),
          measurementComplete,
          tayqanMeasurementCalculationId:
            autonomousMode ? null : calculatedMeasurement?.id ?? null,
          autonomousQuantityCalculationId:
            autonomousMode ? calculatedMeasurement?.id ?? null : null,
          autonomousOperationHash:
            autonomousMode ? options.autonomousPolicy?.operationHash ?? null : null,
          autonomousRuleId: autonomousRule?.id ?? null,
          autonomousCategoryPath: categoryPath,
          systemValidated: autonomousMode,
          ...(suggestion
            ? {
                measurementSuggestion: {
                  method: suggestion.method,
                  confidence: suggestion.confidence,
                  pageNumbers: suggestion.pageNumbers,
                  evidenceSummary: suggestion.evidenceSummary,
                },
              }
            : {}),
          rateAutomaticallyApplied: false,
        },
      }, tx);
    }

    await createAuditLog(actor.companyId, {
      entityType: "BOQ",
      entityId: current.id,
      action: autonomousMode
        ? "AUTONOMOUS_UNPRICED_BOQ_ASSEMBLED"
        : "AI_DRAFT_GENERATED",
      actorName: actor.fullName,
      payload: {
        projectId: project.id,
        addedCount: toAdd.length,
        skippedCount: summary.skippedCount,
        alreadyPresentCount: alreadyPresentIds.size,
        reviewedAddedCount,
        unreviewedAddedCount,
        measurementIncompleteAddedCount,
        inferredMeasurementAddedCount,
        ratesAutomaticallyApplied: false,
        autonomousOperationHash:
          autonomousMode ? options.autonomousPolicy?.operationHash ?? null : null,
        systemValidated: autonomousMode,
      },
    }, tx);

    return {
      boqId: current.id,
      addedCount: toAdd.length,
      skippedCount: summary.skippedCount,
      alreadyPresentCount: alreadyPresentIds.size,
      unreviewedAddedCount,
      reviewedAddedCount,
      measurementIncompleteAddedCount,
      inferredMeasurementAddedCount,
      systemValidated: autonomousMode,
      readyForRates:
        autonomousMode
        && toAdd.length > 0
        && measurementIncompleteAddedCount === 0,
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}

export async function confirmAiDraftQuantities(actor: CurrentActor, boqId: string) {
  requireCapability(actor, "verification:manage");

  return prisma.$transaction(async (tx) => {
    const current = await getBOQRecord(actor.companyId, boqId, tx);
    assertAiDraftEditable(current);

    const linkedItems = current.sections
      .flatMap((section) => section.items)
      .flatMap((item) => {
        const provenance = item.quantityProvenance;
        const extractedEntityId =
          provenance?.extractedEntityId
          ?? getAiDraftExtractedEntityId(item.sourceReference);

        if (!provenance || !extractedEntityId) return [];

        const unreviewedAiQuantity =
          provenance.sourceType === QuantityProvenanceSource.LEGACY_UNVERIFIED;
        const manuallyReviewedAiQuantity =
          provenance.sourceType === QuantityProvenanceSource.MANUAL_CONFIRMED
          && provenance.confirmedAt !== null
          && getAiDraftExtractedEntityId(item.sourceReference) !== null;
        const aiSuggestedQuantity =
          unreviewedAiQuantity
          && hasAiMeasurementSuggestion(item.sourceReference);

        if (!unreviewedAiQuantity && !manuallyReviewedAiQuantity) return [];

        return [{
          item,
          provenance,
          extractedEntityId,
          quantityCalculationId:
            provenance.quantityCalculationId,
          manuallyReviewedAiQuantity,
          aiSuggestedQuantity,
        }];
      });

    if (linkedItems.length === 0) {
      return { confirmedCount: 0, skippedCount: 0, remainingCount: 0, skippedItems: [] };
    }

    const entityIds = linkedItems.map((entry) => entry.extractedEntityId);

    const entities = await tx.extractedEntity.findMany({
      where: {
        id: { in: entityIds },
        companyId: actor.companyId,
        projectId: current.projectId,
      },
    });
    const entityById = new Map(entities.map((entity) => [entity.id, entity]));

    const quantityCalculationIds = [
      ...new Set(
        linkedItems
          .map(
            (entry) =>
              entry.quantityCalculationId
          )
          .filter(
            (value): value is string =>
              Boolean(value)
          )
      )
    ];

    const tayqanCalculations =
      quantityCalculationIds.length > 0
        ? await tx.quantityCalculation.findMany({
            where: {
              id: {
                in: quantityCalculationIds,
              },
              companyId: actor.companyId,
              projectId: current.projectId,
              calculatedBy: {
                startsWith:
                  TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,
              },
              status: {
                not: "REJECTED",
              },
            },
          })
        : [];

    const tayqanCalculationById =
      new Map(
        tayqanCalculations.map(
          (calculation) =>
            [calculation.id, calculation] as const
        )
      );

    const now = new Date();
    let confirmedCount = 0;
    let skippedCount = 0;
    // TAYQAN-AI-DRAFT-LOOP-FIX: without this, an item this function can never
    // auto-confirm (e.g. its extracted entity has quantity===null, no AI
    // measurement suggestion, no TAYQAN calculation) was silently counted
    // into skippedCount with zero indication of which item, or that a direct
    // manual edit+save of that exact row (which DOES correctly clear it via
    // syncSectionItems -> confirmManualQuantityProvenance) is the only way
    // out. The "Check again" loop then repeats the same generic blocker
    // message forever. Bounded the same way pendingItems is bounded below.
    const skippedItems: Array<{ id: string; itemCode: string; description: string }> = [];

    for (const {
      item,
      provenance,
      extractedEntityId,
      quantityCalculationId,
      manuallyReviewedAiQuantity,
      aiSuggestedQuantity,
    } of linkedItems) {
      const entity = entityById.get(extractedEntityId);

      if (!entity) {
        skippedCount += 1;
        skippedItems.push({ id: item.id, itemCode: item.itemCode, description: item.description });
        continue;
      }

      if (entity.status === "IMPORTED") {
        confirmedCount += 1;
        continue;
      }

      const tayqanCalculation =
        quantityCalculationId
          ? tayqanCalculationById.get(
              quantityCalculationId
            ) ?? null
          : null;

      const tayqanCalculatedQuantity =
        Boolean(
          provenance.sourceType
            === QuantityProvenanceSource.LEGACY_UNVERIFIED
          && tayqanCalculation
          && tayqanCalculation.resultValue.equals(
            item.quantity
          )
          && tayqanCalculation.resultUnit.trim()
            === item.unit.trim()
        );

      const quantityMatchesExtraction =
        entity.quantity !== null
        && entity.quantity.equals(item.quantity)
        && (entity.unit ?? "").trim() === item.unit.trim();

      const boqMeasurementComplete =
        item.quantity.toNumber() > 0 && item.unit.trim().length > 0;

      if (
        !manuallyReviewedAiQuantity
        && !aiSuggestedQuantity
        && !tayqanCalculatedQuantity
        && !quantityMatchesExtraction
      ) {
        // This item structurally cannot be auto-confirmed by this button —
        // e.g. its extracted entity never had a measured quantity, and
        // nothing (AI suggestion, TAYQAN calculation) has proposed one
        // since. The only way to clear it is a genuine manual edit+save of
        // this exact row in the BOQ editor.
        skippedCount += 1;
        skippedItems.push({ id: item.id, itemCode: item.itemCode, description: item.description });
        continue;
      }

      if (
        (
          manuallyReviewedAiQuantity
          || aiSuggestedQuantity
          || tayqanCalculatedQuantity
        )
        && !boqMeasurementComplete
      ) {
        skippedCount += 1;
        skippedItems.push({ id: item.id, itemCode: item.itemCode, description: item.description });
        continue;
      }

      const extractionWasCorrectedInBoq =
        (
          manuallyReviewedAiQuantity
          || aiSuggestedQuantity
          || tayqanCalculatedQuantity
        )
        && !quantityMatchesExtraction;
      const correctionReason =
        tayqanCalculatedQuantity
          ? "Accepted TAYQAN measured quantity during professional AI Draft BOQ review."
          : aiSuggestedQuantity
            ? "Accepted AI measurement suggestion during AI Draft BOQ review."
            : "Corrected during AI Draft BOQ review.";

      if (REVIEWABLE_ENTITY_STATUSES.has(entity.status)) {
        const original = {
          label: entity.label,
          quantity: entity.quantity?.toNumber() ?? null,
          unit: entity.unit,
        };

        const claimedEntity = await tx.extractedEntity.updateMany({
          where: {
            id: entity.id,
            companyId: actor.companyId,
            projectId: current.projectId,
            status: { in: ["EXTRACTED", "NEEDS_REVIEW"] },
          },
          data: {
            status: "IMPORTED",
            ...(extractionWasCorrectedInBoq
              ? {
                  quantity: item.quantity,
                  unit: item.unit,
                  correctionJson: {
                    original,
                    corrected: {
                      quantity: item.quantity.toNumber(),
                      unit: item.unit,
                    },
                    correctedByUserId: actor.userId,
                    correctedAt: now.toISOString(),
                    reason: correctionReason,
                  },
                }
              : {}),
            confirmedByUserId: actor.userId,
            confirmedAt: now,
          },
        });

        if (claimedEntity.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_ENTITY_CONFIRMATION_CONFLICT",
            "An extracted item changed while AI Draft quantities were being confirmed. Reload and try again.",
          );
        }

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: entity.id,
          action: extractionWasCorrectedInBoq ? "ENTITY_CORRECTED" : "ENTITY_CONFIRMED",
          actorName: actor.fullName,
          payload: extractionWasCorrectedInBoq
            ? {
                original,
                corrected: {
                  quantity: item.quantity.toNumber(),
                  unit: item.unit,
                },
                reason: correctionReason,
              }
            : { source: "AI_DRAFT_BOQ_REVIEW" },
        }, tx);

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: entity.id,
          action: "ENTITY_IMPORTED_TO_BOQ",
          actorName: actor.fullName,
          payload: { boqId: current.id, source: "AI_DRAFT" },
        }, tx);
      } else if (entity.status === "CONFIRMED" || entity.status === "CORRECTED") {
        const original = {
          label: entity.label,
          quantity: entity.quantity?.toNumber() ?? null,
          unit: entity.unit,
        };

        const imported = await tx.extractedEntity.updateMany({
          where: {
            id: entity.id,
            companyId: actor.companyId,
            projectId: current.projectId,
            status: { in: ["CONFIRMED", "CORRECTED"] },
          },
          data: {
            status: "IMPORTED",
            ...(extractionWasCorrectedInBoq
              ? {
                  quantity: item.quantity,
                  unit: item.unit,
                  correctionJson: {
                    original,
                    corrected: {
                      quantity: item.quantity.toNumber(),
                      unit: item.unit,
                    },
                    correctedByUserId: actor.userId,
                    correctedAt: now.toISOString(),
                    reason: correctionReason,
                  },
                  confirmedByUserId: actor.userId,
                  confirmedAt: now,
                }
              : {}),
          },
        });

        if (imported.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_ENTITY_IMPORT_CONFLICT",
            "A reviewed extraction changed while AI Draft quantities were being confirmed. Reload and try again.",
          );
        }

        if (extractionWasCorrectedInBoq) {
          await createAuditLog(actor.companyId, {
            entityType: "ExtractedEntity",
            entityId: entity.id,
            action: "ENTITY_CORRECTED",
            actorName: actor.fullName,
            payload: {
              original,
              corrected: {
                quantity: item.quantity.toNumber(),
                unit: item.unit,
              },
              reason: correctionReason,
            },
          }, tx);
        }

        await createAuditLog(actor.companyId, {
          entityType: "ExtractedEntity",
          entityId: entity.id,
          action: "ENTITY_IMPORTED_TO_BOQ",
          actorName: actor.fullName,
          payload: { boqId: current.id, source: "AI_DRAFT" },
        }, tx);
      } else if (!REVIEWED_ENTITY_STATUSES.has(entity.status)) {
        skippedCount += 1;
        skippedItems.push({ id: item.id, itemCode: item.itemCode, description: item.description });
        continue;
      }

      if (
        tayqanCalculatedQuantity
        && tayqanCalculation
      ) {
        const claimedCalculation =
          await tx.quantityCalculation.updateMany({
            where: {
              id: tayqanCalculation.id,
              companyId: actor.companyId,
              projectId: current.projectId,
              calculatedBy: {
                startsWith:
                  TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,
              },
              status: {
                not: "REJECTED",
              },
              confirmedAt: null,
            },
            data: {
              status: "CONFIRMED",
              confirmedByUserId: actor.userId,
              confirmedAt: now,
            },
          });

        if (claimedCalculation.count !== 1) {
          throw new ConflictError(
            "TAYQAN_CALCULATION_CONFIRMATION_CONFLICT",
            "The TAYQAN measurement changed while professional acceptance was being recorded. Reload and try again.",
          );
        }

        await createAuditLog(
          actor.companyId,
          {
            entityType: "QuantityCalculation",
            entityId: tayqanCalculation.id,
            action: "CALCULATION_CONFIRMED",
            actorName: actor.fullName,
            payload: {
              source:
                "AI_DRAFT_TAYQAN_REVIEW",
              boqItemId: item.id,
            },
          },
          tx
        );
      }

      if (provenance.sourceType === QuantityProvenanceSource.LEGACY_UNVERIFIED) {
        const claimedProvenance = await tx.bOQItemQuantityProvenance.updateMany({
          where: {
            id: provenance.id,
            companyId: actor.companyId,
            boqItemId: item.id,
            sourceType: QuantityProvenanceSource.LEGACY_UNVERIFIED,
          },
          data: {
            sourceType:
              tayqanCalculatedQuantity
                ? QuantityProvenanceSource.CONFIRMED_CALCULATION
                : QuantityProvenanceSource.REVIEWED_EXTRACTION,
            quantitySnapshot: item.quantity,
            unitSnapshot: item.unit,
            confirmedByUserId: actor.userId,
            confirmedByName: actor.fullName,
            confirmedAt: now,
          },
        });

        if (claimedProvenance.count !== 1) {
          throw new ConflictError(
            "AI_DRAFT_CONFIRMATION_CONFLICT",
            "The AI Draft changed while quantities were being confirmed. Reload and try again.",
          );
        }
      }

      confirmedCount += 1;
    }

    await createAuditLog(actor.companyId, {
      entityType: "BOQ",
      entityId: current.id,
      action: "AI_DRAFT_QUANTITIES_CONFIRMED",
      actorName: actor.fullName,
      payload: {
        confirmedCount,
        skippedCount,
        remainingCount: linkedItems.length - confirmedCount,
      },
    }, tx);

    return {
      confirmedCount,
      skippedCount,
      remainingCount: linkedItems.length - confirmedCount,
      // Bounded so a large BOQ never balloons this response — enough to name
      // the first handful of items a human needs to go edit directly.
      skippedItems: skippedItems.slice(0, 10),
    };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable });
}
