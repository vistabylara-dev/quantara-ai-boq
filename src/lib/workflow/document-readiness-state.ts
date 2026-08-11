import type { BOQ } from "@/types/boq";

/**
 * Document-generation readiness, computed only from evidence actually
 * available on the page — never assumes a revision is ready when
 * verification hasn't loaded. The backend (BOQ lock guard, generate route)
 * remains authoritative; this only decides what the UI should say and which
 * single primary action to offer, so the user is never dropped at a raw
 * "requires a locked BOQ revision" dead-end with no next step.
 */
export type DocumentReadinessState =
  | "NO_BOQ"
  | "DRAFT_UNVALIDATED"
  | "DRAFT_HAS_CRITICALS"
  | "DRAFT_READY_TO_LOCK"
  | "LOCKED_READY"
  | "GENERATING";

export type DocumentReadinessInput = {
  selectedBoq: BOQ | null;
  isLockedRevision: boolean;
  verification: { unresolvedCritical: number; unresolvedWarning: number } | null;
  isGenerating: boolean;
};

export type DocumentReadinessInfo = {
  state: DocumentReadinessState;
  why: string;
  nextActionLabel: string | null;
};

export function computeDocumentReadiness(input: DocumentReadinessInput): DocumentReadinessInfo {
  if (!input.selectedBoq) {
    return { state: "NO_BOQ", why: "This project has no BOQ revision yet.", nextActionLabel: "Open BOQ" };
  }
  if (input.isGenerating) {
    return { state: "GENERATING", why: "Generating the document now.", nextActionLabel: null };
  }
  if (input.isLockedRevision) {
    return {
      state: "LOCKED_READY",
      why: `Revision ${input.selectedBoq.revision} is locked and ready.`,
      nextActionLabel: "Generate document",
    };
  }
  if (input.verification === null) {
    return {
      state: "DRAFT_UNVALIDATED",
      why: "Validation status is currently unavailable for this revision. Status unavailable does not mean zero issues.",
      nextActionLabel: "Run validation",
    };
  }
  if (input.verification.unresolvedCritical > 0) {
    return {
      state: "DRAFT_HAS_CRITICALS",
      why: `Final output cannot be finalized because ${input.verification.unresolvedCritical} critical validation issue(s) remain.`,
      nextActionLabel: "Review validation issues",
    };
  }
  return {
    state: "DRAFT_READY_TO_LOCK",
    why: "Validation passed for finalization. Lock this revision to enable final document output.",
    nextActionLabel: "Review & lock revision",
  };
}
