"use client";

import { put as putToBlob } from "@vercel/blob/client";
import { AlertTriangle, ArrowLeft, Check, Circle, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { use, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import {
  clearDrawingUploadResumeState,
  createDrawingUploadResumeHandle,
  isDrawingUploadCancelledError,
  uploadDrawingWithSafeRouting,
  type DrawingUploadAuthorization,
  type DrawingUploadResumeHandle,
} from "@/lib/drawings/upload-routing";
import SectionHeader from "@/components/dashboard/section-header";
import EmptyState from "@/components/dashboard/empty-state";
import LoadingSkeleton from "@/components/dashboard/loading-skeleton";
import ArchitecturalDrawingVisual from "@/components/visuals/architectural-drawing-visual";
import DrawingCard, { type DrawingView } from "@/components/drawings/drawing-card";
import {
  DRAWING_EXTENSIONS,
  DRAWING_UPLOAD_MAX_BYTES_DEFAULT,
  isDrawingExtensionPreviewable,
  type DrawingMetadataInput,
} from "@/lib/validation/drawing-schema";
import { emitOnboardingActionComplete } from "@/lib/onboarding/onboarding-state";
import { trackFirstConversionEvent } from "@/lib/marketing/conversion-events";
import {
  AUTONOMOUS_PREPARATION_STAGES,
  autonomousSourceSetChanged,
  deriveAutonomousPreparationUi,
} from "@/lib/autonomous-boq/workflow-ui";

type UploadStage = "preparing" | "uploading" | "finalizing" | "failed";

type ProjectView = { id: string; name: string; reference: string; industryId: string };

type PreparationStatus = {
  id: string;
  targetBoqId: string | null;
  sourceFileIds: string[];
  status: "QUEUED" | "RUNNING" | "NEEDS_INPUT" | "NEEDS_REVIEW" | "COMPLETED" | "FAILED" | "CANCELLED";
  stage: string;
  progressPercentage: number;
  readyForRates: boolean;
  retryable: boolean;
  exceptions: Array<{ code: string; message: string; sourceFileIds: string[]; pageIds: string[]; sourceSheets: string[]; discipline: string | null; workPackage: string | null }>;
  drawingMaturity: string[];
  payableEligibility: "PAYABLE_ELIGIBLE" | "NOT_PAYABLE_CONCEPT" | null;
  categoryStatus: "VERIFIED" | "REVIEW_REQUIRED" | null;
  conceptSchedule: { title: string; payable: false; metrics: Array<{ label: string; value: number; unit: string; sheetReference: string }>; alternatives: string[]; conflicts: Array<{ label: string; values: string[]; sheetReferences: string[] }> } | null;
  error: { code: string | null; message: string | null } | null;
  updatedAt: string;
};

type RecoverableDrawingUpload = {
  uploadId: string;
  drawingId: string;
  workflowId: string | null;
  originalName: string;
  declaredMimeType: string;
  declaredByteSize: number;
  revision: string | null;
  state: "AUTHORIZED" | "BLOB_UPLOADED" | "FINALIZING" | "DRAWING_CREATED" | "JOB_QUEUED" | "EXPIRED";
  expiresAt: string;
  updatedAt: string;
  canResumeFinalization: boolean;
};

function preparationStageLabel(stage: string): string {
  return ({
    QUEUED: "Queued",
    SOURCE_VALIDATION: "Checking drawings",
    SOURCE_PROCESSING: "Reading all drawings",
    CATEGORIZING: "Detecting dimensions, schedules and categories",
    SOURCE_INPUT_REQUIRED: "Drawing input required",
    MEASURING: "Calculating quantities",
    ASSEMBLING_BOQ: "Structuring the BOQ",
    ASSEMBLY_PENDING: "BOQ assembly pending",
    READY_FOR_RATES: "BOQ ready for rates",
    NEEDS_REVIEW: "Review required",
    FAILED: "Preparation failed",
    CANCELLED: "Preparation cancelled",
  } as Record<string, string>)[stage] ?? "Preparing BOQ";
}

const panel = "rounded-[28px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 sm:p-8";
const EMPTY_METADATA: DrawingMetadataInput = {};

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

/** Local-development fallback for an intentionally unconfigured Blob provider. Production never routes drawing bytes through this application endpoint. */
function uploadDrawingViaLegacyRoute(
  url: string,
  file: File,
  metadata: DrawingMetadataInput,
  onProgress: (percent: number) => void,
): Promise<{ status: number; body: unknown }> {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.set("file", file);
    for (const [key, value] of Object.entries(metadata)) {
      if (value) formData.set(key, value);
    }
    const xhr = new XMLHttpRequest();
    xhr.open("POST", url);
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(Math.round((event.loaded / event.total) * 100));
    };
    xhr.onload = () => {
      let body: unknown = null;
      try {
        body = JSON.parse(xhr.responseText);
      } catch {
        body = null;
      }
      resolve({ status: xhr.status, body });
    };
    xhr.onerror = () => reject(new Error("The upload could not be completed. Check your connection and try again."));
    xhr.send(formData);
  });
}

