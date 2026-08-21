$ErrorActionPreference = "Stop"

$repo = "C:\Users\PC\Desktop\quantara-ai-boq"
$wt   = "$repo\.worktrees\tayqan-measurement-p0-20260817"

$expectedMain = "749b14f9b0e22fbe0a74f45091dfc26fd7f2eef5"
$branch = "fix/tayqan-completion-correctness-p1-20260818"

$vitest = "$repo\node_modules\.bin\vitest.cmd"
$eslint = "$repo\node_modules\.bin\eslint.cmd"

$existingFiles = @(
    "src/lib/services/ai-draft-boq-service.ts",
    "src/lib/services/tayqan-measurement-service.ts",
    "src/lib/services/tayqan-work-order-service.ts",
    "src/components/tayqan/tayqan-work-order-panel.tsx",
    "src/lib/validation/tayqan-schema.ts",
    "src/lib/i18n/dictionaries/en.ts",
    "src/lib/i18n/dictionaries/ar.ts"
)

$newTest = "tests/tayqan-completion-correctness.test.ts"

$allAllowedFiles = @(
    $existingFiles
    $newTest
)

$backups = @{}
$branchCreated = $false
$committed = $false

Write-Host "`n====================================================" -ForegroundColor Cyan
Write-Host "TAYQAN COMPLETION PR 1 — CORRECTNESS CLOSEOUT" -ForegroundColor Cyan
Write-Host "MEASURED-ONLY DRAFT / EXCEPTION GATE / FINAL ACCEPTANCE" -ForegroundColor Cyan
Write-Host "====================================================" -ForegroundColor Cyan

try {

    Write-Host "`n=== 1. VERIFY CLEAN REUSABLE WORKTREE ===" -ForegroundColor Cyan

    if (-not (Test-Path $wt)) {
        throw "STOP: TAYQAN worktree is missing: $wt"
    }

    $dirty = @(git -C $wt status --porcelain=v1 --untracked-files=all)
    if ($dirty.Count -ne 0) {
        $dirty
        throw "STOP: TAYQAN worktree is not clean."
    }

    if (-not (Test-Path $vitest)) {
        throw "STOP: Vitest missing. Do not install anything."
    }

    if (-not (Test-Path $eslint)) {
        throw "STOP: ESLint missing. Do not install anything."
    }

    if (-not (Test-Path "$repo\node_modules\.prisma\client\default.js")) {
        throw "STOP: generated Prisma client missing. Do not modify source."
    }

    Write-Host "PASS: clean worktree + existing toolchain." -ForegroundColor Green


    Write-Host "`n=== 2. FETCH AND FREEZE CURRENT MAIN ===" -ForegroundColor Cyan

    git -C $wt fetch origin main

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: git fetch origin main failed."
    }

    $main = (git -C $wt rev-parse origin/main).Trim()

    Write-Host "origin/main: $main"

    if ($main -ne $expectedMain) {
        throw "STOP: main moved after the audited TAYQAN merge. Nothing changed."
    }

    Write-Host "PASS: exact audited merged main." -ForegroundColor Green


    Write-Host "`n=== 3. CREATE ONE NEW BRANCH — NO NEW WORKTREE ===" -ForegroundColor Cyan

    $localBranch = git -C $wt branch --list $branch
    $remoteBranch = git -C $wt branch -r --list "origin/$branch"

    if ($localBranch -or $remoteBranch) {
        throw "STOP: completion branch already exists. Do not overwrite it."
    }

    git -C $wt switch -c $branch origin/main

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: could not create completion branch."
    }

    $branchCreated = $true

    if ((git -C $wt rev-parse HEAD).Trim() -ne $expectedMain) {
        throw "STOP: new branch is not based on the audited main commit."
    }

    Write-Host "PASS: $branch" -ForegroundColor Green


    Write-Host "`n=== 4. BACKUP EXACT SOURCE BYTES IN MEMORY ===" -ForegroundColor Cyan

    foreach ($rel in $existingFiles) {
        $full = Join-Path $wt $rel
        if (-not (Test-Path $full)) {
            throw "STOP: missing expected source file: $rel"
        }
        $backups[$rel] = [IO.File]::ReadAllBytes($full)
    }

    Write-Host "PASS: seven source files backed up." -ForegroundColor Green


    Write-Host "`n=== 5. APPLY PR 1 SEMANTIC PATCH ===" -ForegroundColor Cyan

    $env:TAYQAN_WT = $wt

@'
const fs = require("node:fs");
const path = require("node:path");

const wt = process.env.TAYQAN_WT;

const paths = {
  aiDraft: "src/lib/services/ai-draft-boq-service.ts",
  measurement: "src/lib/services/tayqan-measurement-service.ts",
  workOrder: "src/lib/services/tayqan-work-order-service.ts",
  panel: "src/components/tayqan/tayqan-work-order-panel.tsx",
  schema: "src/lib/validation/tayqan-schema.ts",
  en: "src/lib/i18n/dictionaries/en.ts",
  ar: "src/lib/i18n/dictionaries/ar.ts",
  test: "tests/tayqan-completion-correctness.test.ts",
};

const docs = {};
const eols = {};

for (const [key, rel] of Object.entries(paths)) {
  if (key === "test") continue;
  const full = path.join(wt, ...rel.split("/"));
  const raw = fs.readFileSync(full, "utf8");
  eols[key] = raw.includes("\r\n") ? "\r\n" : "\n";
  docs[key] = raw.replace(/\r\n/g, "\n");
}

function count(text, needle) {
  return text.split(needle).length - 1;
}

function replaceOnce(key, oldText, newText, label) {
  const text = docs[key];
  const n = count(text, oldText);
  if (n !== 1) {
    throw new Error(`${label}: expected exactly one anchor, found ${n}`);
  }
  docs[key] = text.replace(oldText, newText);
}

function insertBefore(key, marker, block, label) {
  const text = docs[key];
  const n = count(text, marker);
  if (n !== 1) {
    throw new Error(`${label}: expected exactly one marker, found ${n}`);
  }
  docs[key] = text.replace(marker, `${block}${marker}`);
}

function assertContains(key, needle, label) {
  if (!docs[key].includes(needle)) {
    throw new Error(`${label}: required marker missing`);
  }
}

/* =========================================================
 * A. MEASUREMENT SERVICE
 * - Return the exact current-pass calculation IDs.
 * - Server creates an explicit SCOPE_GAP for every raw active
 *   extraction that was neither measured nor explicitly
 *   dispositioned by the measurement plan.
 * ========================================================= */

replaceOnce(
  "measurement",
`  evaluateTayqanMeasurementSubject,
  TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,`,
`  evaluateTayqanMeasurementSubject,
  tayqanMeasurementPlanSchema,
  TAYQAN_MEASUREMENT_CALCULATED_BY_PREFIX,`,
  "measurement plan schema import",
);

replaceOnce(
  "measurement",
`export type PrepareTayqanMeasurementsResult = {
  measuredSubjectCount: number;
  createdEntityCount: number;
  reusedEntityCount: number;
  createdCalculationCount: number;
  reusedCalculationCount: number;
  exceptionCount: number;`,
`export type PrepareTayqanMeasurementsResult = {
  measuredSubjectCount: number;
  measuredEntityIds: string[];
  calculationIds: string[];
  createdEntityCount: number;
  reusedEntityCount: number;
  createdCalculationCount: number;
  reusedCalculationCount: number;
  exceptionCount: number;`,
  "measurement result identity",
);

replaceOnce(
  "measurement",
`  const evaluated = result.plan.subjects.map((subject) =>
    evaluateTayqanMeasurementSubject(subject, { allowedEntityIds, roomsById, pagesById }),
  );

  let createdEntityCount = 0;`,
`  const explicitlyMeasuredEntityIds = new Set(
    result.plan.subjects
      .map((subject) => subject.existingEntityId)
      .filter((value): value is string => Boolean(value)),
  );

  const explicitlyDispositionedEntityIds = new Set(
    result.plan.exceptions
      .map((exception) => exception.relatedEntityId)
      .filter((value): value is string => Boolean(value)),
  );

  const serverScopeGapExceptions: TayqanMeasurementException[] =
    bundle.existingEntities
      .filter((entity) =>
        !entity.sourceReference?.includes("TAYQAN_MEASUREMENT:")
        && !explicitlyMeasuredEntityIds.has(entity.id)
        && !explicitlyDispositionedEntityIds.has(entity.id),
      )
      .map((entity) => ({
        kind: "SCOPE_GAP",
        message:
          \`Existing extracted scope "\${entity.label}" was not measured and was not explicitly dispositioned by TAYQAN. Resolve or professionally exclude this scope before Draft BOQ generation.\`,
        pageIds:
          entity.drawingPageId && pagesById.has(entity.drawingPageId)
            ? [entity.drawingPageId]
            : [],
        relatedEntityId: entity.id,
      }));

  const completePlan = tayqanMeasurementPlanSchema.parse({
    subjects: result.plan.subjects,
    exceptions: [
      ...result.plan.exceptions,
      ...serverScopeGapExceptions,
    ],
  });

  const evaluated = completePlan.subjects.map((subject) =>
    evaluateTayqanMeasurementSubject(subject, { allowedEntityIds, roomsById, pagesById }),
  );

  let createdEntityCount = 0;`,
  "server scope disposition gate",
);

