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
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#7F8DA6]">Extraction review</p>
        <h2 className="mt-2 text-3xl font-semibold text-[#0B1630] dark:text-white">Review extracted project information</h2>
        <p className="mt-3 max-w-3xl text-sm text-[#536078] dark:text-[#B8C4D8]">
          Quantara presents source-linked candidates for professional review. Nothing on this page is confirmed or added to a BOQ automatically.
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

        <div className="mt-6 flex flex-col gap-4 rounded-2xl border border-[#009FE3]/30 bg-[#009FE3]/5 p-5 dark:border-[#21C7F3]/30 dark:bg-[#21C7F3]/5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[#0077B6] dark:text-[#21C7F3]">What should I do next?</p>
            <p className="mt-2 text-sm font-medium text-[#0B1630] dark:text-white">
              {reviewSummary.total === 0
                ? "Review your project sources and process supported files to continue."
                : reviewSummary.needsAttention > 0
                  ? `Next step: Review the remaining ${reviewSummary.needsAttention} extracted ${reviewSummary.needsAttention === 1 ? "item" : "items"}.`
                  : "Extraction review complete. Continue to the BOQ workflow."}
            </p>
          </div>
          {(reviewSummary.total === 0 || reviewSummary.complete) && (
            <Link
              href={
                reviewSummary.complete
                  ? importableEntityCount > 0
                    ? `/projects/${encodedProjectId}/boq?action=import-reviewed`
                    : `/projects/${encodedProjectId}/boq`
                  : `/projects/${encodedProjectId}/files`
              }
              className="inline-flex shrink-0 justify-center rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
            >
              {reviewSummary.complete ? "Continue to BOQ" : "Review Project Sources"}
            </Link>
          )}
        </div>
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

      {entities.length === 0 ? (
        <section className="rounded-[32px] border border-dashed border-[#D9E2EC] bg-white p-10 text-center dark:border-[#1E2A42] dark:bg-[#0B1426]">
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
        <section className="space-y-4" aria-label="Extracted candidates">
          {entities.map((entity) => {
            const sourceFile = sourceFiles.get(entity.projectFileId);
            const reviewable = isReviewableExtractionStatus(entity.status);
            const isBusy = pendingAction !== null;
            const sourceHref = sourceFile
              ? `/projects/${encodedProjectId}/files?file=${encodeURIComponent(sourceFile.id)}`
              : null;

            return (
              <article key={entity.id} className="rounded-[28px] border border-[#D9E2EC] bg-white p-6 dark:border-[#1E2A42] dark:bg-[#0B1426]">
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <StatusBadge label={entity.status} tone={EXTRACTION_STATUS_TONE[entity.status] ?? "default"} />
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
