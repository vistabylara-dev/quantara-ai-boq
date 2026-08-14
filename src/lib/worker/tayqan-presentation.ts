import type { WorkerAssignmentStatus, WorkerEventType, WorkerRunEventType, WorkerRunStatus } from "@prisma/client";

/**
 * TAYQAN-1 — maps the existing durable Prisma status enums onto the
 * human-facing "hired employee" presentation the product wants, without
 * changing the enums themselves (per the non-negotiable rule against
 * schema churn in this patch). Every mapping here is total (every existing
 * enum value has an explicit case) so a future enum addition fails to
 * compile here rather than silently falling through to a default.
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
 * TAYQAN-1 — human-readable activity-timeline lines, built ONLY from real
 * persisted WorkerEvent/WorkerRunEvent rows passed in. Never fabricates an
 * event that was not actually recorded; an event type with no known label
 * still renders (using its raw type as a safe fallback) rather than being
 * silently dropped, so the timeline is always a complete, honest record.
 */
export type TayqanTimelineEntry = { label: string; createdAt: string };

const ASSIGNMENT_EVENT_LABELS: Record<WorkerEventType, string> = {
  ASSIGNMENT_CREATED: "TAYQAN hired",
  INSPECTION_STARTED: "Review started",
  WORKSPACE_CAPTURED: "BOQ workspace captured",
  DECISIONS_RECORDED: "Quantity and rate evidence checked",
  MATERIAL_QUESTIONS_OPENED: "Material questions opened",
  MATERIAL_QUESTION_ANSWERED: "You answered a question",
  REVIEW_COMPLETED: "QA review completed",
  REVIEW_NEEDS_INPUT: "TAYQAN needs your decision",
  REVIEW_FAILED: "Review could not complete",
};

const RUN_EVENT_LABELS: Record<WorkerRunEventType, string> = {
  RUN_ENQUEUED: "TAYQAN was hired",
  LEASE_ACQUIRED: "TAYQAN started working",
  RETRY_SCHEDULED: "TAYQAN is retrying",
  DETERMINISTIC_REVIEW_LINKED: "Review results linked",
  AI_PLANNER_SKIPPED: "Advisory plan skipped",
  AI_PLAN_RECORDED: "Advisory plan recorded",
  RUN_COMPLETED: "TAYQAN finished this run",
  RUN_FAILED: "TAYQAN's run failed",
};

export function buildAssignmentTimeline(
  events: readonly { eventType: WorkerEventType; createdAt: string; payload?: unknown }[],
): TayqanTimelineEntry[] {
  return events.map((event) => {
    let label = ASSIGNMENT_EVENT_LABELS[event.eventType] ?? event.eventType;
    if (event.eventType === "MATERIAL_QUESTIONS_OPENED" && event.payload && typeof event.payload === "object") {
      const count = (event.payload as Record<string, unknown>).materialQuestionCount;
      if (typeof count === "number") label = `${count} material question${count === 1 ? "" : "s"} opened`;
    }
    return { label, createdAt: event.createdAt };
  });
}

export function buildRunTimeline(
  events: readonly { eventType: WorkerRunEventType; createdAt: string }[],
): TayqanTimelineEntry[] {
  return events.map((event) => ({ label: RUN_EVENT_LABELS[event.eventType] ?? event.eventType, createdAt: event.createdAt }));
}
