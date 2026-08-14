import type { WorkerAssignmentStatus, WorkerEventType, WorkerRunEventType, WorkerRunStatus } from "@prisma/client";

/**
 * TAYQAN-1 — maps the existing durable Prisma status enums onto the
 * human-facing "hired employee" presentation the product wants, without
 * changing the enums themselves (per the non-negotiable rule against
 * schema churn in this patch). Every mapping here is total (every existing
 * enum value has an explicit case) so a future enum addition fails to
 * compile here rather than silently falling through to a default.
 *
 * This is the single presentation-logic source of truth for TAYQAN: the UI
 * must call these functions rather than re-deriving its own status/timeline
 * labels, and every string this file returns is a dictionary key (never
 * English prose) so the UI can resolve it through the active locale's
 * translator — see src/app/projects/[projectId]/tayqan/page.tsx.
 */

export type TayqanPresentationState =
  | "WORKING"
  | "WAITING_FOR_YOU"
  | "READY_FOR_REVIEW"
  | "COMPLETED"
  | "NEEDS_ATTENTION"
  | "CANCELLED";

export function presentRunStatus(status: WorkerRunStatus): TayqanPresentationState {
  switch (status) {
    case "QUEUED":
    case "RUNNING":
      return "WORKING";
    case "COMPLETED":
      return "COMPLETED"; // caller should prefer presentAssignmentStatus once resultAssignment exists
    case "FAILED":
      return "NEEDS_ATTENTION";
    case "CANCELLED":
      return "CANCELLED";
  }
}

export function presentAssignmentStatus(status: WorkerAssignmentStatus, hasOpenQuestions: boolean): TayqanPresentationState {
  switch (status) {
    case "RUNNING":
      return "WORKING";
    case "NEEDS_INPUT":
      return "WAITING_FOR_YOU";
    case "COMPLETED":
      return hasOpenQuestions ? "WAITING_FOR_YOU" : "READY_FOR_REVIEW";
    case "FAILED":
      return "NEEDS_ATTENTION";
    case "CANCELLED":
      return "CANCELLED";
  }
}

const STATUS_TRANSLATION_KEY: Record<TayqanPresentationState, string> = {
  WORKING: "tayqan.status.working",
  WAITING_FOR_YOU: "tayqan.status.waitingForYou",
  READY_FOR_REVIEW: "tayqan.status.readyForReview",
  COMPLETED: "tayqan.status.completed",
  NEEDS_ATTENTION: "tayqan.status.needsAttention",
  CANCELLED: "tayqan.status.cancelled",
};

/** Dot-path into the i18n dictionary for a presentation state — resolve with t(). Kept as one exhaustive map so a future TayqanPresentationState value fails to compile here rather than rendering untranslated. */
export function statusTranslationKey(state: TayqanPresentationState): string {
  return STATUS_TRANSLATION_KEY[state];
}

/** Dot-path into the i18n dictionary for a TAYQAN capability id — resolve with t(). Keeps the "tayqan.capabilities." prefix defined in exactly one place. */
export function capabilityTranslationKey(capabilityKey: string): string {
  return `tayqan.capabilities.${capabilityKey}`;
}

/**
 * Non-persisted, best-effort "what is TAYQAN doing right now" stage, derived
 * strictly from which WorkerRunEvent/WorkerEvent types have actually been
 * recorded so far — never invented. Returns null once no further inference
 * is meaningful (e.g. the run/assignment already reached a terminal state).
 */
export type TayqanStage = "PLANNING" | "REVIEWING_BOQ" | "CHECKING_EVIDENCE" | "QA_REVIEW";

export function deriveStage(input: {
  runEventTypes: readonly WorkerRunEventType[];
  assignmentEventTypes: readonly WorkerEventType[];
}): TayqanStage | null {
  const assignmentEvents = new Set(input.assignmentEventTypes);
  const runEvents = new Set(input.runEventTypes);

  if (assignmentEvents.has("DECISIONS_RECORDED") || assignmentEvents.has("WORKSPACE_CAPTURED")) return "QA_REVIEW";
  if (assignmentEvents.has("INSPECTION_STARTED")) return "CHECKING_EVIDENCE";
  if (assignmentEvents.has("ASSIGNMENT_CREATED")) return "REVIEWING_BOQ";
  if (runEvents.has("LEASE_ACQUIRED") || runEvents.has("RUN_ENQUEUED")) return "PLANNING";
  return null;
}

/**
 * TAYQAN-1 — activity-timeline entries, built ONLY from real persisted
 * WorkerEvent/WorkerRunEvent rows passed in, and returning a dictionary key
 * (never a pre-rendered English label) so the UI can translate it. Never
 * fabricates an event that was not actually recorded.
 */
