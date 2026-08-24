import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(
    path.join(root, relativePath),
    "utf8",
  ).replace(/\r\n/g, "\n");
}

function functionBody(
  source: string,
  functionName: string,
): string {
  const marker = new RegExp(
    `\\b(?:export )?(?:async )?function ${functionName}\\b`,
  );

  const match = marker.exec(source);

  if (!match) {
    throw new Error(
      `Could not find function ${functionName}`,
    );
  }

  const start = match.index;

  const nextFunction =
    /\n(?:export )?(?:async )?function [A-Za-z0-9_]+/g;

  nextFunction.lastIndex =
    start + match[0].length;

  const next = nextFunction.exec(source);

  return next
    ? source.slice(start, next.index)
    : source.slice(start);
}

describe("TAYQAN Full-BOQ rescue regression", () => {
  it("locks aiDraft state and Word export readiness", () => {
    const service = read(
      "src/lib/services/tayqan-work-order-service.ts",
    );

    const panel = read(
      "src/components/tayqan/tayqan-work-order-panel.tsx",
    );

    expect(service).toContain(
      "const progress = parseProgress(order.progressJson);",
    );

    expect(service).toContain(
      "aiDraft: progress.aiDraft ?? null,",
    );

    expect(panel).toContain(
      "state.boqId && state.aiDraft && (state.aiDraft.addedCount > 0 || state.aiDraft.alreadyPresentCount > 0)",
    );

    type Draft = {
      addedCount: number;
      alreadyPresentCount: number;
    };

    const canExport = (
      boqId: string | null,
      aiDraft: Draft | null,
    ) =>
      Boolean(
        boqId
        && aiDraft
        && (
          aiDraft.addedCount > 0
          || aiDraft.alreadyPresentCount > 0
        ),
      );

    expect(
      canExport("boq-1", null),
    ).toBe(false);

    expect(
      canExport("boq-1", {
        addedCount: 0,
        alreadyPresentCount: 0,
      }),
    ).toBe(false);

    expect(
      canExport("boq-1", {
        addedCount: 1,
        alreadyPresentCount: 0,
      }),
    ).toBe(true);

    expect(
      canExport("boq-1", {
        addedCount: 0,
        alreadyPresentCount: 1,
      }),
    ).toBe(true);
  });

  it("locks structured-source bypass and full-BOQ safety ordering", () => {
    const service = read(
      "src/lib/services/tayqan-work-order-service.ts",
    );

    const sourceProcessing =
      functionBody(
        service,
        "advanceSourceProcessing",
      );

    const bypassIndex =
      sourceProcessing.indexOf(
        "if (drawingPagesCount === 0 && extractedEntitiesCount > 0) {",
      );

    const measurementIndex =
      sourceProcessing.indexOf(
        "const measurement = await prepareTayqanMeasurementProposals(",
      );

    expect(bypassIndex).toBeGreaterThan(-1);

    expect(measurementIndex)
      .toBeGreaterThan(bypassIndex);

    const bypassBlock =
      sourceProcessing.slice(
        bypassIndex,
        measurementIndex,
      );

    expect(bypassBlock).toContain(
      "releaseTayqanMeasurementLease",
    );

    expect(bypassBlock).toContain(
      "return advanceTayqanAiDraftWithLease(actor, projectSlug, leasedOrder);",
    );

    const draft =
      functionBody(
        service,
        "prepareTayqanAiDraft",
      );

    const generateIndex =
      draft.indexOf(
        "await generateAiDraftBoq(",
      );

    const dangerousGateIndex =
      draft.indexOf(
        "unresolvedDangerousMeasurementExceptions(",
      );

    expect(generateIndex)
      .toBeGreaterThan(-1);

    expect(dangerousGateIndex)
      .toBeGreaterThan(generateIndex);

    expect(draft).toContain(
      "await getBOQRecord(actor.companyId, boqId)",
    );

    expect(draft).toContain(
      "if (!aiDraft || !boqId || aiDraft.boqId !== boqId)",
    );

    expect(service).toContain(
      'const TAYQAN_AI_DRAFT_LEASE_CODE = "TAYQAN_AI_DRAFT_RUNNING"',
    );

    expect(service).toContain(
      "claimTayqanAiDraftLease",
    );

    expect(service).toContain(
      '"TAYQAN_AI_DRAFT_HANDOFF_FAILED"',
    );

    expect(draft).toContain(
      "i.quantityProvenance?.extractedEntityId ?? getAiDraftExtractedEntityId(i.sourceReference)",
    );

    expect(draft).toContain(
      '"SCOPE_COVERAGE_INCOMPLETE"',
    );

    expect(draft).toContain(
      "return fail(actor, loaded",
    );

    expect(draft).toContain(
      'error: { code: "SCOPE_COVERAGE_INCOMPLETE", reason }',
    );

    expect(draft).not.toMatch(
      /\b(?:bOQ|bOQItem)\.(?:delete|deleteMany)\b/,
    );

    expect(service).not.toContain(
      "FINALIZING_REVIEW_DRAFT",
    );
  });

  it("restarts terminal source jobs only from the explicit retry action", () => {
    const service = read(
      "src/lib/services/tayqan-work-order-service.ts",
    );

    const retryHelper = functionBody(
      service,
      "retryFailedSourceJobs",
    );
    const answerBlocker = functionBody(
      service,
      "answerTayqanWorkOrderBlocker",
    );

    expect(retryHelper).toContain(
      "latest?.status !== ExtractionJobStatus.FAILED && latest?.status !== ExtractionJobStatus.CANCELLED",
    );
    expect(retryHelper).toContain(
      "await extractionJobQueue.enqueue({",
    );
    expect(answerBlocker).toContain(
      'input.action === "RETRY" && order.blockerCode === "SOURCE_JOB_FAILED"',
    );
    expect(answerBlocker).toContain(
      "await retryFailedSourceJobs(actor, order);",
    );
  });

  it("re-enters idempotent queue recovery for non-terminal source jobs", () => {
    const service = read(
      "src/lib/services/tayqan-work-order-service.ts",
    );

    const sourceProcessing = functionBody(
      service,
      "advanceSourceProcessing",
    );
    const nonTerminalBranchStart = sourceProcessing.indexOf(
      "latest.status === ExtractionJobStatus.QUEUED || latest.status === ExtractionJobStatus.RUNNING",
    );
    const needsInputBranchStart = sourceProcessing.indexOf(
      "latest.status === ExtractionJobStatus.NEEDS_INPUT",
      nonTerminalBranchStart,
    );

    expect(nonTerminalBranchStart).toBeGreaterThan(-1);
    expect(needsInputBranchStart).toBeGreaterThan(nonTerminalBranchStart);

    const nonTerminalBranch = sourceProcessing.slice(
      nonTerminalBranchStart,
      needsInputBranchStart,
    );

    expect(nonTerminalBranch).toContain(
      "await extractionJobQueue.enqueue({",
    );
    expect(nonTerminalBranch).toContain(
      "projectFileId: file.id,",
    );
    expect(nonTerminalBranch).toContain(
      "engineType,",
    );
    expect(nonTerminalBranch).toContain(
      "pending += 1;",
    );
  });
});