replaceOnce(
  "measurement",
`  let createdCalculationCount = 0;
  let reusedCalculationCount = 0;

  for (const measurement of evaluated) {`,
`  let createdCalculationCount = 0;
  let reusedCalculationCount = 0;
  const measuredEntityIds: string[] = [];
  const calculationIds: string[] = [];

  for (const measurement of evaluated) {`,
  "measurement ID collectors",
);

replaceOnce(
  "measurement",
`      return { entityCreated: created, calculationCreated };`,
`      return {
        entityId: entity.id,
        calculationId: calculation.id,
        entityCreated: created,
        calculationCreated,
      };`,
  "persisted measurement identity",
);

replaceOnce(
  "measurement",
`    if (persisted.entityCreated) createdEntityCount += 1;
    else reusedEntityCount += 1;
    if (persisted.calculationCreated) createdCalculationCount += 1;
    else reusedCalculationCount += 1;
  }`,
`    measuredEntityIds.push(persisted.entityId);
    calculationIds.push(persisted.calculationId);
    if (persisted.entityCreated) createdEntityCount += 1;
    else reusedEntityCount += 1;
    if (persisted.calculationCreated) createdCalculationCount += 1;
    else reusedCalculationCount += 1;
  }`,
  "collect current pass IDs",
);

replaceOnce(
  "measurement",
`      exceptionCount: result.plan.exceptions.length,`,
`      exceptionCount: completePlan.exceptions.length,`,
  "measurement audit exception count",
);

replaceOnce(
  "measurement",
`  return {
    measuredSubjectCount: evaluated.length,
    createdEntityCount,
    reusedEntityCount,
    createdCalculationCount,
    reusedCalculationCount,
    exceptionCount: result.plan.exceptions.length,
    exceptions: result.plan.exceptions,`,
`  return {
    measuredSubjectCount: evaluated.length,
    measuredEntityIds: [...new Set(measuredEntityIds)],
    calculationIds: [...new Set(calculationIds)],
    createdEntityCount,
    reusedEntityCount,
    createdCalculationCount,
    reusedCalculationCount,
    exceptionCount: completePlan.exceptions.length,
    exceptions: completePlan.exceptions,`,
  "measurement result current pass",
);


/* =========================================================
 * B. AI DRAFT
 * - TAYQAN mode may consume only calculations from THIS
 *   measurement pass.
 * - A raw extraction without a TAYQAN calculation cannot leak
 *   into a TAYQAN Draft.
 * - Normal Quantara remains unchanged.
 * ========================================================= */

replaceOnce(
  "aiDraft",
`export type AiDraftGenerationOptions = {
  targetBoqId?: string;
  projectFileIds?: readonly string[];
  /** Default preserves normal Quantara. TAYQAN opts in explicitly. */
  quantityMode?: "EXTRACTION_ONLY" | "TAYQAN_MEASUREMENT_PROPOSAL";
};`,
`export type AiDraftGenerationOptions = {
  targetBoqId?: string;
  projectFileIds?: readonly string[];
  /** Exact QuantityCalculation ids emitted by the current TAYQAN measurement pass. */
  tayqanCalculationIds?: readonly string[];
  /** Default preserves normal Quantara. TAYQAN opts in explicitly. */
  quantityMode?: "EXTRACTION_ONLY" | "TAYQAN_MEASUREMENT_PROPOSAL";
};`,
  "AI Draft current-pass option",
);

insertBefore(
  "aiDraft",
`  if (explicitSourceScope && scopedProjectFileIds.length === 0) {`,
`  const useTayqanMeasurementProposals =
    options.quantityMode === "TAYQAN_MEASUREMENT_PROPOSAL";

  const scopedTayqanCalculationIds = [
    ...new Set(
      (options.tayqanCalculationIds ?? [])
        .map((id) => id.trim())
        .filter(Boolean),
    ),
  ];

`,
  "AI Draft mode setup",
);

replaceOnce(
  "aiDraft",
`    const tayqanMeasurements =
      options.quantityMode === "TAYQAN_MEASUREMENT_PROPOSAL"
      && rows.length > 0
        ? await tx.quantityCalculation.findMany({`,
`    const tayqanMeasurements =
      useTayqanMeasurementProposals
      && rows.length > 0
      && scopedTayqanCalculationIds.length > 0
        ? await tx.quantityCalculation.findMany({`,
  "TAYQAN current-pass query condition",
);

replaceOnce(
  "aiDraft",
`            where: {
              companyId: actor.companyId,
              projectId: project.id,
              extractedEntityId: {`,
`            where: {
              id: {
                in: scopedTayqanCalculationIds,
              },
              companyId: actor.companyId,
              projectId: project.id,
              extractedEntityId: {`,
  "TAYQAN current-pass query IDs",
);

replaceOnce(
  "aiDraft",
`    const useQuantaraMeasurementIntelligence =
      options.quantityMode !==
      "TAYQAN_MEASUREMENT_PROPOSAL";`,
`    const useQuantaraMeasurementIntelligence =
      !useTayqanMeasurementProposals;`,
  "product mode boundary",
);

insertBefore(
  "aiDraft",
`    const toAdd = rows`,
`    const tayqanWithheldCount =
      useTayqanMeasurementProposals
        ? rows.filter(
            (row) =>
              !tayqanMeasurementByEntityId.has(row.id),
          ).length
        : 0;

`,
  "TAYQAN withheld count",
);

replaceOnce(
  "aiDraft",
`      .filter(({ row, candidate }) =>
        !alreadyPresentIds.has(row.id)
        && isAiDraftCandidateUsable(candidate)
      );`,
`      .filter(({ row, candidate, tayqanMeasurement }) =>
        !alreadyPresentIds.has(row.id)
        && isAiDraftCandidateUsable(candidate)
        && (
          !useTayqanMeasurementProposals
          || (
            tayqanMeasurement !== null
            && isAiDraftMeasurementComplete(candidate)
          )
        )
      );`,
  "TAYQAN measured-only Draft filter",
);

replaceOnce(
  "aiDraft",
`        inferredMeasurementAddedCount: 0,
      };`,
`        inferredMeasurementAddedCount: 0,
        tayqanWithheldCount,
      };`,
  "AI Draft empty result withheld count",
);

replaceOnce(
  "aiDraft",
`        inferredMeasurementAddedCount,
        ratesAutomaticallyApplied: false,`,
`        inferredMeasurementAddedCount,
        tayqanWithheldCount,
        ratesAutomaticallyApplied: false,`,
  "AI Draft audit withheld count",
);

replaceOnce(
  "aiDraft",
`      measurementIncompleteAddedCount,
      inferredMeasurementAddedCount,
    };`,
`      measurementIncompleteAddedCount,
      inferredMeasurementAddedCount,
      tayqanWithheldCount,
    };`,
  "AI Draft final result withheld count",
);


/* =========================================================
 * C. WORK ORDER
 * - Persist current pass calc IDs.
 * - Reconstruct full exception register from existing events.
 * - Block before Draft while exceptions are unresolved.
 * - Allow only explicit professional exclusion for waivable
 *   exceptions or an explicit remeasurement.
 * - Final QA => READY_FOR_ACCEPTANCE only.
 * - Explicit ACCEPT_DELIVERABLE => COMPLETED.
 * ========================================================= */

replaceOnce(
  "workOrder",
`import { randomUUID } from "node:crypto";`,
`import { createHash, randomUUID } from "node:crypto";`,
  "work-order createHash import",
);