export default function ProjectDrawingsPage(props: { params: Promise<{ projectId: string }> }) {
  const params = use(props.params);
  const router = useRouter();
  const [project, setProject] = useState<ProjectView | null>(null);
  const [drawings, setDrawings] = useState<DrawingView[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [recoverableUploads, setRecoverableUploads] = useState<RecoverableDrawingUpload[]>([]);
  const [resumingUploadId, setResumingUploadId] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [uploadStage, setUploadStage] = useState<UploadStage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // The scoped token and transfer checkpoint live only in this component's
  // memory. They are intentionally never serialized or persisted.
  const uploadResumeRef = useRef<DrawingUploadResumeHandle>(createDrawingUploadResumeHandle());
  const uploadInFlightRef = useRef(false);

  const [previewDrawing, setPreviewDrawing] = useState<DrawingView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [preparation, setPreparation] = useState<PreparationStatus | null>(null);
  const [preparationAction, setPreparationAction] = useState<"start" | "retry" | null>(null);
  const preparedEventRef = useRef<string | null>(null);
  const readyRedirectRef = useRef<string | null>(null);

  const downloadConceptSchedule = useCallback(() => {
    if (!preparation?.conceptSchedule) return;
    const rows = [
      ["Schedule", preparation.conceptSchedule.title, "", ""],
      ["Metric", "Value", "Unit", "Drawing/sheet"],
      ...preparation.conceptSchedule.metrics.map((metric) => [metric.label, String(metric.value), metric.unit, metric.sheetReference]),
    ];
    const csv = rows.map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(",")).join("\r\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = "preliminary-concept-quantity-schedule.csv";
    link.click();
    URL.revokeObjectURL(url);
  }, [preparation]);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [projectData, drawingsData, preparationData, recoverableUploadData] = await Promise.all([
        apiClient.get<ProjectView>(`/api/projects/${encodeURIComponent(params.projectId)}`, signal),
        apiClient.get<DrawingView[]>(`/api/projects/${encodeURIComponent(params.projectId)}/drawings`, signal),
        apiClient.get<PreparationStatus | null>(`/api/projects/${encodeURIComponent(params.projectId)}/boq-preparation`, signal),
        apiClient.get<RecoverableDrawingUpload[]>(`/api/projects/${encodeURIComponent(params.projectId)}/drawings/upload-authorization`, signal),
      ]);
      setProject(projectData);
      setDrawings(drawingsData);
      setPreparation(preparationData);
      setRecoverableUploads(recoverableUploadData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.projectId]);

  const resumeUploadFinalization = useCallback(async (upload: RecoverableDrawingUpload) => {
    if (!upload.canResumeFinalization || resumingUploadId) return;
    setResumingUploadId(upload.uploadId);
    setUploadError(null);
    try {
      await apiClient.post(
        `/api/projects/${encodeURIComponent(params.projectId)}/drawings/upload-authorization/${encodeURIComponent(upload.uploadId)}/finalize`,
        { metadata: {} },
      );
      await load();
    } catch (error) {
      setUploadError(getApiErrorMessage(error));
    } finally {
      setResumingUploadId(null);
    }
  }, [load, params.projectId, resumingUploadId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  useEffect(() => {
    if (!preparation || !["QUEUED", "RUNNING"].includes(preparation.status)) return;
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      apiClient.get<PreparationStatus | null>(
        `/api/projects/${encodeURIComponent(params.projectId)}/boq-preparation`,
        controller.signal,
      ).then(setPreparation).catch((error) => {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setActionError(getApiErrorMessage(error));
      });
    }, 2500);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [params.projectId, preparation]);

  useEffect(() => {
    if (!preparation?.readyForRates || preparedEventRef.current === preparation.id) return;
    preparedEventRef.current = preparation.id;
    emitOnboardingActionComplete("BOQ_PREPARED", { projectId: params.projectId });
    trackFirstConversionEvent("first_boq_created", { source: "autonomous_drawing_preparation" });
  }, [params.projectId, preparation]);

  useEffect(() => {
    if (!preparation?.readyForRates || readyRedirectRef.current === preparation.id) return;
    readyRedirectRef.current = preparation.id;
    router.replace(`/projects/${encodeURIComponent(params.projectId)}/boq?mode=rates&preparationId=${encodeURIComponent(preparation.id)}`);
  }, [params.projectId, preparation, router]);

  const preparationUi = useMemo(() => deriveAutonomousPreparationUi({
    drawingCount: drawings?.length ?? 0,
    uploadActive: uploadStage === "preparing" || uploadStage === "uploading" || uploadStage === "finalizing",
    preparation,
  }), [drawings?.length, preparation, uploadStage]);
  const hasNewDrawingSet = Boolean(preparation && autonomousSourceSetChanged(
    drawings?.map((drawing) => drawing.id) ?? [],
    preparation.sourceFileIds,
  ));

  const startPreparation = useCallback(async () => {
    if (!drawings?.length || preparationAction) return;
    setPreparationAction("start");
    setActionError(null);
    try {
      const status = await apiClient.post<PreparationStatus>(
        `/api/projects/${encodeURIComponent(params.projectId)}/boq-preparation`,
        { sourceFileIds: drawings.map((drawing) => drawing.id) },
      );
      setPreparation(status);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setPreparationAction(null);
    }
  }, [drawings, params.projectId, preparationAction]);

  const retryPreparation = useCallback(async () => {
    if (!preparation?.retryable || preparationAction) return;
    setPreparationAction("retry");
    setActionError(null);
    try {
      const status = await apiClient.post<PreparationStatus>(
        `/api/projects/${encodeURIComponent(params.projectId)}/boq-preparation/${encodeURIComponent(preparation.id)}/retry`,
        {},
      );
      setPreparation(status);
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setPreparationAction(null);
    }
  }, [params.projectId, preparation, preparationAction]);

  const stageFile = useCallback((file: File) => {
    setValidationError(null);
    setUploadError(null);
    const extension = getExtension(file.name);
    if (!extension || !DRAWING_EXTENSIONS.includes(extension as (typeof DRAWING_EXTENSIONS)[number])) {
      setValidationError(`".${extension || "?"}" is not a supported drawing format. Supported: ${DRAWING_EXTENSIONS.join(", ")}.`);
      return;
    }
    if (file.size > DRAWING_UPLOAD_MAX_BYTES_DEFAULT) {
      setValidationError(`This file is larger than the ${Math.floor(DRAWING_UPLOAD_MAX_BYTES_DEFAULT / (1024 * 1024))}MB upload limit.`);
      return;
    }
    if (file.size === 0) {
      setValidationError("This file is empty.");
      return;
    }
    clearDrawingUploadResumeState(uploadResumeRef.current);
    setStagedFile(file);
  }, []);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) stageFile(file);
  }

  async function submitUpload() {
    if (!stagedFile || uploadInFlightRef.current) return;
    uploadInFlightRef.current = true;
    setUploadError(null);
    setUploadProgress(0);
    try {
      const encodedProjectId = encodeURIComponent(params.projectId);
      await uploadDrawingWithSafeRouting(
        {
          file: stagedFile,
          metadata: EMPTY_METADATA,
          isProduction: process.env.NODE_ENV === "production",
          onStage: setUploadStage,
          onProgress: setUploadProgress,
        },
        {
          authorize: (declaration) => apiClient.post<DrawingUploadAuthorization>(
            `/api/projects/${encodedProjectId}/drawings/upload-authorization`,
            declaration,
          ),
          transferToPrivateBlob: async (transfer) => {
            await putToBlob(transfer.pathname, transfer.file, {
              access: transfer.access,
              token: transfer.token,
              contentType: transfer.contentType,
              multipart: transfer.multipart,
              onUploadProgress: (event) => transfer.onProgress(Math.round(event.percentage)),
            });
          },
          finalize: (input) => apiClient.post(
            `/api/projects/${encodedProjectId}/drawings/upload-authorization/${input.sessionId}/finalize`,
            { metadata: input.metadata },
          ),
          bufferedUpload: async (input) => {
            const response = await uploadDrawingViaLegacyRoute(
              `/api/projects/${encodedProjectId}/drawings`,
              input.file,
              input.metadata,
              input.onProgress,
            );
            const body = response.body as { ok?: boolean; error?: { message?: string } } | null;
            if (response.status < 200 || response.status >= 300 || !body?.ok) {
              throw new Error(body?.error?.message ?? "The upload could not be completed.");
            }
          },
          getErrorMessage: getApiErrorMessage,
        },
        uploadResumeRef.current,
      );

      setStagedFile(null);
      setUploadStage(null);
      setUploadProgress(null);
      await load();
    } catch (error) {
      if (isDrawingUploadCancelledError(error)) return;
      setUploadError(getApiErrorMessage(error));
      setUploadStage("failed");
      setUploadProgress(null);
    } finally {
      uploadInFlightRef.current = false;
    }
  }

  function cancelStagedUpload() {
    clearDrawingUploadResumeState(uploadResumeRef.current);
    setStagedFile(null);
    setUploadStage(null);
    setUploadProgress(null);
    setUploadError(null);
  }

  async function handleArchive(drawingId: string) {
    if (!window.confirm("Archive this drawing? It will leave the active list, while its source file and review evidence are retained.")) return;
    setActionError(null);
    try {
      await apiClient.delete(`/api/drawings/${drawingId}`);
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    }
  }

  if (isLoading) {
    return (
      <div className={panel}>
        <LoadingSkeleton rows={5} />
      </div>
    );
  }

  if (loadError || !project) {
    return (
      <div className={panel}>
        <p className="text-lg font-semibold text-[#08152E] dark:text-white">Drawings unavailable</p>
        <p className="mt-2 text-sm text-[#D84A4A] dark:text-rose-300">{loadError ?? "This project could not be loaded."}</p>
        <button type="button" onClick={() => void load()} className="mt-6 rounded-2xl border border-[#009FE3] bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#21C7F3] dark:bg-[#21C7F3] dark:text-[#040A16]">
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 1. Drawing intake hero */}
      <div className={panel}>
        <Link href={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#0077B6] hover:underline dark:text-[#21C7F3]">
          <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
          Back to {project.name}
        </Link>
        <p className="mt-3 text-xs uppercase tracking-[0.28em] text-[#7B879C] dark:text-[#8CA0BE]">{project.reference} · Drawing intake</p>
        <h1 className="mt-1 text-3xl font-semibold text-[#08152E] dark:text-white">Project Drawings</h1>
        <p className="mt-2 max-w-2xl text-sm text-[#536078] dark:text-[#8CA0BE]">
          Upload one or more project drawings. Quantara will analyse the selected industry scope, reconcile the drawing set, and prepare a measured BOQ for unit rates.
        </p>
      </div>

      {/* 2-7. Upload zone, browse action, format/size disclosure, progress, validation feedback, failed-upload recovery */}
      <div id="drawing-upload" className={panel}>
        <SectionHeader title="Upload a drawing" description={`Supported: ${DRAWING_EXTENSIONS.join(", ")} · Maximum ${Math.floor(DRAWING_UPLOAD_MAX_BYTES_DEFAULT / (1024 * 1024))}MB per file`} />

        {!stagedFile ? (
          <div
            role="button"
            tabIndex={0}
            onClick={() => fileInputRef.current?.click()}
            onKeyDown={(event) => (event.key === "Enter" || event.key === " ") && fileInputRef.current?.click()}
            onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleDrop}
            className={`mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#009FE3] ${
              isDragging ? "border-[#009FE3] bg-[#009FE3]/5 dark:border-[#21C7F3] dark:bg-[#21C7F3]/5" : "border-[#D5E0EC] dark:border-[#20304D]"
            }`}
          >
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[#009FE3]/40 bg-[#009FE3]/10 dark:border-[#21C7F3]/40 dark:bg-[#21C7F3]/10">
              <Upload className="h-5 w-5 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
            </span>
            <p className="text-sm font-semibold text-[#08152E] dark:text-white">Drag and drop a drawing here, or click to browse</p>
            <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">{DRAWING_EXTENSIONS.join(", ")} · up to {Math.floor(DRAWING_UPLOAD_MAX_BYTES_DEFAULT / (1024 * 1024))}MB</p>
            <input
              ref={fileInputRef}
              type="file"
              aria-label="Choose drawing file"
              className="hidden"
              accept={DRAWING_EXTENSIONS.map((ext) => `.${ext}`).join(",")}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) stageFile(file);
                event.target.value = "";
              }}
            />
          </div>
        ) : (
          <div className="mt-4 rounded-2xl border border-[#D5E0EC] bg-[#EAF1F8] p-5 dark:border-[#20304D] dark:bg-[#101D34]">
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-[#08152E] dark:text-white">{stagedFile.name}</p>
                <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">{(stagedFile.size / 1024).toFixed(0)} KB</p>
              </div>
              {uploadStage === null && (
                <button type="button" onClick={cancelStagedUpload} aria-label="Remove staged file" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D5E0EC] text-[#536078] hover:bg-white dark:border-[#20304D] dark:text-[#8CA0BE] dark:hover:bg-[#091326]">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <p className="mt-4 rounded-xl border border-[#009FE3]/20 bg-white/70 px-4 py-3 text-sm text-[#536078] dark:border-[#21C7F3]/20 dark:bg-[#091326]/70 dark:text-[#8CA0BE]">
              Quantara reads title blocks, legends, schedules, symbols, annotations and drawing relationships automatically. No discipline, drawing type, dimensions or quantities are required here.
            </p>

            {(uploadStage === "preparing" || uploadStage === "uploading" || uploadStage === "finalizing") && (
              <div className="mt-4">
                {uploadStage === "uploading" && uploadProgress !== null ? (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#D5E0EC] dark:bg-[#20304D]" role="img" aria-label={`Upload progress: ${uploadProgress}%`}>
                    <span className="block h-full rounded-full bg-[#009FE3] transition-[width] dark:bg-[#21C7F3]" style={{ width: `${uploadProgress}%` }} />
                  </div>
                ) : (
                  <div className="h-2 w-full overflow-hidden rounded-full bg-[#D5E0EC] dark:bg-[#20304D]">
                    <span className="block h-full w-1/3 animate-pulse rounded-full bg-[#009FE3] dark:bg-[#21C7F3]" />
                  </div>
                )}
                <p className="mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">
                  {uploadStage === "preparing" && "Preparing…"}
                  {uploadStage === "uploading" && `Uploading… ${uploadProgress ?? 0}%`}
                  {uploadStage === "finalizing" && "Finalizing…"}
                </p>
                <button type="button" onClick={cancelStagedUpload} className="mt-2 text-xs font-semibold text-[#536078] underline dark:text-[#8CA0BE]">Cancel</button>
              </div>
            )}

            {uploadStage === "failed" && uploadError && (
              <div className="mt-4 rounded-xl border border-[#D84A4A]/30 bg-[#D84A4A]/5 px-4 py-3 text-sm text-[#D84A4A] dark:border-rose-900 dark:bg-rose-950/20 dark:text-rose-300">
                <p className="font-semibold">Failed</p>
                <p className="mt-1">{uploadError}</p>
                <div className="mt-2 flex gap-3">
                  <button type="button" onClick={() => void submitUpload()} className="text-xs font-semibold underline">Retry</button>
                  <button type="button" onClick={cancelStagedUpload} className="text-xs font-semibold underline">Cancel</button>
                </div>
              </div>
            )}

            {uploadStage === null && (
              <div className="mt-4 flex gap-2">
                <button type="button" onClick={() => void submitUpload()} className="rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]">
                  Upload drawing
                </button>
                <button type="button" onClick={cancelStagedUpload} className="rounded-2xl border border-[#D5E0EC] bg-white px-4 py-2 text-sm font-semibold text-[#08152E] hover:bg-[#EAF1F8] dark:border-[#20304D] dark:bg-[#091326] dark:text-white dark:hover:bg-[#101D34]">
                  Cancel
                </button>
              </div>
            )}
          </div>
        )}

        {validationError && (
          <div className="mt-4 flex items-start gap-2 rounded-xl border border-[#D98A16]/30 bg-[#D98A16]/5 px-4 py-3 text-sm text-[#D98A16] dark:border-amber-900 dark:bg-amber-950/20 dark:text-amber-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>{validationError}</p>
          </div>
        )}
      </div>

      {recoverableUploads.some((upload) => upload.state !== "JOB_QUEUED") ? (
        <div className={panel} aria-live="polite">
          <SectionHeader
            title="Incomplete drawing uploads"
            description="Quantara found server-owned upload records from an earlier browser session. Uploaded Blob files can be finalized without selecting or uploading them again."
          />
          <ul className="mt-4 space-y-3">
            {recoverableUploads.filter((upload) => upload.state !== "JOB_QUEUED").map((upload) => (
              <li key={upload.uploadId} className="flex flex-col gap-3 rounded-2xl border border-[#D5E0EC] p-4 dark:border-[#20304D] sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-[#08152E] dark:text-white">{upload.originalName}</p>
                  <p className="mt-1 text-xs text-[#7B879C] dark:text-[#8CA0BE]">
                    {upload.state === "EXPIRED"
                      ? "The authorized upload expired and no Blob object was found."
                      : upload.state === "AUTHORIZED"
                        ? "Authorization exists, but the Blob upload has not completed."
                        : `Recovery state: ${upload.state.replace(/_/g, " ").toLocaleLowerCase()}.`}
                  </p>
                </div>
                {upload.canResumeFinalization ? (
                  <button
                    type="button"
                    onClick={() => void resumeUploadFinalization(upload)}
                    disabled={resumingUploadId !== null}
                    className="shrink-0 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#21C7F3] dark:text-[#040A16]"
                  >
                    {resumingUploadId === upload.uploadId ? "Finalizing…" : "Resume upload finalization"}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
          {uploadError ? <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300" role="alert">{uploadError}</p> : null}
        </div>
      ) : null}

      {/* Autonomous preparation is explicit so a multi-file drawing set can be uploaded first. */}
      <div className="rounded-[28px] border border-[#009FE3]/30 dark:border-[#21C7F3]/30 bg-[#009FE3]/[0.04] dark:bg-[#21C7F3]/[0.06] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0 flex-1">
            <ol className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6" aria-label="BOQ preparation progress">
              {AUTONOMOUS_PREPARATION_STAGES.map((stage, index) => {
                const complete = index < preparationUi.activeStageIndex || preparationUi.state === "ready";
                const current = index === preparationUi.activeStageIndex && preparationUi.state !== "ready";
                return (
                  <li key={stage.id} aria-current={current ? "step" : undefined} className={`rounded-xl border px-3 py-2 text-xs ${complete ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-200" : current ? "border-[#009FE3]/50 bg-[#009FE3]/10 text-[#0077B6] dark:text-[#21C7F3]" : "border-[#D5E0EC] text-[#7B879C] dark:border-[#20304D] dark:text-[#7F8DA6]"}`}>
                    <span className="flex items-center gap-2">
                      {complete ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : <Circle className="h-3.5 w-3.5" aria-hidden="true" />}
                      {stage.label}
                    </span>
                  </li>
                );
              })}
            </ol>
            <div className="mt-4 flex items-start gap-3">
            <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
            <div className="text-sm text-[#536078] dark:text-[#8CA0BE]" aria-live="polite">
              <p className="font-semibold text-[#08152E] dark:text-white">
                {preparation ? preparationStageLabel(preparation.stage) : "Let Quantara prepare the BOQ"}
              </p>
              <p className="mt-1">
                {preparation?.readyForRates
                  ? "Scope, descriptions, units and quantities are complete. Add only the unit rates to finish the priced BOQ."
                  : preparation && ["QUEUED", "RUNNING"].includes(preparation.status)
                    ? `Quantara is processing the frozen drawing set (${Math.max(0, Math.min(100, preparation.progressPercentage))}%). You may leave this page and return without losing the job.`
                    : drawings?.length
                      ? "Start one durable preparation across the uploaded active drawings. Quantara will identify any specific missing evidence."
                      : "Upload project drawings, then let Quantara categorize and measure the supported evidence."}
              </p>
              {preparation?.payableEligibility === "NOT_PAYABLE_CONCEPT" ? (
                <div className="mt-3 rounded-xl border border-[#D98A16]/40 bg-[#D98A16]/10 p-3" role="status">
                  <p className="font-semibold text-[#9A5B00] dark:text-amber-200">Concept / Basis of Design — not eligible for contract or payment</p>
                  <p className="mt-1 text-xs">Recognizable categories remain verified, but payable verification and lock require coordinated Tender or IFC drawings.</p>
                </div>
              ) : null}
              {preparation?.exceptions.length ? (
                <ul className="mt-3 space-y-2 text-[#D98A16] dark:text-amber-300">
                  {preparation.exceptions.map((exception) => (
                    <li key={`${exception.code}-${exception.discipline ?? "all"}-${exception.workPackage ?? "all"}`} className="rounded-xl border border-[#D98A16]/30 bg-[#D98A16]/5 p-3">
                      <p className="font-semibold">{exception.code.replace(/_/g, " ")}</p>
                      <p className="mt-1 text-xs">{exception.message}</p>
                      <p className="mt-1 text-xs">Affected sheets: {exception.sourceSheets.length > 0 ? exception.sourceSheets.join(", ") : exception.pageIds.length > 0 ? `${exception.pageIds.length} referenced page(s)` : `${exception.sourceFileIds.length} referenced drawing(s)`}</p>
                    </li>
                  ))}
                </ul>
              ) : null}
              {preparation?.conceptSchedule ? (
                <div className="mt-3 rounded-xl border border-[#D5E0EC] bg-white/70 p-3 dark:border-[#20304D] dark:bg-[#091326]/70">
                  <p className="font-semibold text-[#08152E] dark:text-white">{preparation.conceptSchedule.title}</p>
                  {preparation.conceptSchedule.metrics.length > 0 ? (
                    <ul className="mt-2 grid gap-1 text-xs sm:grid-cols-2">
                      {preparation.conceptSchedule.metrics.map((metric) => <li key={`${metric.label}-${metric.value}-${metric.sheetReference}`}>{metric.label}: {metric.value} {metric.unit} — {metric.sheetReference}</li>)}
                    </ul>
                  ) : <p className="mt-2 text-xs">No explicit reconciled concept metrics were found.</p>}
                  {preparation.conceptSchedule.alternatives.length > 0 ? <p className="mt-2 text-xs">Preserved alternatives: {preparation.conceptSchedule.alternatives.join(", ")}. No governing scheme was selected.</p> : null}
                  {preparation.conceptSchedule.conflicts.length > 0 ? <p className="mt-2 text-xs text-[#D98A16]">Conflicting printed values remain for engineering review.</p> : null}
                  <button type="button" onClick={downloadConceptSchedule} className="mt-3 rounded-xl border border-[#D5E0EC] px-3 py-2 text-xs font-semibold text-[#08152E] dark:border-[#20304D] dark:text-white">Download preliminary schedule</button>
                </div>
              ) : null}
              {preparation?.error?.message ? (
                <p className="mt-3 text-[#D84A4A] dark:text-rose-300" role="alert">{preparation.error.message}</p>
              ) : null}
            </div>
            </div>
          </div>
          <div className="flex shrink-0 flex-wrap gap-2">
            {preparation?.readyForRates ? (
              <Link
                href={`/projects/${encodeURIComponent(project.id)}/boq?mode=rates&preparationId=${encodeURIComponent(preparation.id)}`}
                className="inline-flex items-center justify-center rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
              >
                Add unit rates
              </Link>
            ) : hasNewDrawingSet && preparation && !["QUEUED", "RUNNING", "COMPLETED"].includes(preparation.status) ? (
              <button
                type="button"
                onClick={() => void startPreparation()}
                disabled={!drawings?.length || preparationAction !== null}
                className="rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#21C7F3] dark:text-[#040A16]"
              >
                {preparationAction === "start" ? "Starting…" : "Generate BOQ from Drawings"}
              </button>
            ) : preparation?.retryable ? (
              <button
                type="button"
                onClick={() => void retryPreparation()}
                disabled={preparationAction !== null}
                className="rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:bg-[#21C7F3] dark:text-[#040A16]"
              >
                {preparationAction === "retry" ? "Retrying…" : "Retry failed scopes"}
              </button>
            ) : preparation && ["NEEDS_INPUT", "NEEDS_REVIEW", "FAILED", "CANCELLED"].includes(preparation.status) ? (
              <>
                <a
                  href="#drawing-upload"
                  className="inline-flex items-center justify-center rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
                >
                  Upload coordinated drawings
                </a>
                <Link
                  href={`/projects/${encodeURIComponent(project.id)}/${project.industryId === "joinery" ? "joinery" : "extractions"}`}
                  className="inline-flex items-center justify-center rounded-2xl border border-[#D98A16]/60 px-4 py-2 text-sm font-semibold text-[#9A5B00] hover:bg-[#D98A16]/10 dark:text-amber-200"
                >
                  Engineering review
                </Link>
              </>
            ) : (
              <button
                type="button"
                onClick={() => void startPreparation()}
                disabled={!drawings?.length || preparationAction !== null || Boolean(preparation && ["QUEUED", "RUNNING"].includes(preparation.status))}
                className="rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-[#21C7F3] dark:text-[#040A16]"
              >
                {preparationAction === "start" ? "Starting…" : "Generate BOQ from Drawings"}
              </button>
            )}
            <Link
              href={`/projects/${encodeURIComponent(project.id)}/files`}
              className="inline-flex items-center justify-center rounded-2xl border border-[#D5E0EC] px-4 py-2 text-sm font-semibold text-[#08152E] hover:bg-white dark:border-[#20304D] dark:text-white dark:hover:bg-[#101D34]"
            >
              Source details
            </Link>
          </div>
        </div>
      </div>

      {/* 8-9-10. Recent drawings, status, preview/download/archive */}
      <div className={panel}>
        <SectionHeader title="Recent drawings" description="Uploaded drawings for this project, newest first." />
        {actionError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{actionError}</p>}

        {/* 11. Empty state */}
        {drawings && drawings.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-2xl border border-dashed border-[#D5E0EC] px-6 py-12 text-center dark:border-[#20304D]">
            <div className="h-28 w-40 text-[#0077B6] dark:text-[#21C7F3]">
              <ArchitecturalDrawingVisual className="h-full w-full" />
            </div>
            <p className="mt-4 text-base font-semibold text-[#08152E] dark:text-white">Upload your first drawing</p>
            <p className="mt-1 max-w-md text-sm text-[#536078] dark:text-[#8CA0BE]">
              PDF, PNG, JPG, TIFF, DWG, DXF, IFC, RVT, or ZIP — up to {Math.floor(DRAWING_UPLOAD_MAX_BYTES_DEFAULT / (1024 * 1024))}MB. Once uploaded, it flows into the rest of the workspace.
            </p>
            <div className="mt-4 flex items-center gap-2 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
              <span className="rounded-full border border-[#D5E0EC] px-2.5 py-1 dark:border-[#20304D]">Upload</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-full border border-[#D5E0EC] px-2.5 py-1 dark:border-[#20304D]">Review</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-full border border-[#D5E0EC] px-2.5 py-1 dark:border-[#20304D]">BOQ</span>
              <span aria-hidden="true">→</span>
              <span className="rounded-full border border-[#D5E0EC] px-2.5 py-1 dark:border-[#20304D]">Document</span>
            </div>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="mt-5 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]"
            >
              Upload a drawing
            </button>
          </div>
        ) : !drawings ? (
          <LoadingSkeleton rows={4} />
        ) : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {drawings.map((drawing) => (
              <DrawingCard key={drawing.id} drawing={drawing} onPreview={() => setPreviewDrawing(drawing)} onArchive={() => void handleArchive(drawing.id)} />
            ))}
          </div>
        )}
      </div>

      {previewDrawing && (
        <div role="dialog" aria-modal="true" aria-label={`Preview: ${previewDrawing.originalName}`} className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-[28px] border border-[#D5E0EC] bg-white dark:border-[#20304D] dark:bg-[#091326]">
            <div className="flex items-center justify-between border-b border-[#D5E0EC] px-6 py-4 dark:border-[#20304D]">
              <div className="min-w-0">
                <p className="truncate text-lg font-semibold text-[#08152E] dark:text-white">{previewDrawing.drawingTitle || previewDrawing.originalName}</p>
                <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">{previewDrawing.originalName}</p>
              </div>
              <button type="button" onClick={() => setPreviewDrawing(null)} aria-label="Close preview" className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#D5E0EC] text-[#536078] hover:bg-[#EAF1F8] dark:border-[#20304D] dark:text-[#8CA0BE] dark:hover:bg-[#101D34]">
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-auto bg-[#EAF1F8] dark:bg-[#040A16]">
              {isDrawingExtensionPreviewable(previewDrawing.extension) ? (
                previewDrawing.extension === "pdf" ? (
                  <iframe src={`/api/files/${previewDrawing.id}/download?disposition=inline`} title={`Preview of ${previewDrawing.originalName}`} className="h-[70vh] w-full" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={`/api/files/${previewDrawing.id}/download?disposition=inline`} alt={previewDrawing.drawingTitle || previewDrawing.originalName} className="mx-auto max-h-[70vh] w-auto object-contain" />
                )
              ) : (
                <div className="flex h-[40vh] flex-col items-center justify-center gap-2 text-center">
                  <p className="text-sm font-semibold text-[#08152E] dark:text-white">Preview not available for .{previewDrawing.extension.toUpperCase()} files</p>
                  <p className="text-xs text-[#7B879C] dark:text-[#8CA0BE]">AI analysis not configured. Download to view this file.</p>
                  <a href={`/api/files/${previewDrawing.id}/download`} className="mt-3 rounded-2xl bg-[#009FE3] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:bg-[#21C7F3] dark:text-[#040A16]">
                    Download
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
