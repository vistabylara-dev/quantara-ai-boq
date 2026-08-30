import { beforeAll, describe, expect, it, vi } from "vitest";
import { ExtractedEntityType, UserRole } from "@prisma/client";
import type { CurrentActor } from "../src/lib/auth/current-actor";
import { prisma } from "../src/lib/db/prisma";
import { getSourceProcessingCapability } from "../src/lib/files/source-processing-capability";
import { pickLatestRevisionFileIdPerDrawing } from "../src/lib/services/tayqan-work-order-service";
import { prepareTayqanMeasurementProposals } from "../src/lib/services/tayqan-measurement-service";
import type { TayqanMeasurementReasonerResult } from "../src/lib/tayqan/tayqan-measurement-reasoner";
import { requireIsolatedLocalTestDatabase } from "./helpers/require-isolated-test-database";

const RUN_ID = `${Date.now()}-${process.pid}`;

const EMPTY_SENIOR_REVIEW = {
  clusterReviewCount: 0,
  globalReviewApplied: false,
  acceptedSubjectCount: 0,
  rejectedSubjectCount: 0,
  findingCount: 0,
  evidencePageCoveragePercent: 100,
};

describe("PR2 gap 4: revision-number-aware source authority (pure, no database)", () => {
  it("prefers a real, deterministic revision-number comparison over upload-recency when every competing file's revision parses", () => {
    // Newest-upload-first order, matching sourceRequirements()'s own query order.
    // The NEWEST upload (fileNewer) has the LOWER revision number "R01"; the
    // OLDER upload (fileOlder) has the HIGHER "R03" — proving this genuinely
    // prefers the parsed number over recency, not just agreeing with it by luck.
    const files = [
      { id: "file-newer-upload-lower-revision", drawingNumber: "A-101", revisionNumber: "R01" },
      { id: "file-older-upload-higher-revision", drawingNumber: "A-101", revisionNumber: "R03" },
      { id: "file-middle-upload", drawingNumber: "A-101", revisionNumber: "R02" },
    ];
    const winners = pickLatestRevisionFileIdPerDrawing(files);
    expect(winners.get("A-101")).toBe("file-older-upload-higher-revision");
  });

  it("falls back to upload-recency, unchanged, when any competing file's revision string doesn't match the strict parseable format", () => {
    // Real-world drawing-office revision strings ("A", "P2", "Issue 3") never
    // match parseRevisionNumber's strict R\d{2,} format — this must not throw
    // or guess a semantic ordering; it must behave exactly as before PR2.
    const files = [
      { id: "file-newest-upload", drawingNumber: "A-101", revisionNumber: "P2" },
      { id: "file-older-upload", drawingNumber: "A-101", revisionNumber: "A" },
    ];
    const winners = pickLatestRevisionFileIdPerDrawing(files);
    expect(winners.get("A-101")).toBe("file-newest-upload");
  });

  it("falls back to upload-recency when a revision is missing entirely", () => {
    const files = [
      { id: "file-newest-upload", drawingNumber: "A-101", revisionNumber: null },
      { id: "file-older-upload", drawingNumber: "A-101", revisionNumber: "R05" },
    ];
    const winners = pickLatestRevisionFileIdPerDrawing(files);
    expect(winners.get("A-101")).toBe("file-newest-upload");
  });

  it("never applies to files with different drawing numbers", () => {
    const files = [
      { id: "file-a", drawingNumber: "A-101", revisionNumber: "R01" },
      { id: "file-b", drawingNumber: "A-102", revisionNumber: "R01" },
    ];
    const winners = pickLatestRevisionFileIdPerDrawing(files);
    expect(winners.get("A-101")).toBe("file-a");
    expect(winners.get("A-102")).toBe("file-b");
  });
});