replaceOnce(
  "workOrder",
`    reviewedAddedCount: number;
  };

  /** Senior TAYQAN measurement checkpoint; stored in existing progressJson, never schema. */`,
`    reviewedAddedCount: number;
    tayqanWithheldCount?: number;
  };

  tayqanExceptionResolutions?: Record<
    string,
    {
      resolution: "PROFESSIONAL_EXCLUSION";
      note: string;
      resolvedByUserId: string;
      resolvedAt: string;
    }
  >;

  acceptance?: {
    boqId: string;
    boqVersion: number;
    boqRevisionNumber: number;
    acceptedByUserId: string;
    acceptedByName: string;
    acceptedAt: string;
  };

  /** Senior TAYQAN measurement checkpoint; stored in existing progressJson, never schema. */`,
  "work progress acceptance and resolutions",
);

replaceOnce(
  "workOrder",
`    version: string;
    measuredSubjectCount: number;
    createdCalculationCount: number;`,
`    version: string;
    measuredSubjectCount: number;
    measuredEntityIds: string[];
    calculationIds: string[];
    createdCalculationCount: number;`,
  "work progress current pass IDs",
);

replaceOnce(
  "workOrder",
`      kind: string;
      message: string;
      pageIds: string[];
    }>;`,
`      kind: string;
      message: string;
      pageIds: string[];
      relatedEntityId: string | null;
    }>;`,
  "work progress preview related entity",
);

replaceOnce(
  "workOrder",
`type WorkBlocker = {
  kind: "ACTION" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "ERROR";`,
`type WorkBlocker = {
  kind: "ACTION" | "MEASUREMENT_EXCEPTIONS" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "ERROR";`,
  "measurement blocker kind",
);

insertBefore(
  "workOrder",
`function instructionContextFromProgress(`,
`const NON_WAIVABLE_TAYQAN_EXCEPTION_KINDS = new Set([
  "REVISION_CONFLICT",
  "PLAN_SCHEDULE_MISMATCH",
  "SPEC_DRAWING_CONFLICT",
  "METHOD_SELECTION_UNCERTAIN",
  "SUPPORTING_CHECK_MISMATCH",
  "COMPOSITE_SCOPE_REQUIRES_SPLIT",
]);

function jsonValueRecord(
  value: Prisma.JsonValue | null,
): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return value as Record<string, unknown>;
}

function tayqanMeasurementExceptionKey(input: {
  kind: string;
  message: string;
  pageIds: readonly string[];
  relatedEntityId: string | null;
}): string {
  return createHash("sha256")
    .update(JSON.stringify({
      kind: input.kind,
      message: input.message,
      pageIds: [...input.pageIds].sort(),
      relatedEntityId: input.relatedEntityId,
    }))
    .digest("hex")
    .slice(0, 24);
}

function measurementExceptionsFromOrder(order: {
  progressJson: Prisma.JsonValue | null;
  events: Array<{
    eventType: string;
    payloadJson: Prisma.JsonValue;
  }>;
}) {
  const progress = parseProgress(order.progressJson);
  const registerRunId =
    progress.tayqanMeasurement?.exceptionRegisterRunId ?? null;
  if (!registerRunId) return [];

  const resolutions = progress.tayqanExceptionResolutions ?? {};
  const byKey = new Map<string, {
    key: string;
    kind: string;
    message: string;
    pageIds: string[];
    relatedEntityId: string | null;
    resolved: boolean;
    resolutionNote: string | null;
    canExclude: boolean;
  }>();

  for (const event of order.events) {
    if (event.eventType !== "TAYQAN_MEASUREMENT_EXCEPTION_REGISTER") continue;
    const payload = jsonValueRecord(event.payloadJson);
    if (payload?.registerRunId !== registerRunId || !Array.isArray(payload.exceptions)) continue;

    for (const raw of payload.exceptions) {
      const exception = jsonValueRecord(raw as Prisma.JsonValue);
      if (!exception) continue;
      const kind = typeof exception.kind === "string" ? exception.kind : "";
      const message = typeof exception.message === "string" ? exception.message : "";
      const pageIds = Array.isArray(exception.pageIds)
        ? exception.pageIds.filter((value): value is string => typeof value === "string")
        : [];
      const relatedEntityId =
        typeof exception.relatedEntityId === "string"
          ? exception.relatedEntityId
          : null;
      if (!kind || !message) continue;

      const key = tayqanMeasurementExceptionKey({
        kind,
        message,
        pageIds,
        relatedEntityId,
      });
      const resolution = resolutions[key];

      byKey.set(key, {
        key,
        kind,
        message,
        pageIds,
        relatedEntityId,
        resolved: Boolean(resolution),
        resolutionNote: resolution?.note ?? null,
        canExclude: !NON_WAIVABLE_TAYQAN_EXCEPTION_KINDS.has(kind),
      });
    }
  }

  return [...byKey.values()];
}

function unresolvedMeasurementExceptions(order: {
  progressJson: Prisma.JsonValue | null;
  events: Array<{
    eventType: string;
    payloadJson: Prisma.JsonValue;
  }>;
}) {
  return measurementExceptionsFromOrder(order).filter(
    (exception) => !exception.resolved,
  );
}

`,
  "exception register helpers",
);

replaceOnce(
  "workOrder",
`function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  return {`,
`function toState(order: Awaited<ReturnType<typeof loadOrder>>) {
  const progress = parseProgress(order.progressJson);
  const measurementExceptions = measurementExceptionsFromOrder(order);

  return {`,
  "state exception setup",
);

replaceOnce(
  "workOrder",
`    completedAt: order.completedAt?.toISOString() ?? null,
    events: order.events.map((event) => ({`,
`    completedAt: order.completedAt?.toISOString() ?? null,
    acceptance: progress.acceptance ?? null,
    measurementExceptions,
    measurementExceptionSummary: {
      total: measurementExceptions.length,
      unresolved: measurementExceptions.filter((exception) => !exception.resolved).length,
    },
    events: order.events.map((event) => ({`,
  "state exception output",
);

insertBefore(
  "workOrder",
`async function moveStage(`,
`async function blockForMeasurementExceptions(
  actor: CurrentActor,
  projectSlug: string,
  order: Awaited<ReturnType<typeof loadOrder>>,
) {
  const unresolved = unresolvedMeasurementExceptions(order);
  if (unresolved.length === 0) return null;

  return block(
    actor,
    order,
    "TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN",
    "tayqan.hire.workflow.measurementExceptionsRemain",
    {
      kind: "MEASUREMENT_EXCEPTIONS",
      i18nKey: "tayqan.hire.workflow.measurementExceptionsRemain",
      actionHref: \`/projects/\${projectSlug}/files\`,
    },
  );
}

`,
  "exception blocker helper",
);

replaceOnce(
  "workOrder",
`        if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
          await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
          return prepareTayqanAiDraft(actor, projectSlug, leasedOrder);
        }`,
`        if (leasedProgress.tayqanMeasurement?.version === TAYQAN_MEASUREMENT_VERSION) {
          await releaseTayqanMeasurementLease(actor, order.id, leaseToken);
          const completedOrder = await loadOrder(actor.companyId, order.id);
          const exceptionBlock = await blockForMeasurementExceptions(
            actor,
            projectSlug,
            completedOrder,
          );
          if (exceptionBlock) return exceptionBlock;
          return prepareTayqanAiDraft(actor, projectSlug, completedOrder);
        }`,
  "race-safe exception gate",
);

replaceOnce(
  "workOrder",
`        const measurementExceptions = measurement.exceptions.slice(0, 50).map((exception) => ({ kind: exception.kind, message: exception.message, pageIds: exception.pageIds }));`,
`        const measurementExceptions = measurement.exceptions.slice(0, 50).map((exception) => ({
          kind: exception.kind,
          message: exception.message,
          pageIds: exception.pageIds,
          relatedEntityId: exception.relatedEntityId,
        }));`,
  "exception preview provenance",
);

replaceOnce(
  "workOrder",
`                version: TAYQAN_MEASUREMENT_VERSION, measuredSubjectCount: measurement.measuredSubjectCount, createdCalculationCount: measurement.createdCalculationCount, reusedCalculationCount: measurement.reusedCalculationCount,
                exceptionCount: measurement.exceptionCount, provider: measurement.provider, model: measurement.model, seniorReview: measurement.seniorReview, exceptions: measurementExceptions,`,
`                version: TAYQAN_MEASUREMENT_VERSION, measuredSubjectCount: measurement.measuredSubjectCount,
                measuredEntityIds: measurement.measuredEntityIds, calculationIds: measurement.calculationIds,
                createdCalculationCount: measurement.createdCalculationCount, reusedCalculationCount: measurement.reusedCalculationCount,
                exceptionCount: measurement.exceptionCount, provider: measurement.provider, model: measurement.model, seniorReview: measurement.seniorReview, exceptions: measurementExceptions,`,
  "persist current pass IDs",
);

