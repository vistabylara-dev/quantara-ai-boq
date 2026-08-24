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
  | "DRAFT_INTEGRITY_REQUIRED"
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
  const finalization = input.selectedBoq.finalization;
  if (!finalization || finalization.lockReason === "VERIFICATION_REQUIRED" || finalization.lockReason === "VERIFICATION_STALE") {
    return {
      state: "DRAFT_UNVALIDATED",
      why: "Verification is missing or out of date for this revision. Re-run it before finalization.",
      nextActionLabel: "Run validation",
    };
  }
  // Checked even when locked: the lock endpoint requires zero criticals at the
  // moment it locks, so this should be unreachable in practice — but if
  // verification data on hand ever disagrees, generation eligibility must
  // reflect that instead of unconditionally trusting the lock flag alone.
  if (finalization.lockReason === "UNRESOLVED_CRITICAL_EXCEPTIONS" || (input.verification !== null && input.verification.unresolvedCritical > 0)) {
    return {
      state: "DRAFT_HAS_CRITICALS",
      why: `Final output cannot be finalized because ${Math.max(finalization.unresolvedCritical, input.verification?.unresolvedCritical ?? 0)} critical validation issue(s) remain.`,
      nextActionLabel: "Review validation issues",
    };
  }
  if (finalization.lockReason === "ESTIMATE_INTEGRITY_REQUIRED") {
    return {
      state: "DRAFT_INTEGRITY_REQUIRED",
      why: `${finalization.unconfirmedItemCount} item(s) still need confirmed quantity and rate evidence before finalization.`,
      nextActionLabel: "Review BOQ evidence",
    };
  }
  if (input.verification === null || !finalization.lockEligible) {
    return {
      state: "DRAFT_UNVALIDATED",
      why: "Validation status is currently unavailable for this revision. Status unavailable does not mean zero issues.",
      nextActionLabel: "Run validation",
    };
  }
  return {
    state: "DRAFT_READY_TO_LOCK",
    why: "Validation passed for finalization. Lock this revision to enable final document output.",
    nextActionLabel: "Review & lock revision",
  };
}