describe("PR2 mission 6: the DWG/BIM/OCR capability boundary is unregressed", () => {
  it("still reports CAD_BIM_CONNECTOR_REQUIRED with canExtractTables/canRenderPages false for dwg/dxf/ifc/rvt", () => {
    for (const extension of ["dwg", "dxf", "ifc", "rvt"]) {
      const capability = getSourceProcessingCapability(extension);
      expect(capability.mode).toBe("CAD_BIM_CONNECTOR_REQUIRED");
      expect(capability.canExtractTables).toBe(false);
      expect(capability.canRenderPages).toBe(false);
      expect(capability.message).toMatch(/not currently enabled/i);
    }
  });

  it("still reports structured table extraction only for csv/xlsx, and PDF/image handling is unchanged", () => {
    expect(getSourceProcessingCapability("csv")).toMatchObject({ mode: "STRUCTURED_TABLE_EXTRACTION", canExtractTables: true, canRenderPages: false });
    expect(getSourceProcessingCapability("xlsx")).toMatchObject({ mode: "STRUCTURED_TABLE_EXTRACTION", canExtractTables: true, canRenderPages: false });
    expect(getSourceProcessingCapability("pdf")).toMatchObject({ mode: "PDF_TEXT_AND_PAGE_REVIEW", canExtractTables: true, canRenderPages: true });
    expect(getSourceProcessingCapability("png")).toMatchObject({ mode: "IMAGE_PAGE_REVIEW", canExtractTables: false, canRenderPages: true });
  });
});