replaceOnce(
  "workOrder",
`              progressJson: jsonObject({ ...leasedProgress, tayqanMeasurement: {`,
`              progressJson: jsonObject({ ...leasedProgress, tayqanExceptionResolutions: {}, tayqanMeasurement: {`,
  "reset exception resolutions on new pass",
);

replaceOnce(
  "workOrder",
`    return prepareTayqanAiDraft(actor, projectSlug, measuredOrder);
  }`,
`    const exceptionBlock = await blockForMeasurementExceptions(
      actor,
      projectSlug,
      measuredOrder,
    );
    if (exceptionBlock) return exceptionBlock;

    return prepareTayqanAiDraft(actor, projectSlug, measuredOrder);
  }`,
  "pre-Draft exception hard gate",
);

replaceOnce(
  "workOrder",
`  const selectedSourceFileIds =
    sourceFileIdsFromProgress(order);

  const result =
    await generateAiDraftBoq(`,
`  const selectedSourceFileIds =
    sourceFileIdsFromProgress(order);

  const progress =
    parseProgress(order.progressJson);

  const result =
    await generateAiDraftBoq(`,
  "Draft progress before generation",
);

replaceOnce(
  "workOrder",
`        projectFileIds: selectedSourceFileIds,
        quantityMode: "TAYQAN_MEASUREMENT_PROPOSAL",`,
`        projectFileIds: selectedSourceFileIds,
        tayqanCalculationIds:
          progress.tayqanMeasurement?.calculationIds ?? [],
        quantityMode: "TAYQAN_MEASUREMENT_PROPOSAL",`,
  "Draft current-pass IDs",
);

replaceOnce(
  "workOrder",
`  const progress =
    parseProgress(order.progressJson);

  const aiDraft: NonNullable<`,
`  const aiDraft: NonNullable<`,
  "remove duplicate Draft progress declaration",
);

replaceOnce(
  "workOrder",
`    reviewedAddedCount:
      result.reviewedAddedCount,
  };`,
`    reviewedAddedCount:
      result.reviewedAddedCount,
    tayqanWithheldCount:
      result.tayqanWithheldCount,
  };`,
  "Draft withheld progress",
);

replaceOnce(
  "workOrder",
`  const boq =
    await getBOQRecord(`,
`  const exceptionBlock =
    await blockForMeasurementExceptions(
      actor,
      projectSlug,
      order,
    );
  if (exceptionBlock) return exceptionBlock;

  const boq =
    await getBOQRecord(`,
  "professional review exception gate",
);

replaceOnce(
  "workOrder",
`async function advanceValidation(actor: CurrentActor, _projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  if (!order.boqId) throw new ConflictError("TAYQAN_BOQ_REQUIRED", "TAYQAN needs a working BOQ before final QA.");`,
`async function advanceValidation(actor: CurrentActor, projectSlug: string, order: Awaited<ReturnType<typeof loadOrder>>) {
  if (!order.boqId) throw new ConflictError("TAYQAN_BOQ_REQUIRED", "TAYQAN needs a working BOQ before final QA.");

  const exceptionBlock = await blockForMeasurementExceptions(
    actor,
    projectSlug,
    order,
  );
  if (exceptionBlock) return exceptionBlock;`,
  "final QA exception gate",
);

replaceOnce(
  "workOrder",
`      blockerJson: Prisma.DbNull,
      completedAt: new Date(),
      lastAdvancedAt: new Date(),`,
`      blockerJson: Prisma.DbNull,
      lastAdvancedAt: new Date(),`,
  "READY is not completion",
);

replaceOnce(
  "workOrder",
`  await prisma.tayqanIntakeSession.update({
    where: { id: order.intakeSessionId },
    data: { status: TayqanIntakeStatus.COMPLETED, completedAt: new Date() },
  });
  await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.readyForAcceptance");`,
`  await persistConversationStatus(actor.companyId, order.intakeSessionId, "tayqan.hire.workflow.readyForAcceptance");`,
  "defer intake completion until acceptance",
);

replaceOnce(
  "workOrder",
`    action: "CONFIRM_ENTITY" | "CORRECT_ENTITY" | "REJECT_ENTITY" | "SET_QUANTITY" | "SET_RATE" | "ANSWER_QA" | "RETRY";
    entityId?: string;`,
`    action:
      | "CONFIRM_ENTITY"
      | "CORRECT_ENTITY"
      | "REJECT_ENTITY"
      | "SET_QUANTITY"
      | "SET_RATE"
      | "ANSWER_QA"
      | "EXCLUDE_MEASUREMENT_EXCEPTION"
      | "RETRY_MEASUREMENT"
      | "ACCEPT_DELIVERABLE"
      | "RETRY";
    entityId?: string;
    exceptionKey?: string;`,
  "work-order action contract",
);

replaceOnce(
  "workOrder",
`  if (order.projectId !== project.id) throw new AppError("TAYQAN_WORK_PROJECT_MISMATCH", "This work order belongs to another project.", 403);
  if (order.status !== TayqanWorkStatus.NEEDS_INPUT && input.action !== "RETRY") {`,
`  if (order.projectId !== project.id) throw new AppError("TAYQAN_WORK_PROJECT_MISMATCH", "This work order belongs to another project.", 403);

  if (input.action === "ACCEPT_DELIVERABLE") {
    if (order.status !== TayqanWorkStatus.READY_FOR_ACCEPTANCE) {
      throw new ConflictError(
        "TAYQAN_NOT_READY_FOR_ACCEPTANCE",
        "TAYQAN can only record final acceptance after governed QA reaches READY_FOR_ACCEPTANCE.",
      );
    }

    const unresolved = unresolvedMeasurementExceptions(order);
    if (unresolved.length > 0) {
      throw new ConflictError(
        "TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN",
        "Resolve every TAYQAN measurement exception before final acceptance.",
      );
    }

    if (!order.boqId) {
      throw new ConflictError(
        "TAYQAN_BOQ_REQUIRED",
        "TAYQAN needs a working BOQ before final acceptance.",
      );
    }

    const boq = await prisma.bOQ.findFirst({
      where: {
        id: order.boqId,
        companyId: actor.companyId,
        projectId: order.projectId,
      },
      select: {
        id: true,
        version: true,
        revisionNumber: true,
      },
    });
    if (!boq) throw new NotFoundError("TAYQAN working BOQ not found.");

    const qaRun = order.qaWorkerRunId
      ? await getWorkerRunForCompany(actor.companyId, order.qaWorkerRunId)
      : null;

    if (
      !qaRun
      || qaRun.status !== WorkerRunStatus.COMPLETED
      || qaRun.source.boqVersion !== boq.version
      || qaRun.source.revisionNumber !== boq.revisionNumber
    ) {
      await updateOrder(
        actor,
        order.id,
        {
          status: TayqanWorkStatus.RUNNING,
          stage: TayqanWorkStage.VALIDATION,
          qaWorkerRunId: null,
          blockerCode: null,
          blockerMessage: null,
          blockerJson: Prisma.DbNull,
          completedAt: null,
          lastAdvancedAt: new Date(),
        },
        "FINAL_QA_INVALIDATED_BY_BOQ_CHANGE",
        {
          previousQaWorkerRunId: order.qaWorkerRunId,
          qaBoqVersion: qaRun?.source.boqVersion ?? null,
          currentBoqVersion: boq.version,
          qaRevisionNumber: qaRun?.source.revisionNumber ?? null,
          currentRevisionNumber: boq.revisionNumber,
        },
      );

      return advanceValidation(
        actor,
        project.slug,
        await loadOrder(actor.companyId, order.id),
      );
    }

    const now = new Date();
    const progress = parseProgress(order.progressJson);
    const acceptance: NonNullable<WorkProgress["acceptance"]> = {
      boqId: boq.id,
      boqVersion: boq.version,
      boqRevisionNumber: boq.revisionNumber,
      acceptedByUserId: actor.userId,
      acceptedByName: actor.fullName,
      acceptedAt: now.toISOString(),
    };

    await prisma.$transaction(async (tx) => {
      await tx.tayqanWorkOrder.update({
        where: { id: order.id },
        data: {
          status: TayqanWorkStatus.COMPLETED,
          progressJson: jsonObject({
            ...progress,
            acceptance,
          }),
          blockerCode: null,
          blockerMessage: null,
          blockerJson: Prisma.DbNull,
          completedAt: now,
          lastAdvancedAt: now,
        },
      });

      await tx.tayqanIntakeSession.update({
        where: { id: order.intakeSessionId },
        data: {
          status: TayqanIntakeStatus.COMPLETED,
          completedAt: now,
        },
      });

      await tx.tayqanWorkEvent.create({
        data: {
          companyId: actor.companyId,
          workOrderId: order.id,
          stage: TayqanWorkStage.READY_FOR_ACCEPTANCE,
          eventType: "TAYQAN_DELIVERABLE_ACCEPTED",
          payloadJson: jsonObject(acceptance),
        },
      });
    });

    await persistConversationStatus(
      actor.companyId,
      order.intakeSessionId,
      "tayqan.hire.workflow.deliverableAccepted",
    );

    return toState(await loadOrder(actor.companyId, order.id));
  }

  if (order.status !== TayqanWorkStatus.NEEDS_INPUT && input.action !== "RETRY") {`,
  "explicit final acceptance transaction",
);

