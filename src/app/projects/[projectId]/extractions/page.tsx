"use client";

import Link from "next/link";
import { use, useCallback, useEffect, useMemo, useState } from "react";
import StatusBadge, { formatStatusLabel, type StatusTone } from "@/components/dashboard/status-badge";
import { ApiClientError, apiClient } from "@/lib/api/client";
import {
  getProjectSourceOrigin,
  isReviewableExtractionStatus,
  summarizeExtractionReview,
  validateCorrectionDraft,
} from "@/lib/guidance/project-workflow";
import {
  DEFAULT_EXTRACTION_REVIEW_FILTERS,
  filterExtractionReviewEntities,
  getExtractionReviewPriority,
  uniqueExtractionFilterValues,
  type ExtractionReviewFilters,
} from "@/lib/guidance/extraction-review-filters";
import { summarizeAiDraftCandidates } from "@/lib/guidance/ai-draft-boq";
import { GuideTip } from "@/components/guidance/guide-tip";

type ProjectFileView = {
  id: string;
  originalName: string;
  metadata: unknown;
};

type ExtractedEntityView = {
  id: string;
  projectId: string;
  projectFileId: string;
  entityType: string;
  label: string;
  quantity: number | null;
  unit: string | null;
  confidence: number;
  extractionMethod: string;
  sourceText: string | null;
  tableEvidence?: Array<{
    fieldKey: string;
    fieldTitle: string;
    rawValue: string;
    isNumericLike: boolean;
  }>;
  status: string;
  correction: unknown;
  confirmedAt: string | null;
  rejectedAt: string | null;
};

type CorrectionDraft = {
  label: string;
  quantity: string;
  unit: string;
  reason: string;
};

type PendingAction = {
  entityId: string;
  action: "confirm" | "correct" | "reject";
};

type AiDraftGenerationResult = {
  boqId: string;
  addedCount: number;
  skippedCount: number;
  alreadyPresentCount: number;
  unreviewedAddedCount: number;
  reviewedAddedCount: number;
  measurementIncompleteAddedCount: number;
};

const EXTRACTION_STATUS_TONE: Record<string, StatusTone> = {
  EXTRACTED: "warning",
  NEEDS_REVIEW: "warning",
  CONFIRMED: "success",
  CORRECTED: "success",
  REJECTED: "error",
  IMPORTED: "info",
};

function recordValue(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : null;
}

function displayValue(value: unknown): string | null {
  if (typeof value === "string") return value;
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  return null;
}

function correctionSummary(value: unknown) {
  const correction = recordValue(value);
  if (!correction) return null;
  const original = recordValue(correction.original);
  const corrected = recordValue(correction.corrected);
  const fields = ["label", "quantity", "unit"] as const;

  return {
    reason: typeof correction.reason === "string" ? correction.reason : null,
    original: fields
      .map((field) => ({ field, value: displayValue(original?.[field]) }))
      .filter((entry): entry is { field: (typeof fields)[number]; value: string } => entry.value !== null),
    corrected: fields
      .map((field) => ({ field, value: displayValue(corrected?.[field]) }))
      .filter((entry): entry is { field: (typeof fields)[number]; value: string } => entry.value !== null),
  };
}

function safeReviewError(error: unknown, fallback: string): string {
  if (!(error instanceof ApiClientError)) return fallback;
  if (error.status === 401) return "Your session has expired. Sign in again to continue.";
  if (error.status === 403) return "Your role does not have permission to review extracted information.";
  if (error.status === 404) return "This review item is no longer available in the current project.";
  if (error.code === "ENTITY_ALREADY_FINALIZED") return "This review item has already been finalized. Refresh the workspace before continuing.";
  if (error.code === "NETWORK_ERROR") return "The server could not be reached. Check the connection and try again.";
  return fallback;
}

function formatConfidence(confidence: number): string {
  if (!Number.isFinite(confidence)) return "Not available";
  return `${confidence.toLocaleString(undefined, { maximumFractionDigits: 2 })}%`;
}

function CorrectionInformation({ correction }: { correction: unknown }) {
  const summary = correctionSummary(correction);
  if (!summary) return null;
  const hasDetails = summary.reason || summary.original.length > 0 || summary.corrected.length > 0;

  return (
    <div className="rounded-2xl border border-[#D98A16]/30 bg-[#D98A16]/5 p-4 dark:border-amber-400/20 dark:bg-amber-400/5">
      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#D98A16] dark:text-amber-300">
        Review information
      </p>
      {summary.reason && (
        <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#536078] dark:text-[#B8C4D8]">
          Reason: {summary.reason}
        </p>
      )}
      {summary.original.length > 0 && (
        <p className="mt-2 text-xs text-[#7B879C] dark:text-[#8CA0BE]">
          Original: {summary.original.map((entry) => `${formatStatusLabel(entry.field)} ${entry.value}`).join(" · ")}
        </p>
      )}
      {summary.corrected.length > 0 && (
        <p className="mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">
          Corrected: {summary.corrected.map((entry) => `${formatStatusLabel(entry.field)} ${entry.value}`).join(" · ")}
        </p>
      )}
      {!hasDetails && <p className="mt-2 text-sm text-[#536078] dark:text-[#B8C4D8]">Professional review information was recorded.</p>}
    </div>
  );
}