describe("PR2 gaps 2 & 3: measurement service DB integration (real local Postgres)", () => {
  let companyId = "";
  let userId = "";
  let projectId = "";

  beforeAll(() => {
    requireIsolatedLocalTestDatabase();
  });

  async function actor(): Promise<CurrentActor> {
    return { userId, companyId, role: UserRole.COMPANY_OWNER, fullName: "PR2 Evidence Owner", email: `pr2-evidence-${RUN_ID}@example.com` };
  }

  async function ensureFixtures() {
    if (companyId) return;
    const industry = await prisma.industryEngine.findUniqueOrThrow({ where: { key: "construction" } });
    const company = await prisma.company.create({
      data: { legalName: `PR2 Evidence Co ${RUN_ID}`, tradeName: "PR2 Evidence", email: `pr2-evidence-co-${RUN_ID}@example.com` },
    });
    companyId = company.id;
    const [user, client] = await Promise.all([
      prisma.user.create({
        data: { companyId, email: `pr2-evidence-${RUN_ID}@example.com`, passwordHash: "test-fixture-not-a-real-hash", fullName: "PR2 Evidence Owner", role: UserRole.COMPANY_OWNER, emailVerifiedAt: new Date() },
      }),
      prisma.client.create({ data: { companyId, name: "PR2 Evidence Client", email: `pr2-evidence-client-${RUN_ID}@example.com` } }),
    ]);
    userId = user.id;
    const project = await prisma.project.create({
      data: { companyId, clientId: client.id, industryEngineId: industry.id, slug: `pr2-evidence-${RUN_ID}`, reference: `PR2-EVIDENCE-${RUN_ID}`, name: "PR2 Evidence Project" },
    });
    projectId = project.id;
  }

  async function createFileWithPage(originalName: string, drawingNumber: string, revisionNumber: string) {
    const file = await prisma.projectFile.create({
      data: {
        companyId, projectId, uploadedByUserId: userId, originalName, safeFileName: originalName,
        storageKey: `tests/${RUN_ID}/${originalName}-${Math.random()}`, mimeType: "application/pdf", extension: "pdf",
        fileSize: 100, checksum: `checksum-${RUN_ID}-${Math.random()}`, drawingNumber, revisionNumber,
      },
    });
    const page = await prisma.drawingPage.create({
      data: { companyId, projectFileId: file.id, pageNumber: 1 },
    });
    return { file, page };
  }

  function stubReasoner(result: Partial<TayqanMeasurementReasonerResult> & { captureBundle?: (bundle: unknown) => void }) {
    return async (input: { bundle: unknown }) => {
      const { captureBundle, ...resultOverrides } = result;
      captureBundle?.(input.bundle);
      return {
        provider: "test",
        model: "test",
        responseIds: [],
        plan: { subjects: [], exceptions: [] },
        seniorReview: EMPTY_SENIOR_REVIEW,
        ...resultOverrides,
      } as TayqanMeasurementReasonerResult;
    };
  }

  it("gap 2: an UPDATE_EXISTING_BOQ assignment's evidence bundle includes the target BOQ's current items — omitted entirely when targetBoqId is not supplied", async () => {
    await ensureFixtures();
    const { file } = await createFileWithPage(`gap2-${RUN_ID}.pdf`, `GAP2-${RUN_ID}`, "R01");

    const boq = await prisma.bOQ.create({ data: { companyId, projectId, title: `PR2 Gap 2 BOQ ${RUN_ID}`, revisionNumber: 1, version: 1 } });
    const section = await prisma.bOQSection.create({ data: { companyId, boqId: boq.id, code: "FND", title: "Foundations", sortOrder: 1 } });
    await prisma.bOQItem.create({
      data: {
        companyId, sectionId: section.id, itemNumber: 1, itemCode: "F-01", category: "Concrete",
        description: "Existing footing concrete, 25MPa", quantity: 12, unit: "m3", sortOrder: 1, status: "CONFIRMED",
      },
    });

    let capturedBundle: any = null;
    await prepareTayqanMeasurementProposals(
      await actor(), projectId,
      { projectId, sourceFileIds: [file.id], targetBoqId: boq.id },
      { reasoner: stubReasoner({ captureBundle: (bundle) => { capturedBundle = bundle; } }) },
    );

    expect(capturedBundle.existingBoqItems).toHaveLength(1);
    expect(capturedBundle.existingBoqItems[0]).toMatchObject({
      sectionCode: "FND", sectionTitle: "Foundations", itemCode: "F-01",
      description: "Existing footing concrete, 25MPa", quantity: 12, unit: "m3",
    });

    // Regression: when targetBoqId is omitted (every other deliverable type),
    // the bundle carries no existing-BOQ evidence at all — unchanged default.
    let capturedBundleNoTarget: any = null;
    await prepareTayqanMeasurementProposals(
      await actor(), projectId,
      { projectId, sourceFileIds: [file.id] },
      { reasoner: stubReasoner({ captureBundle: (bundle) => { capturedBundleNoTarget = bundle; } }) },
    );
    expect(capturedBundleNoTarget.existingBoqItems).toEqual([]);
  });

  it("gap 3: a genuine revision-mix condition across the frozen source scope produces a structured REVISION_CONFLICT exception from prepareTayqanMeasurementProposals — never an unhandled thrown Error", async () => {
    await ensureFixtures();
    // Two real DrawingPage rows for the SAME drawing number, DIFFERENT
    // revisions — a genuine, DB-backed revision-mix condition, not a
    // hand-built fixture divorced from the real query path.
    const { file: fileA, page: pageA } = await createFileWithPage(`gap3-a-${RUN_ID}.pdf`, `GAP3-${RUN_ID}`, "P01");
    const { file: fileB, page: pageB } = await createFileWithPage(`gap3-b-${RUN_ID}.pdf`, `GAP3-${RUN_ID}`, "P02");

    const conflictingSubject = {
      existingEntityId: null,
      primaryPageId: pageA.id,
      evidencePageIds: [pageA.id, pageB.id],
      entityType: ExtractedEntityType.WALL_FINISH,
      label: "Painted gypsum wall finish",
      workPackage: "Architectural finishes",
      location: "Level 01",
      measurementMethod: "AREA",
      methodSelectionRationale: "Wall finish is paid by measured surface area.",
      methodConfidence: 90,
      calculationType: "WALL_AREA",
      inputs: [
        { key: "wallLength", value: 6.2, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [pageA.id], evidenceRoomIds: [], evidenceNote: "Printed dimension on plan.", confidence: 90 },
        { key: "wallHeight", value: 3, unit: "m", derivation: "EXPLICIT_DIMENSION", evidencePageIds: [pageB.id], evidenceRoomIds: [], evidenceNote: "Printed dimension on section.", confidence: 90 },
      ],
      supportingChecks: [],
      rationale: "Measured from plan length and section height.",
      sourceSummary: "A-101 plan and section.",
      confidence: 90,
    };

    let threw: unknown = null;
    let outcome: Awaited<ReturnType<typeof prepareTayqanMeasurementProposals>> | null = null;
    try {
      outcome = await prepareTayqanMeasurementProposals(
        await actor(), projectId,
        { projectId, sourceFileIds: [fileA.id, fileB.id] },
        { reasoner: stubReasoner({ plan: { subjects: [conflictingSubject as never], exceptions: [] } }) },
      );
    } catch (error) {
      threw = error;
    }

    // The whole point of gap 3: this must NOT be an unhandled crash.
    expect(threw).toBeNull();
    expect(outcome).not.toBeNull();
    expect(outcome!.measuredSubjectCount).toBe(0);
    expect(outcome!.exceptionCount).toBeGreaterThan(0);
    const conflict = outcome!.exceptions.find((exception) => exception.kind === "REVISION_CONFLICT");
    expect(conflict).toBeDefined();
    expect(conflict!.message).toMatch(/mixed revisions/i);
    expect(conflict!.pageIds.sort()).toEqual([pageA.id, pageB.id].sort());

    // This exact exception kind already blocks PR1's gate: see
    // tests/tayqan-completion-correctness.test.ts "mission 2" (unchanged,
    // still passing), which seeds a REVISION_CONFLICT ledger entry and
    // confirms advanceTayqanWorkOrder blocks BOQ_ASSEMBLY and VALIDATION.
    // Since PR1's mirroring in advanceSourceProcessing copies every entry of
    // this exceptions array into that same ledger unconditionally (it does
    // not branch on exception.kind), this result flows into that same,
    // already-proven gate without any further wiring.
  });

  it("keeps the paid workflow alive when an AI proposal fails deterministic measurement validation", async () => {
    await ensureFixtures();
    const { file, page } = await createFileWithPage(`invalid-plan-${RUN_ID}.pdf`, `INVALID-${RUN_ID}`, "R01");
    const invalidSubject = {
      existingEntityId: null,
      primaryPageId: page.id,
      evidencePageIds: [page.id],
      entityType: ExtractedEntityType.WALL_FINISH,
      label: "Wall finish",
      workPackage: "Architectural finishes",
      location: "Level 01",
      measurementMethod: "AREA",
      methodSelectionRationale: "The finish is normally measured by area.",
      methodConfidence: 80,
      // Deliberately incompatible with AREA: the deterministic contract must
      // reject this proposal without crashing the whole work order.
      calculationType: "COUNT",
      inputs: [{ key: "count", value: 1, unit: "nr", derivation: "SCHEDULE_VALUE", evidencePageIds: [page.id], evidenceRoomIds: [], evidenceNote: "Test evidence.", confidence: 80 }],
      supportingChecks: [],
      rationale: "Deliberately invalid contract fixture.",
      sourceSummary: "Controlled test page.",
      confidence: 80,
    };

    const outcome = await prepareTayqanMeasurementProposals(
      await actor(), projectId,
      { projectId, sourceFileIds: [file.id] },
      { reasoner: stubReasoner({ plan: { subjects: [invalidSubject as never], exceptions: [] } }) },
    );

    expect(outcome.measuredSubjectCount).toBe(0);
    expect(outcome.exceptions).toContainEqual(expect.objectContaining({
      kind: "METHOD_SELECTION_UNCERTAIN",
      pageIds: [page.id],
      relatedEntityId: null,
    }));
  });

  it("checkpoints a fresh reasoner result before any downstream completion audit", async () => {
    await ensureFixtures();
    const { file } = await createFileWithPage(
      `provider-checkpoint-${RUN_ID}.pdf`,
      `PROVIDER-CHECKPOINT-${RUN_ID}`,
      "R01",
    );
    const before = await prisma.auditLog.count({
      where: {
        companyId,
        entityType: "Project",
        entityId: projectId,
        action: "TAYQAN_MEASUREMENT_PASS_COMPLETED",
      },
    });
    const checkpoint = vi.fn(async () => {
      throw new Error("controlled provider-result checkpoint failure");
    });

    await expect(prepareTayqanMeasurementProposals(
      await actor(),
      projectId,
      { projectId, sourceFileIds: [file.id] },
      {
        reasoner: stubReasoner({ responseIds: ["mock-response-checkpoint"] }),
        onReasonerResult: checkpoint,
      },
    )).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_PROVIDER_RESULT_CHECKPOINT_FAILED",
    });

    expect(checkpoint).toHaveBeenCalledTimes(1);
    await expect(prisma.auditLog.count({
      where: {
        companyId,
        entityType: "Project",
        entityId: projectId,
        action: "TAYQAN_MEASUREMENT_PASS_COMPLETED",
      },
    })).resolves.toBe(before);
  });

  it("stops before invoking the reasoner when the provider-attempt checkpoint cannot be confirmed", async () => {
    await ensureFixtures();
    const { file } = await createFileWithPage(
      `provider-attempt-checkpoint-${RUN_ID}.pdf`,
      `PROVIDER-ATTEMPT-CHECKPOINT-${RUN_ID}`,
      "R01",
    );
    const reasoner = vi.fn(async () => {
      throw new Error("the paid reasoner must not run before its attempt checkpoint");
    });
    const onReasonerStart = vi.fn(async () => {
      throw new Error("controlled provider-attempt checkpoint failure");
    });
    const onReasonerResult = vi.fn(async () => undefined);

    await expect(prepareTayqanMeasurementProposals(
      await actor(),
      projectId,
      { projectId, sourceFileIds: [file.id] },
      {
        reasoner,
        onReasonerStart,
        onReasonerResult,
      },
    )).rejects.toMatchObject({
      code: "TAYQAN_MEASUREMENT_PROVIDER_ATTEMPT_CHECKPOINT_FAILED",
    });

    expect(onReasonerStart).toHaveBeenCalledTimes(1);
    expect(reasoner).not.toHaveBeenCalled();
    expect(onReasonerResult).not.toHaveBeenCalled();
  });

  it("replays a validated provider result without constructing the reasoner and deduplicates the completion audit", async () => {
    await ensureFixtures();
    const { file } = await createFileWithPage(
      `provider-replay-${RUN_ID}.pdf`,
      `PROVIDER-REPLAY-${RUN_ID}`,
      "R01",
    );
    const replayResult: TayqanMeasurementReasonerResult = {
      provider: "mock-provider",
      model: "mock-model",
      responseIds: ["mock-response-replay"],
      plan: { subjects: [], exceptions: [] },
      seniorReview: EMPTY_SENIOR_REVIEW,
    };
    const forbiddenReasoner = vi.fn(async () => {
      throw new Error("the paid reasoner must not run during replay");
    });
    const operationId = `test-operation-${RUN_ID}-${file.id}`;

    for (let attempt = 0; attempt < 2; attempt += 1) {
      await prepareTayqanMeasurementProposals(
        await actor(),
        projectId,
        { projectId, sourceFileIds: [file.id] },
        {
          reasoner: forbiddenReasoner,
          replayReasonerResult: replayResult,
          completionAuditOperationId: operationId,
        },
      );
    }

    expect(forbiddenReasoner).not.toHaveBeenCalled();
    await expect(prisma.auditLog.count({
      where: {
        companyId,
        entityType: "Project",
        entityId: projectId,
        action: "TAYQAN_MEASUREMENT_PASS_COMPLETED",
        payloadJson: { path: ["operationId"], equals: operationId },
      },
    })).resolves.toBe(1);
  });
});