replaceOnce(
  "workOrder",
`  } else if (input.action === "ANSWER_QA") {
    if (!blocker?.qa) throw new ConflictError("TAYQAN_BLOCKER_CHANGED", "The current blocker is not a QA question.");
    const { answerWorkerMaterialQuestion } = await import("@/lib/services/worker-review-service");
    await answerWorkerMaterialQuestion(actor, blocker.qa.assignmentId, blocker.qa.questionId, {
      answerType: input.qaAnswerType ?? "EXPLAINED_WITH_NOTE",
      note: input.note?.trim() || "Answered through the TAYQAN paid work-order conversation.",
    });
  } else if (input.action !== "RETRY") {`,
`  } else if (input.action === "ANSWER_QA") {
    if (!blocker?.qa) throw new ConflictError("TAYQAN_BLOCKER_CHANGED", "The current blocker is not a QA question.");
    const { answerWorkerMaterialQuestion } = await import("@/lib/services/worker-review-service");
    await answerWorkerMaterialQuestion(actor, blocker.qa.assignmentId, blocker.qa.questionId, {
      answerType: input.qaAnswerType ?? "EXPLAINED_WITH_NOTE",
      note: input.note?.trim() || "Answered through the TAYQAN paid work-order conversation.",
    });
  } else if (input.action === "EXCLUDE_MEASUREMENT_EXCEPTION") {
    if (order.blockerCode !== "TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN") {
      throw new ConflictError(
        "TAYQAN_BLOCKER_CHANGED",
        "TAYQAN is not currently waiting on a measurement exception decision.",
      );
    }

    const exception = measurementExceptionsFromOrder(order).find(
      (candidate) => candidate.key === input.exceptionKey,
    );
    if (!exception || exception.resolved) {
      throw new ConflictError(
        "TAYQAN_MEASUREMENT_EXCEPTION_CHANGED",
        "The selected TAYQAN measurement exception is no longer unresolved.",
      );
    }
    if (!exception.canExclude) {
      throw new ConflictError(
        "TAYQAN_EXCEPTION_REQUIRES_REMEASUREMENT",
        "This exception cannot be waived because it can change the measured result. Correct the source evidence and re-run TAYQAN measurement.",
      );
    }

    const note = input.note?.trim();
    if (!note) {
      throw new AppError(
        "TAYQAN_EXCEPTION_NOTE_REQUIRED",
        "A professional exclusion note is required.",
        400,
      );
    }

    const currentMeasurement = progress.tayqanMeasurement;
    if (!currentMeasurement) {
      throw new ConflictError(
        "TAYQAN_MEASUREMENT_CHECKPOINT_MISSING",
        "The current TAYQAN measurement checkpoint is unavailable.",
      );
    }

    let calculationIds = [...currentMeasurement.calculationIds];
    let measuredEntityIds = [...currentMeasurement.measuredEntityIds];

    if (exception.relatedEntityId && calculationIds.length > 0) {
      const relatedCalculations = await prisma.quantityCalculation.findMany({
        where: {
          id: { in: calculationIds },
          companyId: actor.companyId,
          projectId: order.projectId,
          extractedEntityId: exception.relatedEntityId,
        },
        select: { id: true },
      });
      const removeIds = new Set(relatedCalculations.map((calculation) => calculation.id));
      calculationIds = calculationIds.filter((id) => !removeIds.has(id));
      measuredEntityIds = measuredEntityIds.filter((id) => id !== exception.relatedEntityId);
    }

    const next = mergeProgress(progress, {
      tayqanMeasurement: {
        ...currentMeasurement,
        calculationIds,
        measuredEntityIds,
      },
      tayqanExceptionResolutions: {
        ...(progress.tayqanExceptionResolutions ?? {}),
        [exception.key]: {
          resolution: "PROFESSIONAL_EXCLUSION",
          note,
          resolvedByUserId: actor.userId,
          resolvedAt: new Date().toISOString(),
        },
      },
    });

    await prisma.tayqanWorkOrder.update({
      where: { id: order.id },
      data: { progressJson: jsonObject(next) },
    });

    await appendWorkEvent(
      actor.companyId,
      order.id,
      order.stage,
      "TAYQAN_MEASUREMENT_EXCEPTION_PROFESSIONALLY_EXCLUDED",
      {
        exceptionKey: exception.key,
        kind: exception.kind,
        relatedEntityId: exception.relatedEntityId,
        note,
      },
    );
  } else if (input.action === "RETRY_MEASUREMENT") {
    if (order.blockerCode !== "TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN") {
      throw new ConflictError(
        "TAYQAN_BLOCKER_CHANGED",
        "TAYQAN is not currently waiting on measurement exceptions.",
      );
    }

    const retryProgress: WorkProgress = {
      quantityOverrides: progress.quantityOverrides,
      rateOverrides: progress.rateOverrides,
      instructionContext: progress.instructionContext,
    };

    await prisma.tayqanWorkOrder.update({
      where: { id: order.id },
      data: {
        stage: TayqanWorkStage.SOURCE_DISCOVERY,
        qaWorkerRunId: null,
        progressJson: jsonObject(retryProgress),
      },
    });

    await appendWorkEvent(
      actor.companyId,
      order.id,
      TayqanWorkStage.SOURCE_DISCOVERY,
      "TAYQAN_MEASUREMENT_RETRY_REQUESTED",
      {
        previousRegisterRunId:
          progress.tayqanMeasurement?.exceptionRegisterRunId ?? null,
      },
    );
  } else if (input.action !== "RETRY") {`,
  "exception resolution and retry actions",
);


/* =========================================================
 * D. VALIDATION SCHEMA
 * ========================================================= */

replaceOnce(
  "schema",
`  action: z.enum(["CONFIRM_ENTITY", "CORRECT_ENTITY", "REJECT_ENTITY", "SET_QUANTITY", "SET_RATE", "ANSWER_QA", "RETRY"]),
  entityId: z.string().uuid().optional(),`,
`  action: z.enum([
    "CONFIRM_ENTITY",
    "CORRECT_ENTITY",
    "REJECT_ENTITY",
    "SET_QUANTITY",
    "SET_RATE",
    "ANSWER_QA",
    "EXCLUDE_MEASUREMENT_EXCEPTION",
    "RETRY_MEASUREMENT",
    "ACCEPT_DELIVERABLE",
    "RETRY",
  ]),
  entityId: z.string().uuid().optional(),
  exceptionKey: z.string().trim().length(24).optional(),`,
  "validation action schema",
);


/* =========================================================
 * E. WORK-ORDER PANEL
 * ========================================================= */

replaceOnce(
  "panel",
`    kind: "ACTION" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "ERROR";`,
`    kind: "ACTION" | "MEASUREMENT_EXCEPTIONS" | "ENTITY_REVIEW" | "QUANTITY_REQUIRED" | "RATE_REQUIRED" | "QA_QUESTION" | "ERROR";`,
  "panel blocker kind",
);