export type TayqanTimelineEntry = {
  /** Dot-path into the i18n dictionary — resolve with t(entry.i18nKey, entry.vars). */
  i18nKey: string;
  createdAt: string;
  vars?: Record<string, string | number>;
};

const ASSIGNMENT_EVENT_KEYS: Record<WorkerEventType, string> = {
  ASSIGNMENT_CREATED: "tayqan.timeline.assignmentCreated",
  INSPECTION_STARTED: "tayqan.timeline.inspectionStarted",
  WORKSPACE_CAPTURED: "tayqan.timeline.workspaceCaptured",
  DECISIONS_RECORDED: "tayqan.timeline.decisionsRecorded",
  MATERIAL_QUESTIONS_OPENED: "tayqan.timeline.materialQuestionsOpened",
  MATERIAL_QUESTION_ANSWERED: "tayqan.timeline.materialQuestionAnswered",
  REVIEW_COMPLETED: "tayqan.timeline.reviewCompleted",
  REVIEW_NEEDS_INPUT: "tayqan.timeline.reviewNeedsInput",
  REVIEW_FAILED: "tayqan.timeline.reviewFailed",
};

const RUN_EVENT_KEYS: Record<WorkerRunEventType, string> = {
  RUN_ENQUEUED: "tayqan.timeline.runEnqueued",
  LEASE_ACQUIRED: "tayqan.timeline.leaseAcquired",
  RETRY_SCHEDULED: "tayqan.timeline.retryScheduled",
  DETERMINISTIC_REVIEW_LINKED: "tayqan.timeline.deterministicReviewLinked",
  AI_PLANNER_SKIPPED: "tayqan.timeline.aiPlannerSkipped",
  AI_PLAN_RECORDED: "tayqan.timeline.aiPlanRecorded",
  RUN_COMPLETED: "tayqan.timeline.runCompleted",
  RUN_FAILED: "tayqan.timeline.runFailed",
};

export function buildAssignmentTimeline(
  events: readonly { eventType: WorkerEventType; createdAt: string; payload?: unknown }[],
): TayqanTimelineEntry[] {
  return events.map((event) => {
    let i18nKey = ASSIGNMENT_EVENT_KEYS[event.eventType];
    let vars: Record<string, string | number> | undefined;
    if (event.eventType === "MATERIAL_QUESTIONS_OPENED" && event.payload && typeof event.payload === "object") {
      const count = (event.payload as Record<string, unknown>).materialQuestionCount;
      if (typeof count === "number") {
        i18nKey = count === 1 ? "tayqan.timeline.materialQuestionsOpenedOne" : "tayqan.timeline.materialQuestionsOpenedOther";
        vars = { count };
      }
    }
    return { i18nKey, createdAt: event.createdAt, vars };
  });
}

export function buildRunTimeline(
  events: readonly { eventType: WorkerRunEventType; createdAt: string }[],
): TayqanTimelineEntry[] {
  return events.map((event) => ({ i18nKey: RUN_EVENT_KEYS[event.eventType], createdAt: event.createdAt }));
}

/**
 * TAYQAN-1 — same-BOQ rehire: whether the BOQ has changed since the latest
 * TAYQAN run's own source snapshot (WorkerRun.sourceBoqVersion, captured at
 * hire time — no new persistence). BOQ version is the strongest change
 * detector (it increments on every governed mutation); revisionNumber is
 * carried alongside purely for display. Only meaningful for a COMPLETED
 * run — callers must not use this to reinterpret FAILED/CANCELLED as "BOQ
 * changed"; those are a separate retry concept.
 */
export type TayqanRunSourceSnapshot = { boqVersion: number; revisionNumber: number };
export type TayqanCurrentBoq = { version: number; revisionNumber: number };

export function isReviewStale(source: TayqanRunSourceSnapshot, current: TayqanCurrentBoq): boolean {
  return source.boqVersion !== current.version;
}

/**
 * Whether a same-BOQ rehire CTA may ever be offered for the latest run's
 * presentation state — true only once the review is fully resolved
 * (READY_FOR_REVIEW: completed, no open questions). This is also what
 * structurally blocks a concurrent duplicate review: WORKING (queued/
 * running) and WAITING_FOR_YOU (an open material question) never qualify,
 * and NEEDS_ATTENTION/CANCELLED are deliberately excluded — those are a
 * separate retry concept, not "the BOQ changed".
 */
export function canOfferRehire(state: TayqanPresentationState | null): boolean {
  return state === "READY_FOR_REVIEW";
}
