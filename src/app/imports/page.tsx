"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState, type DragEvent } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type ImportJob = {
  id: string;
  uploadedFileName: string;
  sourceType: string;
  destinationType: string;
  status: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  importedRows: number;
  createdAt: string;
};

type UploadProgress = { fileName: string; status: "pending" | "done" | "error"; error?: string };

export default function ImportsPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState<"COMPANY_LIBRARY" | "RATE_CATALOGUE" | "DRAFT_BOQ" | "STAGING_REVIEW">("COMPANY_LIBRARY");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress[]>([]);
  const [deletingJobId, setDeletingJobId] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Counts nested dragenter/dragleave pairs as the pointer crosses child elements inside the drop
  // zone — a plain boolean flickers off every time the pointer passes over a child node.
  const dragDepthRef = useRef(0);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<ImportJob[]>("/api/imports", signal);
      setJobs(data);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Uploads every selected file as its own import job, one request at a time (each file has its
  // own headers and needs its own mapping/validation/approval — that's per-job by design, see
  // the job detail page). We deliberately don't navigate away after the first file the way the
  // old single-file flow did, since that made it impossible to get through a multi-file batch:
  // stay on this page, show progress per file, and let the "Recent import jobs" list below pick
  // up every job that was created so each can be opened and mapped in turn.
  const uploadFiles = useCallback(async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    setIsUploading(true);
    setUploadError(null);
    setUploadProgress(fileArray.map((file) => ({ fileName: file.name, status: "pending" })));

    for (let index = 0; index < fileArray.length; index += 1) {
      const file = fileArray[index];
      try {
        const sourceType = file.name.toLowerCase().endsWith(".csv") ? "CSV" : "XLSX";
        const form = new FormData();
        form.append("file", file);
        form.append("uploadedFileName", file.name);
        form.append("sourceType", sourceType);
        form.append("destinationType", destinationType);
        await apiClient.postForm<ImportJob>("/api/imports", form);
        setUploadProgress((current) => current.map((p, i) => (i === index ? { ...p, status: "done" } : p)));
      } catch (error) {
        setUploadProgress((current) => current.map((p, i) => (i === index ? { ...p, status: "error", error: getApiErrorMessage(error) } : p)));
      }
    }

    setIsUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
    await load();
  }, [destinationType, load]);

  const acceptFileList = useCallback((files: FileList) => {
    const accepted = Array.from(files).filter((f) => /\.(csv|xlsx)$/i.test(f.name));
    const rejected = Array.from(files).filter((f) => !/\.(csv|xlsx)$/i.test(f.name));
    if (rejected.length > 0) {
      setUploadError(`Skipped ${rejected.length} file(s) that aren't .csv or .xlsx: ${rejected.map((f) => f.name).join(", ")}`);
    } else {
      setUploadError(null);
    }
    if (accepted.length === 0) return;
    const dt = new DataTransfer();
    accepted.forEach((f) => dt.items.add(f));
    void uploadFiles(dt.files);
  }, [uploadFiles]);

  const onDragEnter = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current += 1;
    setIsDragging(true);
  }, []);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    // Required for onDrop to fire at all — browsers reject drops by default.
    e.preventDefault();
  }, []);

  const onDragLeave = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = Math.max(0, dragDepthRef.current - 1);
    if (dragDepthRef.current === 0) setIsDragging(false);
  }, []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    dragDepthRef.current = 0;
    setIsDragging(false);
    if (e.dataTransfer.files.length > 0) acceptFileList(e.dataTransfer.files);
  }, [acceptFileList]);

  // Deletes the import job and its staged rows only — never touches CompanyLibraryItem /
  // RateCatalogueItem records a prior execute already created. Meant for clearing out a bad
  // upload (wrong file, mapping errors) without leaving clutter in this list.
  const deleteJob = useCallback(async (jobId: string, fileName: string) => {
    if (!window.confirm(`Delete import job "${fileName}"? This removes the upload and its staged rows only — any items it already imported into your library/catalogue will not be affected.`)) {
      return;
    }
    setDeletingJobId(jobId);
    try {
      await apiClient.delete(`/api/imports/${jobId}`);
      await load();
    } catch (error) {
      setUploadError(getApiErrorMessage(error));
    } finally {
      setDeletingJobId(null);
    }
  }, [load]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Structured Import</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">CSV / XLSX import</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Upload a supplier price list, historical catalogue, or BOQ spreadsheet. Nothing is imported until you map columns,
          validate rows, and explicitly approve what to bring in. Select multiple files at once to queue them all — each
          becomes its own import job below, since each file needs its own column mapping.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select value={destinationType} onChange={(e) => setDestinationType(e.target.value as typeof destinationType)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500">
            <option value="COMPANY_LIBRARY">Destination: Company Library</option>
            <option value="RATE_CATALOGUE">Destination: Rate Catalogue</option>
            <option value="DRAFT_BOQ">Destination: Draft BOQ</option>
            <option value="STAGING_REVIEW">Destination: Staging review only</option>
          </select>
          {isUploading && <span className="text-xs text-slate-500">Uploading…</span>}
        </div>

        <div
          onDragEnter={onDragEnter}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          onClick={() => fileInputRef.current?.click()}
          className={`mt-4 flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors ${
            isDragging ? "border-blue-500 bg-blue-500/10" : "border-slate-700 bg-slate-900/40 hover:border-slate-600"
          }`}
        >
          <p className="text-sm text-slate-300">
            {isDragging ? "Drop to queue these files" : "Drag CSV/XLSX files here, or click to browse"}
          </p>
          <p className="text-xs text-slate-500">You can drop or select multiple files at once — each becomes its own import job.</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,.xlsx"
            multiple
            onClick={(e) => e.stopPropagation()}
            onChange={(e) => e.target.files && e.target.files.length > 0 && void uploadFiles(e.target.files)}
            className="hidden"
          />
        </div>
        {uploadError && <p className="mt-3 text-xs text-rose-300">{uploadError}</p>}
        {uploadProgress.length > 0 && (
          <ul className="mt-3 space-y-1 text-xs">
            {uploadProgress.map((p) => (
              <li key={p.fileName} className={p.status === "error" ? "text-rose-300" : p.status === "done" ? "text-emerald-300" : "text-slate-500"}>
                {p.status === "pending" ? "⏳" : p.status === "done" ? "✓" : "✗"} {p.fileName}
                {p.error ? ` — ${p.error}` : ""}
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Recent import jobs</h2>
        {isLoading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
        {loadError && <p className="mt-4 text-sm text-rose-300">{loadError}</p>}
        <div className="mt-4 space-y-2">
          {jobs.map((job) => (
            <div key={job.id} className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm hover:border-slate-700">
              <Link href={`/imports/${job.id}`} className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-white">{job.uploadedFileName}</span>
                  <span className="text-xs uppercase tracking-wide text-slate-500">{job.status}</span>
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  {job.destinationType.replace(/_/g, " ")} · {job.totalRows} rows · {job.validRows} valid · {job.warningRows} warnings · {job.errorRows} errors · {job.importedRows} imported · {formatDate(job.createdAt)}
                </p>
              </Link>
              <button
                type="button"
                onClick={() => void deleteJob(job.id, job.uploadedFileName)}
                disabled={deletingJobId === job.id}
                title="Delete this import job"
                className="shrink-0 rounded-xl border border-rose-900 bg-rose-950/30 px-3 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50"
              >
                {deletingJobId === job.id ? "Deleting…" : "Delete"}
              </button>
            </div>
          ))}
          {jobs.length === 0 && !isLoading && <p className="text-sm text-slate-500">No import jobs yet.</p>}
        </div>
      </div>
    </div>
  );
}
