import type { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  tayqanMeasurementExceptionKindSchema,
  tayqanMeasurementPlanSchema,
  type TayqanMeasurementException,
  type TayqanMeasurementPlan,
  type TayqanMeasurementSubject,
} from "@/lib/tayqan/tayqan-measurement-contract";

export type TayqanMeasurementPageRole =
  | "PLAN"
  | "SECTION"
  | "SCHEDULE"
  | "DETAIL"
  | "MEP"
  | "OTHER";

export type TayqanMeasurementGoverningContext = {
  projectCategory: string | null;
  categoryScope: string | null;
  measurementStandard: string | null;
  exclusions: string | null;
  deadlineText: string | null;
  specialInstructions: string | null;
  pricingBasis: string | null;
  authoritativeSourcePolicy: string | null;
};

export type TayqanMeasurementPageEvidence = {
  id: string;
  projectFileId: string;
  originalName: string;
  pageNumber: number;
  drawingNumber: string | null;
  drawingTitle: string | null;
  revisionNumber: string | null;
  discipline: string | null;
  drawingType: string | null;
  sheetName: string | null;
  role: TayqanMeasurementPageRole;
  width: number | null;
  height: number | null;
  dpi: number | null;
  text: string | null;
  drawingTitles: string[];
  technicalLines: string[];
  detectedScale: string | null;
  scaleVerified: boolean;
  scaleRatio: number | null;
  drawingUnit: string | null;
  realWorldUnit: string | null;
  hasImage: boolean;
};

export type TayqanMeasurementExistingEntityEvidence = {
  id: string;
  projectFileId: string;
  drawingPageId: string | null;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  status: string;
  sourceText: string | null;
  sourceReference: string | null;
  technicalData: Prisma.JsonValue | null;
};

export type TayqanMeasurementRoomEvidence = {
  id: string;
  drawingPageId: string | null;
  roomName: string;
  roomNumber: string | null;
  area: number | null;
  perimeter: number | null;
  ceilingHeight: number | null;
  floorLevel: string | null;
  scaleVerified: boolean;
  confidence: number;
  status: string;
};

export type TayqanMeasurementEvidenceBundle = {
  project: {
    id: string;
    slug: string;
    name: string;
    reference: string;
  };
  governingContext: TayqanMeasurementGoverningContext | null;
  sourceFileIds: string[];
  pages: TayqanMeasurementPageEvidence[];
  existingEntities: TayqanMeasurementExistingEntityEvidence[];
  rooms: TayqanMeasurementRoomEvidence[];
};

export type TayqanMeasurementCluster = {
  key: string;
  discipline: string;
  pageIds: string[];
};

export type TayqanMeasurementReasonerProgress = {
  phase: "CLUSTER_REVIEW_COMPLETE" | "GLOBAL_REVIEW_BATCH_COMPLETE";
  completed: number;
  total: number;
};

export type TayqanMeasurementReasonerInput = {
  bundle: TayqanMeasurementEvidenceBundle;
  loadPageImageDataUrl: (pageId: string) => Promise<string | null>;
  /** Optional durable-work heartbeat. It carries no drawing bytes or quantities. */
  onProgress?: (progress: TayqanMeasurementReasonerProgress) => Promise<void>;
};

export const tayqanSeniorReviewSchema = z.object({
  decisions: z.array(z.object({
    proposalKey: z.string().trim().min(1).max(900),
    decision: z.enum(["ACCEPT", "REJECT"]),
    exceptionKind: tayqanMeasurementExceptionKindSchema.nullable(),
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    message: z.string().trim().min(1).max(1_500),
    pageIds: z.array(z.string().uuid()).min(1).max(16),
  }).strict()).max(350),
  findings: z.array(z.object({
    kind: tayqanMeasurementExceptionKindSchema,
    severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
    message: z.string().trim().min(1).max(1_500),
    pageIds: z.array(z.string().uuid()).min(1).max(16),
    relatedProposalKeys: z.array(z.string().trim().min(1).max(900)).max(24),
  }).strict()).max(350),
}).strict();

export type TayqanSeniorReview = z.infer<typeof tayqanSeniorReviewSchema>;
export type TayqanSeniorReviewDecision = TayqanSeniorReview["decisions"][number];
export type TayqanSeniorReviewFinding = TayqanSeniorReview["findings"][number];
export type TayqanSeniorReviewSeverity = TayqanSeniorReviewDecision["severity"];

export type TayqanSeniorReviewSummary = {
  clusterReviewCount: number;
  globalReviewApplied: boolean;
  acceptedSubjectCount: number;
  rejectedSubjectCount: number;
  findingCount: number;
  evidencePageCoveragePercent: number;
};