replaceOnce(
  "panel",
`  completedAt: string | null;
  events: Array<{ id: string; stage: string; eventType: string; payload: unknown; createdAt: string }>;`,
`  completedAt: string | null;
  acceptance: {
    boqId: string;
    boqVersion: number;
    boqRevisionNumber: number;
    acceptedByUserId: string;
    acceptedByName: string;
    acceptedAt: string;
  } | null;
  measurementExceptions: Array<{
    key: string;
    kind: string;
    message: string;
    pageIds: string[];
    relatedEntityId: string | null;
    resolved: boolean;
    resolutionNote: string | null;
    canExclude: boolean;
  }>;
  measurementExceptionSummary: {
    total: number;
    unresolved: number;
  };
  events: Array<{ id: string; stage: string; eventType: string; payload: unknown; createdAt: string }>;`,
  "panel state exceptions and acceptance",
);

replaceOnce(
  "panel",
`      {state.status === "READY_FOR_ACCEPTANCE" && (
        <div className="rounded-2xl border border-emerald-700 bg-emerald-950/20 p-4">
          <p className="font-semibold text-emerald-200">{t("tayqan.hire.workflow.readyForAcceptance")}</p>
          <p className="mt-1 text-sm text-slate-300">{t("tayqan.hire.workflow.acceptanceNote")}</p>
          {state.boqId && <Link href={\`/projects/\${encodeURIComponent(projectId)}/boq\`} className="mt-3 inline-block text-sm font-semibold text-cyan-300 underline">{t("tayqan.hire.openBoq")}</Link>}
        </div>
      )}`,
`      {state.status === "READY_FOR_ACCEPTANCE" && (
        <div className="rounded-2xl border border-emerald-700 bg-emerald-950/20 p-4">
          <p className="font-semibold text-emerald-200">{t("tayqan.hire.workflow.readyForAcceptance")}</p>
          <p className="mt-1 text-sm text-slate-300">{t("tayqan.hire.workflow.acceptanceNote")}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {state.boqId && <Link href={\`/projects/\${encodeURIComponent(projectId)}/boq\`} className="rounded-xl border border-cyan-700 px-3 py-2 text-xs font-semibold text-cyan-200">{t("tayqan.hire.openBoq")}</Link>}
            <button
              type="button"
              disabled={busy}
              onClick={() => void answer({ action: "ACCEPT_DELIVERABLE" })}
              className="rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
            >
              {t("tayqan.hire.workflow.acceptDeliverable")}
            </button>
          </div>
        </div>
      )}

      {state.status === "COMPLETED" && state.acceptance && (
        <div className="rounded-2xl border border-emerald-800 bg-emerald-950/10 p-4">
          <p className="font-semibold text-emerald-200">{t("tayqan.hire.workflow.deliverableAccepted")}</p>
          <p className="mt-1 text-xs text-slate-400">
            {state.acceptance.acceptedByName} · {new Date(state.acceptance.acceptedAt).toLocaleString()}
          </p>
        </div>
      )}`,
  "explicit acceptance UI",
);

insertBefore(
  "panel",
`          {blocker.kind === "ENTITY_REVIEW" && (`,
`          {blocker.kind === "MEASUREMENT_EXCEPTIONS" && (
            <div className="mt-3 space-y-3">
              {state.measurementExceptions
                .filter((exception) => !exception.resolved)
                .map((exception) => (
                  <div key={exception.key} className="rounded-xl border border-amber-900 bg-slate-950 p-3 text-xs text-slate-300">
                    <p className="font-semibold text-amber-200">{exception.kind}</p>
                    <p className="mt-1">{exception.message}</p>
                    {exception.pageIds.length > 0 && (
                      <p className="mt-1 text-slate-500">
                        {t("tayqan.hire.workflow.measurementExceptionPages", { count: exception.pageIds.length })}
                      </p>
                    )}
                    {exception.canExclude ? (
                      <button
                        type="button"
                        disabled={busy || !note.trim()}
                        onClick={() => void answer({
                          action: "EXCLUDE_MEASUREMENT_EXCEPTION",
                          exceptionKey: exception.key,
                          note,
                        })}
                        className="mt-2 rounded-xl border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
                      >
                        {t("tayqan.hire.workflow.measurementExceptionExclude")}
                      </button>
                    ) : (
                      <p className="mt-2 text-rose-300">
                        {t("tayqan.hire.workflow.measurementExceptionNonWaivable")}
                      </p>
                    )}
                  </div>
                ))}
              <textarea
                value={note}
                onChange={(event) => setNote(event.target.value)}
                placeholder={t("tayqan.hire.workflow.measurementExceptionNote")}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white"
              />
              <div className="flex flex-wrap gap-2">
                {blocker.actionHref && (
                  <Link href={blocker.actionHref} className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200">
                    {t("tayqan.hire.openFiles")}
                  </Link>
                )}
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void answer({ action: "RETRY_MEASUREMENT" })}
                  className="rounded-xl bg-cyan-600 px-3 py-2 text-xs font-semibold text-white disabled:opacity-50"
                >
                  {t("tayqan.hire.workflow.measurementExceptionRetry")}
                </button>
              </div>
            </div>
          )}
`,
  "measurement exception UI",
);


/* =========================================================
 * F. I18N
 * ========================================================= */

replaceOnce(
  "en",
`        measurementComplete: "TAYQAN completed the senior measurement and independent cross-check for {count} measurable scope item(s). Evidence, revisions, units and exceptions were reconciled before Draft BOQ assembly; unit prices remain for professional input and final review.",
        sourceNeedsInput:`,
`        measurementComplete: "TAYQAN completed the senior measurement and independent cross-check for {count} measurable scope item(s). Evidence, revisions and units were checked. Any unresolved measurement exception must be resolved before Draft BOQ generation.",
        measurementExceptionsRemain: "TAYQAN found measurement exceptions that can change or omit payable scope. I will not silently push those items into the Draft BOQ. Resolve or professionally exclude the listed exceptions, or correct the project sources and re-run measurement.",
        measurementExceptionPages: "{count} evidence page(s)",
        measurementExceptionExclude: "Professionally exclude this scope",
        measurementExceptionNonWaivable: "This exception can change the measured result and cannot be waived. Correct the source evidence and re-run measurement.",
        measurementExceptionRetry: "Re-run TAYQAN measurement",
        measurementExceptionNote: "Required professional exclusion reason",
        sourceNeedsInput:`,
  "English exception strings",
);

replaceOnce(
  "en",
`        readyForAcceptance: "The TAYQAN work order is complete and the BOQ is ready for your final acceptance.",
        acceptanceNote: "TAYQAN does not automatically lock, issue, approve or submit the BOQ. Review it and perform the final professional acceptance action yourself.",
        confirm:`,
`        readyForAcceptance: "TAYQAN final QA is complete and the BOQ is ready for your explicit professional acceptance.",
        acceptanceNote: "TAYQAN does not automatically lock, issue, approve or submit the BOQ. Review it, then explicitly accept the TAYQAN deliverable to close this work order.",
        acceptDeliverable: "Accept TAYQAN deliverable",
        deliverableAccepted: "TAYQAN deliverable accepted. This work order is now complete.",
        confirm:`,
  "English acceptance strings",
);

replaceOnce(
  "ar",
`        measurementComplete: "أكمل TAYQAN القياس الهندسي والمراجعة المستقلة المتقدمة لعدد {count} من بنود النطاق القابلة للقياس. تمت مطابقة الأدلة والإصدارات والوحدات والاستثناءات قبل تجميع مسودة جدول الكميات، وتبقى أسعار الوحدات للإدخال والمراجعة المهنية النهائية.",
        sourceNeedsInput:`,
`        measurementComplete: "أكمل TAYQAN القياس الهندسي والمراجعة المستقلة لعدد {count} من بنود النطاق القابلة للقياس. تمت مراجعة الأدلة والإصدارات والوحدات، ويجب معالجة أي استثناء قياس متبقٍ قبل إنشاء مسودة جدول الكميات.",
        measurementExceptionsRemain: "وجد TAYQAN استثناءات قياس قد تغيّر النطاق المستحق أو تؤدي إلى حذفه. لن أدفع هذه البنود بصمت إلى مسودة جدول الكميات. عالج الاستثناءات أو استبعد النطاق مهنيًا مع توثيق السبب، أو صحح مصادر المشروع ثم أعد القياس.",
        measurementExceptionPages: "{count} صفحة دليل",
        measurementExceptionExclude: "استبعاد هذا النطاق مهنيًا",
        measurementExceptionNonWaivable: "قد يغيّر هذا الاستثناء نتيجة القياس ولا يمكن تجاوزه. صحح دليل المصدر ثم أعد قياس TAYQAN.",
        measurementExceptionRetry: "إعادة قياس TAYQAN",
        measurementExceptionNote: "سبب الاستبعاد المهني مطلوب",
        sourceNeedsInput:`,
  "Arabic exception strings",
);

