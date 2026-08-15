export const TAYQAN_WORK_STAGE_ORDER = [
  "SOURCE_DISCOVERY",
  "SOURCE_PROCESSING",
  "EVIDENCE_REVIEW",
  "QUANTITY_PREPARATION",
  "RATE_PREPARATION",
  "BOQ_ASSEMBLY",
  "VALIDATION",
  "READY_FOR_ACCEPTANCE",
] as const;

export type TayqanWorkStageKey = (typeof TAYQAN_WORK_STAGE_ORDER)[number];

export const TAYQAN_TERMINAL_WORK_STATUSES = new Set([
  "READY_FOR_ACCEPTANCE",
  "COMPLETED",
  "FAILED",
  "CANCELLED",
]);

export const TAYQAN_RATE_QUESTION_TYPES = new Set([
  "CONFIRM_RATE_PROVENANCE",
  "CONFIRM_EXPIRED_RATE_SOURCE",
]);

export function tayqanStageIndex(stage: string): number {
  return TAYQAN_WORK_STAGE_ORDER.indexOf(stage as TayqanWorkStageKey);
}