export type TayqanMeasurementReasonerResult = {
  provider: string;
  model: string;
  responseIds: string[];
  plan: TayqanMeasurementPlan;
  seniorReview: TayqanSeniorReviewSummary;
};

export type TayqanMeasurementReasoner = (
  input: TayqanMeasurementReasonerInput,
) => Promise<TayqanMeasurementReasonerResult>;

function normalized(value: string | null | undefined): string {
  return (value ?? "").trim().toUpperCase();
}

function normalizedScopeText(value: string): string {
  return value
    .normalize("NFKC")
    .trim()
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyTayqanDrawingPageRole(input: {
  drawingType?: string | null;
  drawingTitle?: string | null;
  sheetName?: string | null;
  drawingTitles?: readonly string[];
  discipline?: string | null;
}): TayqanMeasurementPageRole {
  const haystack = [
    input.drawingType,
    input.drawingTitle,
    input.sheetName,
    ...(input.drawingTitles ?? []),
  ]
    .map(normalized)
    .filter(Boolean)
    .join(" ");

  if (/\bSCHEDULE\b|جدول/.test(haystack)) return "SCHEDULE";
  if (/\bSECTION\b|\bELEVATION\b|قطاع|مقطع|واجهة/.test(haystack)) return "SECTION";
  if (/\bDETAIL\b|تفصيل/.test(haystack)) return "DETAIL";
  if (/\bPLAN\b|\bLAYOUT\b|\bGA\b|مخطط|مسقط/.test(haystack)) return "PLAN";

  const discipline = normalized(input.discipline);
  if (/MEP|HVAC|MECHANICAL|ELECTRICAL|PLUMBING|FIRE|ELV/.test(discipline)) {
    return "MEP";
  }
  return "OTHER";
}

function pageReferenceHaystack(page: TayqanMeasurementPageEvidence): string {
  return [
    page.text ?? "",
    page.drawingTitle ?? "",
    page.sheetName ?? "",
    ...page.drawingTitles,
    ...page.technicalLines,
  ]
    .join("\n")
    .toUpperCase();
}

function directReferencedPageIds(
  sourcePages: readonly TayqanMeasurementPageEvidence[],
  allPages: readonly TayqanMeasurementPageEvidence[],
): string[] {
  const haystack = sourcePages.map(pageReferenceHaystack).join("\n");
  const sourceIds = new Set(sourcePages.map((page) => page.id));
  const referenced: string[] = [];

  for (const candidate of allPages) {
    if (sourceIds.has(candidate.id)) continue;
    const drawingNumber = candidate.drawingNumber?.trim();
    if (!drawingNumber || drawingNumber.length < 3) continue;
    if (haystack.includes(drawingNumber.toUpperCase())) {
      referenced.push(candidate.id);
    }
  }

  return referenced;
}

/**
 * Senior-QS page clustering.
 *
 * Every page is covered at least once. Primary plan/MEP/other pages are grouped
 * by discipline, while section/schedule/detail anchors and explicit drawing
 * call-outs are pulled into the same bounded cluster. This mirrors how a senior
 * QS follows plan call-outs to sections/details instead of measuring each sheet
 * in isolation.
 */
export function buildTayqanMeasurementClusters(
  pages: readonly TayqanMeasurementPageEvidence[],
  maximumPagesPerCluster = 8,
): TayqanMeasurementCluster[] {
  if (maximumPagesPerCluster < 3) {
    throw new Error("TAYQAN senior measurement clusters require at least three page slots.");
  }

  const groups = new Map<string, TayqanMeasurementPageEvidence[]>();
  for (const page of pages) {
    const discipline = normalized(page.discipline) || "UNSPECIFIED";
    const current = groups.get(discipline) ?? [];
    current.push(page);
    groups.set(discipline, current);
  }

  const clusters: TayqanMeasurementCluster[] = [];

  for (const [discipline, groupPages] of groups) {
    const anchors = groupPages
      .filter((page) => ["SCHEDULE", "SECTION", "DETAIL"].includes(page.role))
      .sort((a, b) => a.pageNumber - b.pageNumber)
      .slice(0, 3);

    const anchorIds = new Set(anchors.map((page) => page.id));
    const primaryPages = groupPages.filter((page) => !anchorIds.has(page.id));
    const reservedForReferences = 2;
    const primaryChunkSize = Math.max(
      1,
      maximumPagesPerCluster - anchors.length - reservedForReferences,
    );

    const primaryChunks = primaryPages.length > 0
      ? Array.from(
          { length: Math.ceil(primaryPages.length / primaryChunkSize) },
          (_, index) => primaryPages.slice(
            index * primaryChunkSize,
            (index + 1) * primaryChunkSize,
          ),
        )
      : [[]];

    for (const [index, primaryChunk] of primaryChunks.entries()) {
      const referencedIds = directReferencedPageIds(primaryChunk, pages).slice(0, reservedForReferences);
      const referencedPages = referencedIds
        .map((id) => pages.find((page) => page.id === id))
        .filter((page): page is TayqanMeasurementPageEvidence => Boolean(page));

      const combined = [...primaryChunk, ...referencedPages, ...anchors]
        .filter(
          (page, pageIndex, all) =>
            all.findIndex((candidate) => candidate.id === page.id) === pageIndex,
        )
        .slice(0, maximumPagesPerCluster);

      if (combined.length === 0) continue;
      clusters.push({
        key: `${discipline}:${index + 1}`,
        discipline,
        pageIds: combined.map((page) => page.id),
      });
    }
  }

  const covered = new Set(clusters.flatMap((cluster) => cluster.pageIds));
  for (const page of pages) {
    if (!covered.has(page.id)) {
      clusters.push({
        key: `${normalized(page.discipline) || "UNSPECIFIED"}:recovery:${page.pageNumber}`,
        discipline: normalized(page.discipline) || "UNSPECIFIED",
        pageIds: [page.id],
      });
    }
  }

  return clusters;
}

export function tayqanMeasurementProposalKey(
  subject: TayqanMeasurementSubject,
): string {
  if (subject.existingEntityId) {
    return `existing:${subject.existingEntityId}:${subject.calculationType}`;
  }

  return [
    "new",
    subject.entityType,
    subject.calculationType,
    normalizedScopeText(subject.workPackage),
    normalizedScopeText(subject.location ?? ""),
    normalizedScopeText(subject.label),
    subject.primaryPageId,
  ].join(":");
}

export function mergeTayqanMeasurementPlans(
  plans: readonly TayqanMeasurementPlan[],
): TayqanMeasurementPlan {
  const subjects = [] as TayqanMeasurementPlan["subjects"];
  const exceptions = [] as TayqanMeasurementPlan["exceptions"];
  const seenSubjectKeys = new Set<string>();
  const seenExceptionKeys = new Set<string>();
  const proposalKeysByExistingEntityId = new Map<string, Set<string>>();

  for (const plan of plans) {
    for (const subject of plan.subjects) {
      const key = tayqanMeasurementProposalKey(subject);
      if (seenSubjectKeys.has(key)) continue;
      seenSubjectKeys.add(key);
      subjects.push(subject);

      if (subject.existingEntityId) {
        const keys = proposalKeysByExistingEntityId.get(subject.existingEntityId)
          ?? new Set<string>();
        keys.add(key);
        proposalKeysByExistingEntityId.set(subject.existingEntityId, keys);
      }
    }

    for (const exception of plan.exceptions) {
      const key = `${exception.kind}:${exception.relatedEntityId ?? ""}:${exception.message}:${[...exception.pageIds].sort().join(",")}`;
      if (seenExceptionKeys.has(key)) continue;
      seenExceptionKeys.add(key);
      exceptions.push(exception);
    }
  }

  const conflictedEntityIds = new Set(
    [...proposalKeysByExistingEntityId.entries()]
      .filter(([, keys]) => keys.size > 1)
      .map(([entityId]) => entityId),
  );

  for (const entityId of conflictedEntityIds) {
    const affected = subjects.filter((subject) => subject.existingEntityId === entityId);
    const pageIds = [...new Set(affected.flatMap((subject) => subject.evidencePageIds))].slice(0, 16);
    const exception: TayqanMeasurementException = {
      kind: "COMPOSITE_SCOPE_REQUIRES_SPLIT",
      message:
        "One extracted entity was proposed as multiple payable measurement scopes. TAYQAN must create separate derived BOQ candidates (existingEntityId=null) for distinct payable scopes instead of collapsing multiple calculators onto one source entity.",
      pageIds,
      relatedEntityId: entityId,
    };
    const key = `${exception.kind}:${entityId}:${pageIds.sort().join(",")}`;
    if (!seenExceptionKeys.has(key)) {
      seenExceptionKeys.add(key);
      exceptions.push(exception);
    }
  }

  const safeSubjects = subjects.filter(
    (subject) => !subject.existingEntityId || !conflictedEntityIds.has(subject.existingEntityId),
  );

  return tayqanMeasurementPlanSchema.parse({ subjects: safeSubjects, exceptions });
}

export function applyTayqanSeniorReview(
  plan: TayqanMeasurementPlan,
  review: TayqanSeniorReview,
  allowedPageIds: ReadonlySet<string>,
): {
  plan: TayqanMeasurementPlan;
  acceptedCount: number;
  rejectedCount: number;
  findingCount: number;
} {
  const subjectByKey = new Map(
    plan.subjects.map((subject) => [tayqanMeasurementProposalKey(subject), subject] as const),
  );
  const decisionByKey = new Map<string, TayqanSeniorReviewDecision>();

  for (const decision of review.decisions) {
    if (!subjectByKey.has(decision.proposalKey)) {
      throw new Error(`Senior TAYQAN review referenced unknown proposal key "${decision.proposalKey}".`);
    }
    if (decisionByKey.has(decision.proposalKey)) {
      throw new Error(`Senior TAYQAN review duplicated proposal decision "${decision.proposalKey}".`);
    }
    for (const pageId of decision.pageIds) {
      if (!allowedPageIds.has(pageId)) {
        throw new Error("Senior TAYQAN review referenced a page outside the frozen source scope.");
      }
    }
    if (decision.pageIds.length === 0) {
      throw new Error("Senior TAYQAN decision must cite at least one frozen-scope evidence page.");
    }
    if (decision.decision === "ACCEPT" && decision.exceptionKind !== null) {
      throw new Error("Senior TAYQAN acceptance cannot carry an exception kind.");
    }
    if (decision.decision === "REJECT" && decision.exceptionKind === null) {
      throw new Error("Senior TAYQAN rejection must carry an explicit exception kind.");
    }
    decisionByKey.set(decision.proposalKey, decision);
  }

  for (const key of subjectByKey.keys()) {
    if (!decisionByKey.has(key)) {
      throw new Error(`Senior TAYQAN review omitted proposal decision "${key}".`);
    }
  }

  for (const finding of review.findings) {
    if (finding.pageIds.length === 0) {
      throw new Error("Senior TAYQAN finding must cite at least one frozen-scope evidence page.");
    }
    for (const pageId of finding.pageIds) {
      if (!allowedPageIds.has(pageId)) {
        throw new Error("Senior TAYQAN finding referenced a page outside the frozen source scope.");
      }
    }
    for (const proposalKey of finding.relatedProposalKeys) {
      if (!subjectByKey.has(proposalKey)) {
        throw new Error(`Senior TAYQAN finding referenced unknown proposal key "${proposalKey}".`);
      }
    }
  }

  const acceptedSubjects: TayqanMeasurementSubject[] = [];
  const reviewExceptions: TayqanMeasurementException[] = [];
  let rejectedCount = 0;

  for (const [key, subject] of subjectByKey) {
    const decision = decisionByKey.get(key)!;
    if (decision.decision === "ACCEPT") {
      acceptedSubjects.push(subject);
      continue;
    }

    rejectedCount += 1;
    reviewExceptions.push({
      kind: decision.exceptionKind!,
      message: `[Senior checker ${decision.severity}] ${decision.message}`,
      pageIds: decision.pageIds,
      relatedEntityId: subject.existingEntityId,
    });
  }

  for (const finding of review.findings) {
    reviewExceptions.push({
      kind: finding.kind,
      message: `[Senior checker ${finding.severity}] ${finding.message}`,
      pageIds: finding.pageIds,
      relatedEntityId: finding.relatedProposalKeys
        .map((key) => subjectByKey.get(key)?.existingEntityId ?? null)
        .find((value): value is string => Boolean(value)) ?? null,
    });
  }

  return {
    plan: mergeTayqanMeasurementPlans([
      { subjects: acceptedSubjects, exceptions: plan.exceptions },
      { subjects: [], exceptions: reviewExceptions },
    ]),
    acceptedCount: acceptedSubjects.length,
    rejectedCount,
    findingCount: review.findings.length,
  };
}

export function calculateTayqanEvidencePageCoveragePercent(
  plan: TayqanMeasurementPlan,
  pages: readonly TayqanMeasurementPageEvidence[],
): number {
  if (pages.length === 0) return 100;
  const referenced = new Set<string>();
  for (const subject of plan.subjects) {
    for (const pageId of subject.evidencePageIds) referenced.add(pageId);
  }
  for (const exception of plan.exceptions) {
    for (const pageId of exception.pageIds) referenced.add(pageId);
  }
  return Math.round((referenced.size / pages.length) * 10_000) / 100;
}