replaceOnce(
  "ar",
`        readyForAcceptance: "اكتمل أمر عمل TAYQAN وأصبح جدول الكميات جاهزًا لاعتمادك النهائي.",
        acceptanceNote: "لا يقوم TAYQAN تلقائيًا بقفل جدول الكميات أو إصداره أو اعتماده أو تقديمه. راجعه ونفّذ إجراء الاعتماد المهني النهائي بنفسك.",
        confirm:`,
`        readyForAcceptance: "اكتملت مراجعة TAYQAN النهائية وأصبح جدول الكميات جاهزًا لاعتمادك المهني الصريح.",
        acceptanceNote: "لا يقوم TAYQAN تلقائيًا بقفل جدول الكميات أو إصداره أو اعتماده أو تقديمه. راجعه ثم اعتمد تسليم TAYQAN صراحةً لإغلاق أمر العمل.",
        acceptDeliverable: "اعتماد تسليم TAYQAN",
        deliverableAccepted: "تم اعتماد تسليم TAYQAN وأصبح أمر العمل مكتملًا.",
        confirm:`,
  "Arabic acceptance strings",
);


/* =========================================================
 * G. NEW REGRESSION TEST
 * ========================================================= */

const test = `import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

describe("TAYQAN completion correctness closeout", () => {
  it("allows only current-pass TAYQAN calculations into TAYQAN Draft mode", () => {
    const source = read("src/lib/services/ai-draft-boq-service.ts");

    expect(source).toContain("tayqanCalculationIds?: readonly string[]");
    expect(source).toContain("id: {\\n                in: scopedTayqanCalculationIds");
    expect(source).toContain("tayqanMeasurement !== null");
    expect(source).toContain("isAiDraftMeasurementComplete(candidate)");
    expect(source).toContain("tayqanWithheldCount");
    expect(source).toContain("const useQuantaraMeasurementIntelligence =\\n      !useTayqanMeasurementProposals");
  });

  it("forces every raw active extraction to be measured or explicitly dispositioned", () => {
    const source = read("src/lib/services/tayqan-measurement-service.ts");

    expect(source).toContain("serverScopeGapExceptions");
    expect(source).toContain('kind: "SCOPE_GAP"');
    expect(source).toContain("calculationIds: [...new Set(calculationIds)]");
    expect(source).toContain("measuredEntityIds: [...new Set(measuredEntityIds)]");
    expect(source).toContain('!entity.sourceReference?.includes("TAYQAN_MEASUREMENT:")');
  });

  it("blocks unresolved measurement exceptions before Draft and again before final QA", () => {
    const source = read("src/lib/services/tayqan-work-order-service.ts");

    expect(source).toContain("blockForMeasurementExceptions");
    expect(source).toContain("TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN");
    expect(source).toContain('"MEASUREMENT_EXCEPTIONS"');
    expect(source).toContain('"EXCLUDE_MEASUREMENT_EXCEPTION"');
    expect(source).toContain('"RETRY_MEASUREMENT"');

    const draftGate = source.indexOf(
      "const exceptionBlock = await blockForMeasurementExceptions(\\n      actor,\\n      projectSlug,\\n      measuredOrder",
    );
    const draftCall = source.indexOf(
      "return prepareTayqanAiDraft(actor, projectSlug, measuredOrder);",
    );
    expect(draftGate).toBeGreaterThan(-1);
    expect(draftCall).toBeGreaterThan(draftGate);
  });

  it("keeps READY_FOR_ACCEPTANCE distinct from explicit work-order completion", () => {
    const source = read("src/lib/services/tayqan-work-order-service.ts");

    const validationStart = source.indexOf("async function advanceValidation");
    const advanceStart = source.indexOf("export async function advanceTayqanWorkOrder");
    const validation = source.slice(validationStart, advanceStart);

    expect(validation).toContain("TayqanWorkStatus.READY_FOR_ACCEPTANCE");
    expect(validation).not.toContain("TayqanIntakeStatus.COMPLETED");
    expect(validation).not.toContain("completedAt: new Date()");

    expect(source).toContain('"ACCEPT_DELIVERABLE"');
    expect(source).toContain('"TAYQAN_DELIVERABLE_ACCEPTED"');
    expect(source).toContain("boqVersion: boq.version");
    expect(source).toContain("boqRevisionNumber: boq.revisionNumber");
    expect(source).toContain("FINAL_QA_INVALIDATED_BY_BOQ_CHANGE");
    expect(source).toContain("qaRun.source.boqVersion !== boq.version");
    expect(source).toContain("status: TayqanWorkStatus.COMPLETED");
  });

  it("exposes exception resolution and final acceptance in schema and work-order UI", () => {
    const schema = read("src/lib/validation/tayqan-schema.ts");
    const panel = read("src/components/tayqan/tayqan-work-order-panel.tsx");

    expect(schema).toContain('"EXCLUDE_MEASUREMENT_EXCEPTION"');
    expect(schema).toContain('"RETRY_MEASUREMENT"');
    expect(schema).toContain('"ACCEPT_DELIVERABLE"');
    expect(schema).toContain("exceptionKey");

    expect(panel).toContain("state.measurementExceptions");
    expect(panel).toContain('action: "EXCLUDE_MEASUREMENT_EXCEPTION"');
    expect(panel).toContain('action: "RETRY_MEASUREMENT"');
    expect(panel).toContain('action: "ACCEPT_DELIVERABLE"');
  });
});
`;

docs.test = test;
eols.test = "\n";


/* =========================================================
 * H. FINAL IN-MEMORY ASSERTIONS — NOTHING WRITTEN YET
 * ========================================================= */

for (const marker of [
  "tayqanCalculationIds?: readonly string[]",
  "tayqanMeasurement !== null",
  "tayqanWithheldCount",
]) {
  assertContains("aiDraft", marker, `AI Draft ${marker}`);
}

for (const marker of [
  "serverScopeGapExceptions",
  "calculationIds: [...new Set(calculationIds)]",
  "measuredEntityIds: [...new Set(measuredEntityIds)]",
]) {
  assertContains("measurement", marker, `measurement ${marker}`);
}

for (const marker of [
  "TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN",
  "EXCLUDE_MEASUREMENT_EXCEPTION",
  "RETRY_MEASUREMENT",
  "ACCEPT_DELIVERABLE",
  "TAYQAN_DELIVERABLE_ACCEPTED",
  "measurementExceptionsFromOrder",
]) {
  assertContains("workOrder", marker, `work-order ${marker}`);
}

for (const marker of [
  'action: "EXCLUDE_MEASUREMENT_EXCEPTION"',
  'action: "RETRY_MEASUREMENT"',
  'action: "ACCEPT_DELIVERABLE"',
]) {
  assertContains("panel", marker, `panel ${marker}`);
}

for (const key of ["aiDraft", "measurement", "workOrder", "panel", "schema", "en", "ar"]) {
  for (const conflictMarker of ["<<<<<<<", "=======", ">>>>>>>"]) {
    if (docs[key].includes(conflictMarker)) {
      throw new Error(`${key}: merge conflict marker found`);
    }
  }
}

/* Write only after every transformation and invariant passes. */
for (const [key, rel] of Object.entries(paths)) {
  const full = path.join(wt, ...rel.split("/"));
  const eol = eols[key] ?? "\n";
  const output = docs[key].replace(/\n/g, eol);
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, output, "utf8");
  console.log("UPDATED:", rel);
}

