"use client";

import { put as putToBlob } from "@vercel/blob/client";
import { AlertTriangle, ArrowLeft, Sparkles, Upload, X } from "lucide-react";
import Link from "next/link";
import { use, useCallback, useEffect, useRef, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { shouldFallBackToBufferedUpload } from "@/lib/drawings/upload-routing";
import SectionHeader from "@/components/dashboard/section-header";
import EmptyState from "@/components/dashboard/empty-state";
import LoadingSkeleton from "@/components/dashboard/loading-skeleton";
import ArchitecturalDrawingVisual from "@/components/visuals/architectural-drawing-visual";
import DrawingCard, { type DrawingView } from "@/components/drawings/drawing-card";
import {
  DRAWING_DISCIPLINES,
  DRAWING_EXTENSIONS,
  DRAWING_UPLOAD_MAX_BYTES_DEFAULT,
  DRAWING_TYPES,
  isDrawingExtensionPreviewable,
  type DrawingMetadataInput,
} from "@/lib/validation/drawing-schema";

type UploadStage = "preparing" | "uploading" | "finalizing" | "failed";

type ProjectView = { id: string; name: string; reference: string };

const panel = "rounded-[28px] border border-[#D5E0EC] dark:border-[#20304D] bg-white dark:bg-[#091326] p-6 sm:p-8";
const inputClass =
  "mt-1 w-full rounded-xl border border-[#D5E0EC] bg-[#EAF1F8] px-3 py-2 text-sm text-[#08152E] outline-none focus:border-[#009FE3] dark:border-[#20304D] dark:bg-[#101D34] dark:text-white dark:focus:border-[#21C7F3]";
const labelClass = "block text-xs font-medium text-[#536078] dark:text-[#8CA0BE]";

const EMPTY_METADATA: DrawingMetadataInput = {};

function formatLabel(value: string): string {
  return value.replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function getExtension(fileName: string): string {
  const parts = fileName.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

type AuthorizeUploadResponse = {
  sessionId: string;
  uploadToken: string;
  pathname: string;
  maxSizeBytes: number;
  expiresAt: string;
};

/** Server-buffered fallback path — only reachable in development when STORAGE_PROVIDER isn't vercel-blob (local dev without a Blob token). Never used in production: PDF bytes must never pass through a Vercel Function there. */
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
  const [project, setProject] = useState<ProjectView | null>(null);
  const [drawings, setDrawings] = useState<DrawingView[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [stagedFile, setStagedFile] = useState<File | null>(null);
  const [metadata, setMetadata] = useState<DrawingMetadataInput>(EMPTY_METADATA);
  const [uploadStage, setUploadStage] = useState<UploadStage | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [previewDrawing, setPreviewDrawing] = useState<DrawingView | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [projectData, drawingsData] = await Promise.all([
        apiClient.get<ProjectView>(`/api/projects/${encodeURIComponent(params.projectId)}`, signal),
        apiClient.get<DrawingView[]>(`/api/projects/${encodeURIComponent(params.projectId)}/drawings`, signal),
      ]);
      setProject(projectData);
      setDrawings(drawingsData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

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
    setStagedFile(file);
    setMetadata(EMPTY_METADATA);
  }, []);

  function handleDrop(event: React.DragEvent<HTMLDivElement>) {
    event.preventDefault();
    setIsDragging(false);
    const file = event.dataTransfer.files?.[0];
    if (file) stageFile(file);
  }

  async function submitUpload() {
    if (!stagedFile) return;
    setUploadError(null);
    setUploadStage("preparing");
    setUploadProgress(0);
    try {
      const authorization = await apiClient.post<AuthorizeUploadResponse | { directUploadUnsupported: true }>(
        `/api/projects/${encodeURIComponent(params.projectId)}/drawings/upload-authorization`,
        {
          originalName: stagedFile.name,
          declaredMimeType: stagedFile.type || "application/octet-stream",
          declaredByteSize: stagedFile.size,
        },
      ).catch((error) => {
        // DIRECT_UPLOAD_NOT_SUPPORTED (local dev without vercel-blob configured) — fall back to the legacy
        // server-buffered path. Only ever in development: in production this must surface as a real,
        // visible configuration error, never a silent fallback that routes PDF bytes through a Function.
        if (shouldFallBackToBufferedUpload(getApiErrorMessage(error), process.env.NODE_ENV === "production")) {
          return { directUploadUnsupported: true as const };
        }
        throw error;
      });

      if ("directUploadUnsupported" in authorization) {
        setUploadStage("uploading");
        const response = await uploadDrawingViaLegacyRoute(
          `/api/projects/${encodeURIComponent(params.projectId)}/drawings`,
          stagedFile,
          metadata,
          setUploadProgress,
        );
        const body = response.body as { ok?: boolean; error?: { message?: string } } | null;
        if (response.status < 200 || response.status >= 300 || !body?.ok) {
          throw new Error(body?.error?.message ?? "The upload could not be completed.");
        }
        setStagedFile(null);
        setUploadStage(null);
        setUploadProgress(null);
        setMetadata(EMPTY_METADATA);
        await load();
        return;
      }

      setUploadStage("uploading");
      await putToBlob(authorization.pathname, stagedFile, {
        access: "private",
        token: authorization.uploadToken,
        contentType: stagedFile.type || "application/octet-stream",
        multipart: stagedFile.size > 32 * 1024 * 1024,
        onUploadProgress: (event) => setUploadProgress(Math.round(event.percentage)),
      });

      setUploadStage("finalizing");
      await apiClient.post(
        `/api/projects/${encodeURIComponent(params.projectId)}/drawings/upload-authorization/${authorization.sessionId}/finalize`,
        { metadata },
      );

      setStagedFile(null);
      setUploadStage(null);
      setUploadProgress(null);
      setMetadata(EMPTY_METADATA);
      await load();
    } catch (error) {
      setUploadError(getApiErrorMessage(error));
      setUploadStage("failed");
      setUploadProgress(null);
    }
  }

  function cancelStagedUpload() {
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
          Upload, classify, and securely store drawings for this project — private Vercel Blob storage, tenant-isolated, ready for future AI analysis.
        </p>
      </div>

      {/* 2-7. Upload zone, browse action, format/size disclosure, progress, validation feedback, failed-upload recovery */}
      <div className={panel}>
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
            className={`mt-4 flex cursor-pointer flex-col items-center gap-3 rounded-2xl border-2 border-dashed px-6 py-12 text-center transition-colors ${
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
                <button type="button" onClick={() => { setStagedFile(null); setUploadError(null); }} aria-label="Remove staged file" className="flex h-8 w-8 items-center justify-center rounded-lg border border-[#D5E0EC] text-[#536078] hover:bg-white dark:border-[#20304D] dark:text-[#8CA0BE] dark:hover:bg-[#091326]">
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              )}
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label>
                <span className={labelClass}>Discipline</span>
                <select className={inputClass} value={metadata.discipline ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, discipline: (event.target.value || undefined) as DrawingMetadataInput["discipline"] }))}>
                  <option value="">Select discipline</option>
                  {DRAWING_DISCIPLINES.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>Drawing type</span>
                <select className={inputClass} value={metadata.drawingType ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, drawingType: (event.target.value || undefined) as DrawingMetadataInput["drawingType"] }))}>
                  <option value="">Select type</option>
                  {DRAWING_TYPES.map((value) => <option key={value} value={value}>{formatLabel(value)}</option>)}
                </select>
              </label>
              <label>
                <span className={labelClass}>Drawing number</span>
                <input className={inputClass} value={metadata.drawingNumber ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, drawingNumber: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Title</span>
                <input className={inputClass} value={metadata.title ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, title: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Revision</span>
                <input className={inputClass} value={metadata.revision ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, revision: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Issue date</span>
                <input type="date" className={inputClass} value={metadata.issueDate ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, issueDate: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Scale</span>
                <input className={inputClass} value={metadata.scale ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, scale: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Sheet number</span>
                <input className={inputClass} value={metadata.sheetNumber ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, sheetNumber: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Prepared by</span>
                <input className={inputClass} value={metadata.preparedBy ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, preparedBy: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Checked by</span>
                <input className={inputClass} value={metadata.checkedBy ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, checkedBy: event.target.value }))} />
              </label>
              <label>
                <span className={labelClass}>Approved by</span>
                <input className={inputClass} value={metadata.approvedBy ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, approvedBy: event.target.value }))} />
              </label>
              <label className="sm:col-span-2">
                <span className={labelClass}>Notes</span>
                <textarea className={inputClass} rows={2} value={metadata.notes ?? ""} onChange={(event) => setMetadata((prev) => ({ ...prev, notes: event.target.value }))} />
              </label>
            </div>

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
                <button type="button" onClick={() => setStagedFile(null)} className="rounded-2xl border border-[#D5E0EC] bg-white px-4 py-2 text-sm font-semibold text-[#08152E] hover:bg-[#EAF1F8] dark:border-[#20304D] dark:bg-[#091326] dark:text-white dark:hover:bg-[#101D34]">
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

      {/* 13. Future AI-analysis readiness disclosure */}
      <div className="rounded-[28px] border border-[#009FE3]/30 dark:border-[#21C7F3]/30 bg-[#009FE3]/[0.04] dark:bg-[#21C7F3]/[0.06] p-5">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#0077B6] dark:text-[#21C7F3]" aria-hidden="true" />
          <p className="text-sm text-[#536078] dark:text-[#8CA0BE]">
            <span className="font-semibold text-[#08152E] dark:text-white">AI analysis is not configured yet.</span>{" "}
            Every drawing is stored securely and privately, ready to feed a future automated analysis engine. Nothing here is scanned, extracted, or analyzed today.
          </p>
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