export default function ProjectExtractionsPage(props: { params: Promise<{ projectId: string }> }) {
  const params = use(props.params);
  const [files, setFiles] = useState<ProjectFileView[]>([]);
  const [entities, setEntities] = useState<ExtractedEntityView[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [correctingId, setCorrectingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  const [correctionDraft, setCorrectionDraft] = useState<CorrectionDraft>({ label: "", quantity: "", unit: "", reason: "" });
  const [rejectionReason, setRejectionReason] = useState("");
  const [formError, setFormError] = useState<string | null>(null);
  const [filters, setFilters] = useState<ExtractionReviewFilters>({ ...DEFAULT_EXTRACTION_REVIEW_FILTERS });
  const [exceptionsOnly, setExceptionsOnly] = useState(false);
  const [isGeneratingDraft, setIsGeneratingDraft] = useState(false);

  const encodedProjectId = encodeURIComponent(params.projectId);

  const fetchWorkspace = useCallback(async (signal?: AbortSignal) => {
    return Promise.all([
      apiClient.get<ExtractedEntityView[]>(`/api/projects/${encodedProjectId}/extractions`, signal),
      apiClient.get<ProjectFileView[]>(`/api/projects/${encodedProjectId}/files`, signal),
    ]);
  }, [encodedProjectId]);

  const loadWorkspace = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [entityData, fileData] = await fetchWorkspace(signal);
      setEntities(entityData);
      setFiles(fileData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(safeReviewError(error, "The extraction review workspace could not be loaded. Try again."));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [fetchWorkspace]);

  useEffect(() => {
    const controller = new AbortController();
    void loadWorkspace(controller.signal);
    return () => controller.abort();
  }, [loadWorkspace]);

  const sourceFiles = useMemo(() => new Map(files.map((file) => [file.id, file])), [files]);
  const reviewSummary = useMemo(
    () => summarizeExtractionReview(entities.map((entity) => entity.status)),
    [entities],
  );

  const importableEntityCount = useMemo(
    () => entities.filter(
      (entity) => entity.status === "CONFIRMED" || entity.status === "CORRECTED",
    ).length,
    [entities],
  );

  const draftSummary = useMemo(
    () => summarizeAiDraftCandidates(entities),
    [entities],
  );

  const filteredEntities = useMemo(() => {
    const filtered = filterExtractionReviewEntities(entities, filters);
    if (!exceptionsOnly) return filtered;
    return filtered.filter(
      (entity) =>
        isReviewableExtractionStatus(entity.status)
        && getExtractionReviewPriority(entity) !== "SAFE",
    );
  }, [entities, exceptionsOnly, filters]);
  const statusOptions = useMemo(
    () => uniqueExtractionFilterValues(entities.map((entity) => entity.status)),
    [entities],
  );
  const entityTypeOptions = useMemo(
    () => uniqueExtractionFilterValues(entities.map((entity) => entity.entityType)),
    [entities],
  );
  const extractionMethodOptions = useMemo(
    () => uniqueExtractionFilterValues(entities.map((entity) => entity.extractionMethod)),
    [entities],
  );
  const priorityCounts = useMemo(
    () => entities.filter(
      (entity) => isReviewableExtractionStatus(entity.status),
    ).reduce(
      (counts, entity) => {
        counts[getExtractionReviewPriority(entity)] += 1;
        return counts;
      },
      { SAFE: 0, REVIEW: 0, CRITICAL: 0 },
    ),
    [entities],
  );
  const hasActiveFilters = exceptionsOnly || Object.entries(filters).some(
    ([key, value]) => key === "search" ? Boolean(value.trim()) : value !== "ALL",
  );

  const refreshAfterAction = useCallback(async () => {
    try {
      const [entityData, fileData] = await fetchWorkspace();
      setEntities(entityData);
      setFiles(fileData);
    } catch {
      setActionError("The review action was saved, but the workspace could not be refreshed. Try again.");
    }
  }, [fetchWorkspace]);

  const finishAction = useCallback(async (updated: ExtractedEntityView, message: string) => {
    setEntities((current) => current.map((entity) => entity.id === updated.id ? updated : entity));
    setActionMessage(message);
    setCorrectingId(null);
    setRejectingId(null);
    setCorrectionDraft({ label: "", quantity: "", unit: "", reason: "" });
    setRejectionReason("");
    setFormError(null);
    await refreshAfterAction();
  }, [refreshAfterAction]);

  const confirmEntity = useCallback(async (entityId: string) => {
    setPendingAction({ entityId, action: "confirm" });
    setActionError(null);
    setActionMessage(null);
    try {
      const updated = await apiClient.post<ExtractedEntityView>(`/api/extractions/${encodeURIComponent(entityId)}/confirm`);
      await finishAction(updated, "Extracted information confirmed.");
    } catch (error) {
      setActionError(safeReviewError(error, "The extracted information could not be confirmed. Try again."));
    } finally {
      setPendingAction(null);
    }
  }, [finishAction]);

  const submitCorrection = useCallback(async (entityId: string) => {
    const validation = validateCorrectionDraft(correctionDraft);
    if (!validation.ok) {
      setFormError(
        Object.values(validation.fieldErrors).find((message): message is string => Boolean(message))
          ?? "Check the correction fields and add a professional-review reason.",
      );
      return;
    }

    setPendingAction({ entityId, action: "correct" });
    setActionError(null);
    setActionMessage(null);
    setFormError(null);
    try {
      const updated = await apiClient.post<ExtractedEntityView>(
        `/api/extractions/${encodeURIComponent(entityId)}/correct`,
        validation.value,
      );
      await finishAction(updated, "Correction recorded and confirmed.");
    } catch (error) {
      setActionError(safeReviewError(error, "The correction could not be recorded. Check the fields and try again."));
    } finally {
      setPendingAction(null);
    }
  }, [correctionDraft, finishAction]);

  const submitRejection = useCallback(async (entityId: string) => {
    const reason = rejectionReason.trim();
    if (!reason) {
      setFormError("A professional-review reason is required before rejecting this item.");
      return;
    }

    setPendingAction({ entityId, action: "reject" });
    setActionError(null);
    setActionMessage(null);
    setFormError(null);
    try {
      const updated = await apiClient.post<ExtractedEntityView>(
        `/api/extractions/${encodeURIComponent(entityId)}/reject`,
        { reason },
      );
      await finishAction(updated, "Extracted information rejected.");
    } catch (error) {
      setActionError(safeReviewError(error, "The extracted information could not be rejected. Try again."));
    } finally {
      setPendingAction(null);
    }
  }, [finishAction, rejectionReason]);

  function openCorrection(entity: ExtractedEntityView) {
    setCorrectingId(entity.id);
    setRejectingId(null);
    setCorrectionDraft({
      label: entity.label,
      quantity: entity.quantity === null ? "" : String(entity.quantity),
      unit: entity.unit ?? "",
      reason: "",
    });
    setRejectionReason("");
    setFormError(null);
    setActionError(null);
  }

  function openRejection(entityId: string) {
    setRejectingId(entityId);
    setCorrectingId(null);
    setRejectionReason("");
    setCorrectionDraft({ label: "", quantity: "", unit: "", reason: "" });
    setFormError(null);
    setActionError(null);
  }

  function focusReviewItems() {
    requestAnimationFrame(() => {
      const reviewItems = document.getElementById("extraction-review-items");
      reviewItems?.scrollIntoView({ behavior: "smooth", block: "start" });
      reviewItems?.focus({ preventScroll: true });
    });
  }

  function reviewExceptionsFirst() {
    setFilters({ ...DEFAULT_EXTRACTION_REVIEW_FILTERS });
    setExceptionsOnly(true);
    focusReviewItems();
  }

  function reviewEverythingFirst() {
    setFilters({ ...DEFAULT_EXTRACTION_REVIEW_FILTERS });
    setExceptionsOnly(false);
    focusReviewItems();
  }

  async function generateDraftBoq() {
    if (isGeneratingDraft || draftSummary.eligibleCount === 0) return;
    setIsGeneratingDraft(true);
    setActionError(null);
    setActionMessage(null);

    try {
      const result = await apiClient.post<AiDraftGenerationResult>(
        `/api/projects/${encodedProjectId}/extractions/generate-draft-boq`,
        {},
      );
      const query = new URLSearchParams({
        aiDraft: "1",
        added: String(result.addedCount),
        skipped: String(result.skippedCount),
        existing: String(result.alreadyPresentCount),
      });
      window.location.assign(`/projects/${encodedProjectId}/boq?${query.toString()}`);
    } catch (error) {
      setActionError(
        error instanceof ApiClientError
          ? error.message
          : "The AI Draft BOQ could not be prepared. Try again.",
      );
    } finally {
      setIsGeneratingDraft(false);
    }
  }

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <p className="text-lg font-semibold text-[#0B1630] dark:text-white">Loading extraction review</p>
        <p className="mt-2 text-sm text-[#536078] dark:text-[#B8C4D8]">Loading project sources and extracted candidates.</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-[#D84A4A]/30 bg-white p-8 dark:border-rose-400/20 dark:bg-[#0B1426]">
        <p className="text-lg font-semibold text-[#0B1630] dark:text-white">Extraction review unavailable</p>
        <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>
        <button
          type="button"
          onClick={() => void loadWorkspace()}
          className="mt-5 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <section className="rounded-[32px] border border-[#D9E2EC] bg-white p-8 dark:border-[#1E2A42] dark:bg-[#0B1426]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">Extraction review</p>
            <h2 className="mt-2 text-3xl font-semibold text-[#0B1630] dark:text-white">Review extracted project information</h2>
          </div>
          <GuideTip
            title="Why do I need to review this?"
            shortDescription="Review the information Quantara found in your project source."
            whatQuantaraDoes="Shows values extracted from supported source content and flags anything that could not be interpreted safely — none of it is treated as fact until you say so."
            whatProfessionalCanDo="Confirm correct information, correct anything inaccurate, or reject information that should not enter the BOQ. Confirmed information becomes available for measurement and BOQ preparation."
            cta={{
              label: "Review extracted project information",
              onAction: () => {
                const reviewItems = document.getElementById("extraction-review-items");
                reviewItems?.scrollIntoView({ behavior: "smooth", block: "start" });
                reviewItems?.focus({ preventScroll: true });
              },
            }}
            ariaLabel="Help: Review extraction"
          />
        </div>
        <p className="mt-3 max-w-3xl text-sm text-[#536078] dark:text-[#B8C4D8]">
          Quantara presents source-linked candidates for professional review. Nothing is professionally confirmed automatically. You can review first, or prepare an editable AI Draft BOQ and perform the professional review in the completed BOQ table.
        </p>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 dark:border-[#1E2A42] dark:bg-[#111D33]">
            <p className="text-2xl font-semibold text-[#0B1630] dark:text-white">{reviewSummary.total}</p>
            <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Candidates found</p>
          </div>
          <div className="rounded-2xl border border-[#159A6A]/30 bg-[#159A6A]/5 p-4 dark:border-emerald-400/20 dark:bg-emerald-400/5">
            <p className="text-2xl font-semibold text-[#159A6A] dark:text-emerald-300">{reviewSummary.reviewed}</p>
            <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">Reviewed</p>
          </div>
          <div className="rounded-2xl border border-[#D98A16]/30 bg-[#D98A16]/5 p-4 dark:border-amber-400/20 dark:bg-amber-400/5">
            <p className="text-2xl font-semibold text-[#D98A16] dark:text-amber-300">{reviewSummary.needsAttention}</p>
            <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">Require attention</p>
          </div>
        </div>

        {reviewSummary.total === 0 ? (
          <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 p-5 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0077B6] dark:text-[#21C7F3]">What should I do next?</p>
              <p className="mt-2 text-sm font-medium text-[#0B1630] dark:text-white">
                Review your project sources and process supported files to continue.
              </p>
            </div>
            <Link
              href={`/projects/${encodedProjectId}/files`}
              className="inline-flex shrink-0 justify-center rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
            >
              Review Project Sources
            </Link>
          </div>
        ) : (
          <div className="mt-6 rounded-3xl border border-[#009FE3]/30 bg-[#009FE3]/5 p-5 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0077B6] dark:text-[#21C7F3]">Choose how you want to continue</p>
            <h3 className="mt-2 text-xl font-semibold text-[#0B1630] dark:text-white">Review where it is fastest for you</h3>
            <p className="mt-2 max-w-4xl text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
              Quantara can prepare the editable BOQ now, or you can review extracted information first. The AI Draft path never approves extraction silently and never invents commercial rates.
            </p>

            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              <div className="flex flex-col rounded-2xl border border-[#009FE3]/40 bg-white p-5 dark:border-[#21C7F3]/40 dark:bg-[#0B1426]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#0077B6] dark:text-[#21C7F3]">Fastest path</p>
                <h4 className="mt-2 font-semibold text-[#0B1630] dark:text-white">Generate Draft BOQ Now</h4>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
                  Prepare the editable BOQ from {draftSummary.eligibleCount} extracted {draftSummary.eligibleCount === 1 ? "item" : "items"}. Review the completed table and complete or correct only what is needed.
                </p>
                {draftSummary.measurementIncompleteCount > 0 && (
                  <p className="mt-2 text-xs font-medium text-[#D98A16] dark:text-amber-300">
                    {draftSummary.measurementIncompleteCount} {draftSummary.measurementIncompleteCount === 1 ? "item has" : "items have"} an unresolved quantity and/or unit. Quantara will carry {draftSummary.measurementIncompleteCount === 1 ? "it" : "them"} into the AI Draft as clearly unresolved fields for completion in the BOQ.
                  </p>
                )}
                {draftSummary.skippedCount > 0 && (
                  <p className="mt-2 text-xs font-medium text-[#D84A4A] dark:text-rose-300">
                    {draftSummary.skippedCount} {draftSummary.skippedCount === 1 ? "candidate cannot" : "candidates cannot"} enter the draft because the item description is missing.
                  </p>
                )}
                <button
                  type="button"
                  onClick={() => void generateDraftBoq()}
                  disabled={isGeneratingDraft || draftSummary.eligibleCount === 0}
                  className="mt-4 rounded-xl bg-[#009FE3] px-4 py-2.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-40 dark:bg-[#21C7F3] dark:text-[#040A16]"
                >
                  {isGeneratingDraft ? "Preparing AI Draft..." : "Generate Draft BOQ Now"}
                </button>
              </div>

              <div className="flex flex-col rounded-2xl border border-[#D98A16]/30 bg-white p-5 dark:border-amber-400/20 dark:bg-[#0B1426]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#D98A16] dark:text-amber-300">Exception review</p>
                <h4 className="mt-2 font-semibold text-[#0B1630] dark:text-white">Review Exceptions First</h4>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
                  Focus only on {priorityCounts.CRITICAL + priorityCounts.REVIEW} critical or recommended-review {priorityCounts.CRITICAL + priorityCounts.REVIEW === 1 ? "item" : "items"} before preparing the BOQ.
                </p>
                <button
                  type="button"
                  onClick={reviewExceptionsFirst}
                  disabled={priorityCounts.CRITICAL + priorityCounts.REVIEW === 0}
                  className="mt-4 rounded-xl border border-[#D98A16] px-4 py-2.5 text-sm font-semibold text-[#D98A16] transition hover:bg-[#D98A16]/5 disabled:cursor-not-allowed disabled:opacity-40 dark:text-amber-300"
                >
                  Review Exceptions
                </button>
              </div>

              <div className="flex flex-col rounded-2xl border border-[#D9E2EC] bg-white p-5 dark:border-[#1E2A42] dark:bg-[#0B1426]">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#7B879C] dark:text-[#7F8DA6]">Full professional review</p>
                <h4 className="mt-2 font-semibold text-[#0B1630] dark:text-white">Review Everything First</h4>
                <p className="mt-2 flex-1 text-sm leading-6 text-[#536078] dark:text-[#B8C4D8]">
                  Keep the existing detailed workflow and confirm, correct, or reject every extracted candidate before BOQ preparation.
                </p>
                <button
                  type="button"
                  onClick={reviewEverythingFirst}
                  className="mt-4 rounded-xl border border-[#D9E2EC] px-4 py-2.5 text-sm font-semibold text-[#536078] transition hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:text-[#B8C4D8] dark:hover:bg-[#111D33]"
                >
                  Review All Extracted Data
                </button>
              </div>
            </div>

            <p className="mt-4 text-xs leading-5 text-[#7B879C] dark:text-[#7F8DA6]">
              AI Draft quantities remain professionally unconfirmed until you explicitly confirm them from the BOQ. Rates remain unselected until you use your purchased package, catalogue, company library, or manual pricing workflow.
            </p>
          </div>
        )}
      </section>

      {actionError && (
        <div role="alert" className="rounded-2xl border border-[#D84A4A]/30 bg-[#D84A4A]/5 p-4 text-sm text-[#D84A4A] dark:border-rose-400/20 dark:bg-rose-400/5 dark:text-rose-300">
          {actionError}
        </div>
      )}
      {actionMessage && (
        <div role="status" className="rounded-2xl border border-[#159A6A]/30 bg-[#159A6A]/5 p-4 text-sm text-[#159A6A] dark:border-emerald-400/20 dark:bg-emerald-400/5 dark:text-emerald-300">
          {actionMessage}
        </div>
      )}

      {entities.length > 0 && (
        <section className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0077B6] dark:text-[#21C7F3]">
                Smart review filters
              </p>
              <h3 className="mt-2 text-xl font-semibold text-[#0B1630] dark:text-white">Focus on exceptions first</h3>
              <p className="mt-1 text-sm text-[#536078] dark:text-[#B8C4D8]">
                Filtering only changes what you see. It never confirms, rejects or edits extracted information.
              </p>
            </div>
            <button
              type="button"
              disabled={!hasActiveFilters}
              onClick={() => {
                setFilters({ ...DEFAULT_EXTRACTION_REVIEW_FILTERS });
                setExceptionsOnly(false);
              }}
              className="rounded-2xl border border-[#D9E2EC] px-4 py-2 text-sm font-semibold text-[#536078] disabled:cursor-not-allowed disabled:opacity-40 dark:border-[#1E2A42] dark:text-[#B8C4D8]"
            >
              Reset filters
            </button>
          </div>

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <label className="xl:col-span-2">
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Search</span>
              <input
                type="search"
                value={filters.search}
                onChange={(event) => setFilters((current) => ({ ...current, search: event.target.value }))}
                placeholder="Search label, type, unit or method"
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              />
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Review priority</span>
              <select
                value={filters.priority}
                onChange={(event) => setFilters((current) => ({ ...current, priority: event.target.value as ExtractionReviewFilters["priority"] }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All priorities</option>
                <option value="CRITICAL">Critical first</option>
                <option value="REVIEW">Review recommended</option>
                <option value="SAFE">Safe candidates</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Confidence</span>
              <select
                value={filters.confidence}
                onChange={(event) => setFilters((current) => ({ ...current, confidence: event.target.value as ExtractionReviewFilters["confidence"] }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All confidence</option>
                <option value="LOW">Below 85%</option>
                <option value="MEDIUM">85–94.99%</option>
                <option value="HIGH">95%+</option>
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Status</span>
              <select
                value={filters.status}
                onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All statuses</option>
                {statusOptions.map((status) => <option key={status} value={status}>{formatStatusLabel(status)}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Source file</span>
              <select
                value={filters.sourceFileId}
                onChange={(event) => setFilters((current) => ({ ...current, sourceFileId: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All source files</option>
                {files.map((file) => <option key={file.id} value={file.id}>{file.originalName}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Entity type</span>
              <select
                value={filters.entityType}
                onChange={(event) => setFilters((current) => ({ ...current, entityType: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All entity types</option>
                {entityTypeOptions.map((type) => <option key={type} value={type}>{formatStatusLabel(type)}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Extraction method</span>
              <select
                value={filters.extractionMethod}
                onChange={(event) => setFilters((current) => ({ ...current, extractionMethod: event.target.value }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All methods</option>
                {extractionMethodOptions.map((method) => <option key={method} value={method}>{formatStatusLabel(method)}</option>)}
              </select>
            </label>
            <label>
              <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Missing data</span>
              <select
                value={filters.dataIssue}
                onChange={(event) => setFilters((current) => ({ ...current, dataIssue: event.target.value as ExtractionReviewFilters["dataIssue"] }))}
                className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-white"
              >
                <option value="ALL">All records</option>
                <option value="MISSING_QUANTITY">Missing / invalid quantity</option>
                <option value="MISSING_UNIT">Missing unit</option>
              </select>
            </label>
          </div>

          <div className="mt-5 flex flex-wrap gap-2 text-xs">
            <span className="rounded-full bg-[#EEF3F8] px-3 py-1.5 text-[#536078] dark:bg-[#111D33] dark:text-[#B8C4D8]">
              Showing {filteredEntities.length} of {entities.length}
            </span>
            <span className="rounded-full bg-[#159A6A]/10 px-3 py-1.5 text-[#159A6A] dark:text-emerald-300">Safe {priorityCounts.SAFE}</span>
            <span className="rounded-full bg-[#D98A16]/10 px-3 py-1.5 text-[#D98A16] dark:text-amber-300">Review {priorityCounts.REVIEW}</span>
            <span className="rounded-full bg-[#D84A4A]/10 px-3 py-1.5 text-[#D84A4A] dark:text-rose-300">Critical {priorityCounts.CRITICAL}</span>
          </div>
        </section>
      )}

      {entities.length === 0 ? (
        <section
          id="extraction-review-items"
          tabIndex={-1}
          className="rounded-[32px] border border-dashed border-[#D9E2EC] bg-white p-10 text-center focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#009FE3] dark:border-[#1E2A42] dark:bg-[#0B1426]"
        >
          <h3 className="text-xl font-semibold text-[#0B1630] dark:text-white">No extracted BOQ candidates are available yet.</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm text-[#536078] dark:text-[#B8C4D8]">
            Your source files remain available in the project. Review their real processing state before continuing; scanned or unsupported documents may not produce structured data.
          </p>
          <Link
            href={`/projects/${encodedProjectId}/files`}
            className="mt-6 inline-flex rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
          >
            Review Project Sources
          </Link>
        </section>
      ) : (
        <section
          id="extraction-review-items"
          tabIndex={-1}
          className="space-y-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#009FE3]"
          aria-label="Extracted candidates"
        >
          {filteredEntities.length === 0 && (
            <div className="rounded-[28px] border border-dashed border-[#D9E2EC] bg-white p-8 text-center dark:border-[#1E2A42] dark:bg-[#0B1426]">
              <p className="font-semibold text-[#0B1630] dark:text-white">No extracted candidates match these filters.</p>
              <button
                type="button"
                onClick={() => setFilters({ ...DEFAULT_EXTRACTION_REVIEW_FILTERS })}
                className="mt-3 text-sm font-semibold text-[#0077B6] dark:text-[#21C7F3]"
              >
                Clear filters
              </button>
            </div>
          )}
          {filteredEntities.map((entity) => {
            const sourceFile = sourceFiles.get(entity.projectFileId);
            const reviewable = isReviewableExtractionStatus(entity.status);
            const isBusy = pendingAction !== null;
            const reviewPriority = getExtractionReviewPriority(entity);
            const sourceHref = sourceFile
              ? `/projects/${encodedProjectId}/files?file=${encodeURIComponent(sourceFile.id)}`
              : null;

            return (
              <article key={entity.id} className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={entity.status} tone={EXTRACTION_STATUS_TONE[entity.status] ?? "default"} />
                      {reviewable && (
                        <span
                          className={
                            reviewPriority === "CRITICAL"
                            ? "rounded-full bg-[#D84A4A]/10 px-2.5 py-1 text-xs font-semibold text-[#D84A4A] dark:text-rose-300"
                            : reviewPriority === "REVIEW"
                              ? "rounded-full bg-[#D98A16]/10 px-2.5 py-1 text-xs font-semibold text-[#D98A16] dark:text-amber-300"
                              : "rounded-full bg-[#159A6A]/10 px-2.5 py-1 text-xs font-semibold text-[#159A6A] dark:text-emerald-300"
                        }
                      >
                          {reviewPriority === "CRITICAL" ? "Critical review" : reviewPriority === "REVIEW" ? "Review recommended" : "Safe candidate"}
                        </span>
                      )}
                      <span className="rounded-full border border-[#D9E2EC] bg-[#EEF3F8] px-2.5 py-1 text-xs font-medium text-[#536078] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#B8C4D8]">
                        {formatStatusLabel(entity.entityType)}
                      </span>
                    </div>
                    <h3 className="mt-3 break-words text-xl font-semibold text-[#0B1630] dark:text-white">{entity.label}</h3>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#536078] dark:text-[#B8C4D8]">
                      <p>Quantity: <span className="font-semibold text-[#0B1630] dark:text-white">{entity.quantity ?? "Not provided"}{entity.unit ? ` ${entity.unit}` : ""}</span></p>
                      <p>Confidence: <span className="font-semibold text-[#0B1630] dark:text-white">{formatConfidence(entity.confidence)}</span></p>
                      <p>Method: <span className="font-semibold text-[#0B1630] dark:text-white">{formatStatusLabel(entity.extractionMethod)}</span></p>
                    </div>
                  </div>
                  {sourceHref && (
                    <Link
                      href={sourceHref}
                      className="inline-flex shrink-0 justify-center rounded-2xl border border-[#009FE3] px-4 py-2 text-sm font-semibold text-[#0077B6] hover:bg-[#009FE3]/5 dark:border-[#21C7F3] dark:text-[#21C7F3] dark:hover:bg-[#21C7F3]/5"
                    >
                      Review Source
                    </Link>
                  )}
                </div>

                <div className="mt-5 grid gap-4 lg:grid-cols-2">
                  <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 dark:border-[#1E2A42] dark:bg-[#111D33]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">Source trace</p>
                    {sourceFile ? (
                      <>
                        <p className="mt-2 break-words text-sm font-semibold text-[#0B1630] dark:text-white">{sourceFile.originalName}</p>
                        <p className="mt-1 text-xs text-[#536078] dark:text-[#B8C4D8]">Source: {getProjectSourceOrigin(sourceFile.metadata)}</p>
                      </>
                    ) : (
                      <p className="mt-2 text-sm text-[#D98A16] dark:text-amber-300">Source unavailable in this project.</p>
                    )}
                  </div>
                  <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] p-4 dark:border-[#1E2A42] dark:bg-[#111D33]">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">Source text</p>
                    <p className="mt-2 whitespace-pre-wrap break-words text-sm text-[#536078] dark:text-[#B8C4D8]">
                      {entity.sourceText || "No source text was retained for this candidate."}
                    </p>
                  </div>
                </div>

                {entity.tableEvidence && entity.tableEvidence.length > 0 && (
                  <div className="mt-4 rounded-2xl border border-[#D9E2EC] bg-white p-4 dark:border-[#1E2A42] dark:bg-[#0B1426]">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">
                        Captured schedule fields
                      </p>
                      <span className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">
                        {entity.tableEvidence.length} source-linked field{entity.tableEvidence.length === 1 ? "" : "s"}
                      </span>
                    </div>
                    <dl className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                      {entity.tableEvidence.map((entry) => (
                        <div key={`${entry.fieldKey}:${entry.rawValue}`} className="rounded-xl border border-[#D9E2EC] bg-[#EEF3F8] p-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
                          <dt className="text-[0.68rem] font-semibold uppercase tracking-wide text-[#7B879C] dark:text-[#7F8DA6]">
                            {entry.fieldTitle}
                          </dt>
                          <dd className="mt-1 break-words text-sm font-semibold text-[#0B1630] dark:text-white">
                            {entry.rawValue}
                          </dd>
                        </div>
                      ))}
                    </dl>
                    <p className="mt-3 text-xs leading-5 text-[#7B879C] dark:text-[#8CA0BE]">
                      Captured source fields remain review evidence. Numeric-looking values are not automatically treated as BOQ quantities unless the source column explicitly means quantity.
                    </p>
                  </div>
                )}

                {entity.correction !== null && entity.correction !== undefined && (
                  <div className="mt-4"><CorrectionInformation correction={entity.correction} /></div>
                )}

                {reviewable && (
                  <div className="mt-5 border-t border-[#D9E2EC] pt-5 dark:border-[#1E2A42]">
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => void confirmEntity(entity.id)}
                        className="rounded-2xl bg-[#159A6A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {pendingAction?.entityId === entity.id && pendingAction.action === "confirm" ? "Confirming…" : "Confirm"}
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openCorrection(entity)}
                        className="rounded-2xl border border-[#009FE3] px-4 py-2 text-sm font-semibold text-[#0077B6] hover:bg-[#009FE3]/5 disabled:cursor-not-allowed disabled:opacity-50 dark:border-[#21C7F3] dark:text-[#21C7F3]"
                      >
                        Correct
                      </button>
                      <button
                        type="button"
                        disabled={isBusy}
                        onClick={() => openRejection(entity.id)}
                        className="rounded-2xl border border-[#D84A4A]/50 px-4 py-2 text-sm font-semibold text-[#D84A4A] hover:bg-[#D84A4A]/5 disabled:cursor-not-allowed disabled:opacity-50 dark:text-rose-300"
                      >
                        Reject
                      </button>
                    </div>

                    {correctingId === entity.id && (
                      <div className="mt-4 rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 p-5 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5">
                        <h4 className="text-sm font-semibold text-[#0B1630] dark:text-white">Correct extracted information</h4>
                        <div className="mt-4 grid gap-4 sm:grid-cols-3">
                          <label className="sm:col-span-3">
                            <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Label</span>
                            <input
                              value={correctionDraft.label}
                              maxLength={200}
                              onChange={(event) => setCorrectionDraft((current) => ({ ...current, label: event.target.value }))}
                              className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                            />
                          </label>
                          <label>
                            <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Quantity</span>
                            <input
                              type="number"
                              step="any"
                              value={correctionDraft.quantity}
                              onChange={(event) => setCorrectionDraft((current) => ({ ...current, quantity: event.target.value }))}
                              className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                            />
                          </label>
                          <label className="sm:col-span-2">
                            <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Unit</span>
                            <input
                              value={correctionDraft.unit}
                              maxLength={20}
                              onChange={(event) => setCorrectionDraft((current) => ({ ...current, unit: event.target.value }))}
                              className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                            />
                          </label>
                          <label className="sm:col-span-3">
                            <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Reason (required)</span>
                            <textarea
                              rows={3}
                              value={correctionDraft.reason}
                              maxLength={500}
                              onChange={(event) => setCorrectionDraft((current) => ({ ...current, reason: event.target.value }))}
                              className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                            />
                          </label>
                        </div>
                        {formError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{formError}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void submitCorrection(entity.id)}
                            className="rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#21C7F3] dark:text-[#040A16]"
                          >
                            {pendingAction?.entityId === entity.id && pendingAction.action === "correct" ? "Saving…" : "Save correction"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => { setCorrectingId(null); setFormError(null); }}
                            className="rounded-2xl border border-[#D9E2EC] px-4 py-2 text-sm font-semibold text-[#536078] dark:border-[#1E2A42] dark:text-[#B8C4D8]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {rejectingId === entity.id && (
                      <div className="mt-4 rounded-2xl border border-[#D84A4A]/30 bg-[#D84A4A]/5 p-5 dark:border-rose-400/20 dark:bg-rose-400/5">
                        <h4 className="text-sm font-semibold text-[#0B1630] dark:text-white">Reject extracted information</h4>
                        <label className="mt-4 block">
                          <span className="text-xs font-semibold text-[#536078] dark:text-[#B8C4D8]">Professional-review reason (required)</span>
                          <textarea
                            rows={3}
                            value={rejectionReason}
                            maxLength={500}
                            onChange={(event) => setRejectionReason(event.target.value)}
                            className="mt-1 w-full rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white"
                          />
                        </label>
                        {formError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{formError}</p>}
                        <div className="mt-4 flex flex-wrap gap-2">
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => void submitRejection(entity.id)}
                            className="rounded-2xl bg-[#D84A4A] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {pendingAction?.entityId === entity.id && pendingAction.action === "reject" ? "Rejecting…" : "Reject item"}
                          </button>
                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => { setRejectingId(null); setFormError(null); }}
                            className="rounded-2xl border border-[#D9E2EC] px-4 py-2 text-sm font-semibold text-[#536078] dark:border-[#1E2A42] dark:text-[#B8C4D8]"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </article>
            );
          })}
        </section>
      )}
    </div>
  );
}