console.log("PASS: TAYQAN PR1 correctness patch written.");
'@ | node -

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: semantic patch failed."
    }


    Write-Host "`n=== 6. VERIFY REQUIRED CORRECTNESS MARKERS ===" -ForegroundColor Cyan

    $markerChecks = @{
        "src/lib/services/ai-draft-boq-service.ts" = @(
            "tayqanCalculationIds?: readonly string[]",
            "tayqanMeasurement !== null",
            "tayqanWithheldCount"
        )
        "src/lib/services/tayqan-measurement-service.ts" = @(
            "serverScopeGapExceptions",
            "calculationIds: [...new Set(calculationIds)]",
            "measuredEntityIds: [...new Set(measuredEntityIds)]"
        )
        "src/lib/services/tayqan-work-order-service.ts" = @(
            "TAYQAN_MEASUREMENT_EXCEPTIONS_REMAIN",
            "EXCLUDE_MEASUREMENT_EXCEPTION",
            "RETRY_MEASUREMENT",
            "ACCEPT_DELIVERABLE",
            "TAYQAN_DELIVERABLE_ACCEPTED"
        )
    }

    foreach ($rel in $markerChecks.Keys) {
        foreach ($marker in $markerChecks[$rel]) {
            if (-not (
                Select-String `
                    -LiteralPath (Join-Path $wt $rel) `
                    -SimpleMatch `
                    -Pattern $marker `
                    -Quiet
            )) {
                throw "STOP: missing post-patch marker '$marker' in $rel"
            }
            Write-Host "PASS: $marker"
        }
    }


    Write-Host "`n=== 7. RUN TAYQAN + QUANTARA REGRESSION ===" -ForegroundColor Cyan

    Set-Location $wt

    & $vitest run `
        tests/tayqan-completion-correctness.test.ts `
        tests/tayqan-measurement-contract.test.ts `
        tests/tayqan-complete-workflow.test.ts `
        tests/ai-draft-boq-workflow.test.ts `
        tests/ai-measurement-inference.test.ts `
        tests/measurement-method-recommender.test.ts `
        tests/phase8-quantity-formulas.test.ts `
        tests/i18n-dictionary-parity.test.ts `
        tests/table-numeric-evidence.test.ts

    if ($LASTEXITCODE -ne 0) {
        throw "REAL TEST FAILURE."
    }

    Write-Host "PASS: focused Quantara + TAYQAN regression." -ForegroundColor Green


    Write-Host "`n=== 8. FOCUSED ESLINT ===" -ForegroundColor Cyan

    & $eslint `
        src/lib/services/ai-draft-boq-service.ts `
        src/lib/services/tayqan-measurement-service.ts `
        src/lib/services/tayqan-work-order-service.ts `
        src/components/tayqan/tayqan-work-order-panel.tsx `
        src/lib/validation/tayqan-schema.ts `
        src/lib/i18n/dictionaries/en.ts `
        src/lib/i18n/dictionaries/ar.ts `
        tests/tayqan-completion-correctness.test.ts `
        --max-warnings=0

    if ($LASTEXITCODE -ne 0) {
        throw "REAL ESLINT FAILURE."
    }

    Write-Host "PASS: focused ESLint." -ForegroundColor Green


    Write-Host "`n=== 9. EXACT FILE SCOPE ===" -ForegroundColor Cyan

    $changed = @(
        git -C $wt status --porcelain=v1 --untracked-files=all
    )

    $seen = @()

    foreach ($line in $changed) {
        if ($line.Length -lt 4) { continue }

        $p = $line.Substring(3).Trim().Replace("\","/")
        $seen += $p

        if ($allAllowedFiles -notcontains $p) {
            throw "STOP: unexpected changed file: $p"
        }
    }

    foreach ($rel in $allAllowedFiles) {
        if ($seen -notcontains $rel) {
            throw "STOP: expected PR1 file missing from change set: $rel"
        }
    }

    if ($seen.Count -ne $allAllowedFiles.Count) {
        throw "STOP: expected exactly $($allAllowedFiles.Count) changed files; found $($seen.Count)."
    }

    Write-Host "PASS: exact eight-file PR1 scope." -ForegroundColor Green


    Write-Host "`n=== 10. PROTECTED SYSTEM GATE ===" -ForegroundColor Cyan

    foreach ($p in $seen) {
        $lower = $p.ToLowerInvariant()

        if (
            $lower -eq "prisma/schema.prisma" -or
            $lower.StartsWith("prisma/migrations/") -or
            $lower.Contains("stripe") -or
            $lower.Contains("refund") -or
            $lower.Contains("catalogue") -or
            $lower.Contains("schema-recovery") -or
            $lower.Contains("/auth/")
        ) {
            throw "STOP: protected system entered PR1 scope: $p"
        }
    }

    git -C $wt diff --check

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: git diff --check failed."
    }

    Write-Host "PASS: protected systems untouched + diff clean." -ForegroundColor Green


    Write-Host "`n=== 11. STAGE EXACTLY EIGHT FILES ===" -ForegroundColor Cyan

    git -C $wt add -- $allAllowedFiles

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: git add failed."
    }

    $staged = @(
        git -C $wt diff --cached --name-only
    ) | ForEach-Object {
        $_.Trim().Replace("\","/")
    } | Where-Object { $_ }

    foreach ($p in $staged) {
        if ($allAllowedFiles -notcontains $p) {
            throw "STOP: unexpected staged file: $p"
        }
    }

    if ($staged.Count -ne $allAllowedFiles.Count) {
        throw "STOP: staged scope is not exactly eight files."
    }

    git -C $wt diff --cached --check

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: staged diff integrity failed."
    }

    git -C $wt diff --cached --stat


    Write-Host "`n=== 12. COMMIT PASSING PR1 CHECKPOINT ===" -ForegroundColor Cyan

    git -C $wt commit `
        -m "fix(tayqan): close autonomous completion correctness gaps" `
        -m "Restricts TAYQAN Draft rows to current-pass autonomous measurements, turns uncovered scope into explicit exceptions, gates Draft/final QA on unresolved measurement exceptions, supports governed remeasurement/professional exclusions, and adds explicit final deliverable acceptance." `
        -m "No Prisma schema/migration, Stripe, catalogue, auth, or normal Quantara measurement UI changes."

    if ($LASTEXITCODE -ne 0) {
        throw "STOP: PR1 commit failed."
    }

    $committed = $true
    $commit = (git -C $wt rev-parse HEAD).Trim()

    Write-Host "COMMIT: $commit" -ForegroundColor Green


    Write-Host "`n=== 13. PUSH PR1 BRANCH ===" -ForegroundColor Cyan

    git -C $wt push -u origin $branch

    if ($LASTEXITCODE -ne 0) {
        throw "PUSH FAILED. Local PR1 commit is safe; DO NOT RESET."
    }


    Write-Host "`n====================================================" -ForegroundColor Green
    Write-Host "TAYQAN COMPLETION PR1 PATCHED + TESTED + PUSHED" -ForegroundColor Green
    Write-Host "====================================================" -ForegroundColor Green

    Write-Host "`nBranch : $branch"
    Write-Host "Commit : $commit"
    Write-Host "Base   : $expectedMain"

    Write-Host "`nClosed in this PR:"
    Write-Host "1. Raw extraction cannot leak into TAYQAN Draft."
    Write-Host "2. Current measurement-pass calculation IDs are pinned."
    Write-Host "3. Unmeasured raw extraction becomes explicit SCOPE_GAP."
    Write-Host "4. Measurement exceptions hard-block Draft and final QA."
    Write-Host "5. Waivable exceptions require a professional exclusion note."
    Write-Host "6. Non-waivable measurement conflicts require remeasurement."
    Write-Host "7. Retry measurement refreshes the frozen source scope explicitly."
    Write-Host "8. READY_FOR_ACCEPTANCE no longer equals COMPLETED."
    Write-Host "9. Explicit Accept TAYQAN Deliverable records BOQ version + actor + time."

    Write-Host "`nNo Prisma migration."
    Write-Host "No DB seed/reset."
    Write-Host "No Stripe."
    Write-Host "No catalogue."
    Write-Host "No auth/RBAC."
    Write-Host "No normal Quantara measurement UI changes."
    Write-Host "No merge to main."
    Write-Host "No production deployment."
}
catch {

    Write-Host "`nTAYQAN PR1 GATE FAILED." -ForegroundColor Red

    if (-not $committed) {
        Write-Host "Restoring the exact pre-patch files..." -ForegroundColor Yellow

        foreach ($rel in $existingFiles) {
            if ($backups.ContainsKey($rel)) {
                [IO.File]::WriteAllBytes(
                    (Join-Path $wt $rel),
                    $backups[$rel]
                )
            }
        }

        $newTestFull = Join-Path $wt $newTest
        if (Test-Path $newTestFull) {
            Remove-Item -LiteralPath $newTestFull -Force
        }

        Write-Host "ROLLBACK COMPLETE. Branch remains based on audited main." -ForegroundColor Yellow
    }
    else {
        Write-Host "The local commit already exists and is safe. DO NOT RESET IT." -ForegroundColor Yellow
    }

    throw
}
