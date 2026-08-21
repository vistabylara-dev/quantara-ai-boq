"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";
import StatusBadge, { formatStatusLabel } from "@/components/dashboard/status-badge";
import { FeatureHint, FEATURE_HINT_REGISTRY } from "@/components/guidance/feature-hint";
import { GuideTip } from "@/components/guidance/guide-tip";
import { getProjectSourceOrigin, getProjectSourceProcessingState } from "@/lib/guidance/project-workflow";
import type { ProjectWorkflowSnapshot } from "@/lib/guidance/project-workflow-snapshot";

type FileView = {
  id: string;
  projectId: string;
  originalName: string;
  mimeType: string;
  extension: string;
  fileSize: number;
  classification: string;
  classificationConfidence: number | null;
  classificationConfirmedAt: string | null;
  status: string;
  pageCount: number | null;
  drawingNumber: string | null;
  drawingTitle: string | null;
  revisionNumber: string | null;
  processingErrorCode: string | null;
  processingErrorMessage: string | null;
  metadata: unknown;
  uploadedBy: { id: string; fullName: string; email: string };
  createdAt: string;
};

type PageView = {
  id: string;
  pageNumber: number;
  hasImage: boolean;
  processingStatus: string;
};

type TableView = {
  id: string;
  tableType: string;
  confidence: number;
  status: string;
  rows: Array<{
    id: string;
    parentRowId: string | null;
    cells: Array<{ columnKey: string; rawValue: string | null }>;
  }>;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export default function ProjectFilesPage(props: {
  params: Promise<{ projectId: string }>;
  searchParams: Promise<{ file?: string | string[] }>;
}) {
  const params = use(props.params);
  const searchParams = use(props.searchParams);
  const requestedFileId = Array.isArray(searchParams.file) ? searchParams.file[0] : searchParams.file;
  const [files, setFiles] = useState<FileView[]>([]);
  const [currentJobStatuses, setCurrentJobStatuses] = useState<Record<string, string | null>>({});
  const [workflowSnapshot, setWorkflowSnapshot] = useState<ProjectWorkflowSnapshot | null>(null);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageView[]>([]);
  const [tables, setTables] = useState<TableView[]>([]);
  const [pageResultsAvailable, setPageResultsAvailable] = useState<boolean | null>(null);
  const [tableResultsAvailable, setTableResultsAvailable] = useState<boolean | null>(null);
  const [detailWarning, setDetailWarning] = useState<string | null>(null);
  const [filesAvailable, setFilesAvailable] = useState<boolean | null>(null);
  const [snapshotWarning, setSnapshotWarning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const selectedFile = useMemo(
    () => files.find((file) => file.id === selectedFileId) ?? null,
    [files, selectedFileId],
  );

  const processingFacts = useMemo(() => {
    if (!workflowSnapshot) return [];
    const facts = [`${workflowSnapshot.files.total} source${workflowSnapshot.files.total === 1 ? "" : "s"}`];
    const running = (workflowSnapshot.processingJobs.queued ?? 0) + (workflowSnapshot.processingJobs.running ?? 0);
    const completed = workflowSnapshot.processingJobs.completed;
    const failed = workflowSnapshot.processingJobs.failed;
    const pagesAvailable = workflowSnapshot.capturedResults.pageCount;
    const tablesCaptured = workflowSnapshot.capturedResults.tableCount;
    const candidates = workflowSnapshot.extractedEntities.total;
    const candidatesNeedingReview = workflowSnapshot.extractedEntities.needsReview;

    if (running > 0) facts.push(`${running} processing`);
    if (completed !== null && completed > 0) facts.push(`${completed} completed`);
    if (failed !== null && failed > 0) facts.push(`${failed} failed`);
    if (pagesAvailable !== null && pagesAvailable > 0) facts.push(`${pagesAvailable} pages available`);
    if (tablesCaptured !== null && tablesCaptured > 0) facts.push(`${tablesCaptured} tables captured`);
    if (candidatesNeedingReview !== null && candidatesNeedingReview > 0) {
      facts.push(`${candidatesNeedingReview} candidates need review`);
    } else if (candidates !== null && candidates > 0) {
      facts.push(`${candidates} candidates captured`);
    } else if (candidates === 0 && (completed !== null || pagesAvailable !== null || tablesCaptured !== null)) {
      facts.push("0 candidates ready for review");
    }
    return facts;
  }, [workflowSnapshot]);

  const loadDetail = useCallback(async (fileId: string) => {
    setSelectedFileId(fileId);
    setPages([]);
    setTables([]);
    setPageResultsAvailable(null);
    setTableResultsAvailable(null);
    setDetailWarning(null);

    const [pagesResult, tablesResult] = await Promise.allSettled([
      apiClient.get<{ pages: PageView[]; classification: string; ocrStatus: string }>(
        `/api/files/${encodeURIComponent(fileId)}/pages`,
      ),
      apiClient.get<TableView[]>(`/api/files/${encodeURIComponent(fileId)}/tables`),
    ]);

    if (pagesResult.status === "fulfilled") {
      setPages(pagesResult.value.pages);
      setPageResultsAvailable(true);
    } else {
      setPageResultsAvailable(false);
    }

    if (tablesResult.status === "fulfilled") {
      setTables(tablesResult.value);
      setTableResultsAvailable(true);
    } else {
      setTableResultsAvailable(false);
    }

    if (pagesResult.status === "rejected" || tablesResult.status === "rejected") {
      setDetailWarning("Some captured processing information is currently unavailable. No missing result is being reported as zero.");
    }
  }, []);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setError(null);
    setSnapshotWarning(null);
    try {
      const [filesResult, snapshotResult] = await Promise.allSettled([
        apiClient.get<FileView[]>(`/api/projects/${encodeURIComponent(params.projectId)}/files`),
        apiClient.get<ProjectWorkflowSnapshot>(
          `/api/projects/${encodeURIComponent(params.projectId)}/workflow-snapshot`,
        ),
      ]);

      if (filesResult.status === "fulfilled") {
        setFiles(filesResult.value);
        setFilesAvailable(true);
      } else {
        setFilesAvailable(false);
        setError(getApiErrorMessage(filesResult.reason));
      }

      if (snapshotResult.status === "fulfilled") {
        setWorkflowSnapshot(snapshotResult.value);
        setCurrentJobStatuses(Object.fromEntries(
          snapshotResult.value.sources.map((source) => [source.id, source.currentJobStatus] as const),
        ));
      } else {
        setWorkflowSnapshot(null);
        setCurrentJobStatuses({});
        setSnapshotWarning("Project processing facts are temporarily unavailable. Source access and professional actions remain available.");
      }
    } finally {
      setLoading(false);
    }
  }, [params.projectId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  useEffect(() => {
    if (!requestedFileId || selectedFileId === requestedFileId) return;
    if (files.some((file) => file.id === requestedFileId)) {
      void loadDetail(requestedFileId);
    }
  }, [files, loadDetail, requestedFileId, selectedFileId]);

  async function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setBusy(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiClient.postForm(`/api/projects/${encodeURIComponent(params.projectId)}/files`, formData);
      await loadFiles();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  async function trigger(action: "classify" | "extract" | "preprocess") {
    if (!selectedFileId) return;
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/api/files/${encodeURIComponent(selectedFileId)}/${action}`, {});
      await new Promise((resolve) => setTimeout(resolve, 800));
      await Promise.all([loadFiles(), loadDetail(selectedFileId)]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6 sm:p-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Project sources</p>
            <div className="mt-2 flex items-center gap-3">
              <h2 className="text-2xl font-semibold text-white">Source documents and processing</h2>
              <GuideTip
                title="Project sources"
                shortDescription="Drawings, schedules, spreadsheets, and supported connected sources become traceable project evidence."
                whatQuantaraDoes="Quantara preserves each source, its origin, current processing state, and any captured pages or tables that can be proven."
                whatProfessionalCanDo="Add sources, inspect processing, review captured results, and open any available project workspace without a Guide-imposed lock."
                cta={{ label: "Review source list", href: `/projects/${encodeURIComponent(params.projectId)}/files` }}
                ariaLabel="Open guidance for project sources"
              />
            </div>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              Review where each source came from, what Quantara has processed, and any item that still needs professional attention.
            </p>
          </div>
          <Link
            href={`/projects/${encodeURIComponent(params.projectId)}/extractions`}
            className="inline-flex w-fit rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500"
          >
            Review Extracted Data
          </Link>
        </div>

        <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
          <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Captured processing summary</p>
            {processingFacts.length > 0 ? (
              <ul className="mt-3 flex flex-wrap gap-2" aria-label="Captured project source facts">
                {processingFacts.map((fact) => (
                  <li key={fact} className="rounded-full border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-medium text-slate-200">
                    {fact}
                  </li>
                ))}
              </ul>
            ) : loading ? (
              <p className="mt-3 text-sm text-slate-400">Loading provable source-processing facts...</p>
            ) : (
              <p className="mt-3 text-sm text-amber-200">
                {snapshotWarning ?? "No source-processing facts are being claimed without a verified project snapshot."}
              </p>
            )}
          </div>
          <FeatureHint {...FEATURE_HINT_REGISTRY.GOOGLE_DRIVE_SOURCES} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[420px_1fr]">
        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Sources</h2>
              <p className="mt-1 text-xs text-slate-500">
                {files.length} source{files.length === 1 ? "" : "s"} available
              </p>
            </div>
            <label className="cursor-pointer rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs font-semibold text-slate-200 hover:bg-slate-800">
              {busy ? "Working..." : "Upload"}
              <input type="file" className="hidden" onChange={handleUpload} disabled={busy} />
            </label>
          </div>

          <ul className="mt-4 space-y-3">
            {files.map((file) => {
              const origin = getProjectSourceOrigin(file.metadata);
              const processing = getProjectSourceProcessingState(
                file.status,
                currentJobStatuses[file.id] ?? null,
                Boolean(file.processingErrorCode || file.processingErrorMessage),
              );
              const isImported = origin === "Google Drive";

              return (
                <li key={file.id}>
                  <div
                    id={`source-${file.id}`}
                    className={`w-full rounded-2xl border p-4 text-sm transition ${
                      selectedFileId === file.id
                        ? "border-blue-500 bg-blue-500/10 text-white"
                        : "border-slate-800 bg-slate-900 text-slate-300"
                    }`}
                  >
                    <button type="button" onClick={() => void loadDetail(file.id)} className="w-full text-left">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="truncate font-semibold text-white">{file.originalName}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {file.extension.toUpperCase()} · {file.mimeType} · {formatFileSize(file.fileSize)}
                          </p>
                        </div>
                        <StatusBadge label={processing.label} tone={processing.tone} />
                      </div>
                    </button>

                    <dl className="mt-4 grid gap-x-3 gap-y-2 text-xs sm:grid-cols-2">
                      <div>
                        <dt className="text-slate-500">Origin</dt>
                        <dd className="mt-0.5 text-slate-300">{origin}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Date added</dt>
                        <dd className="mt-0.5 text-slate-300">{formatDate(file.createdAt)}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">{isImported ? "Imported by" : "Uploaded by"}</dt>
                        <dd className="mt-0.5 truncate text-slate-300">{file.uploadedBy.fullName}</dd>
                      </div>
                      <div>
                        <dt className="text-slate-500">Classification</dt>
                        <dd className="mt-0.5 text-slate-300">
                          {formatStatusLabel(file.classification)}
                          {file.classificationConfidence !== null ? ` (${file.classificationConfidence}%)` : ""}
                        </dd>
                      </div>
                      {file.pageCount !== null && (
                        <div>
                          <dt className="text-slate-500">Declared pages</dt>
                          <dd className="mt-0.5 text-slate-300">{file.pageCount}</dd>
                        </div>
                      )}
                      {currentJobStatuses[file.id] && (
                        <div>
                          <dt className="text-slate-500">Current processing</dt>
                          <dd className="mt-0.5 text-slate-300">{formatStatusLabel(currentJobStatuses[file.id] ?? "")}</dd>
                        </div>
                      )}
                      {file.revisionNumber && (
                        <div>
                          <dt className="text-slate-500">Revision</dt>
                          <dd className="mt-0.5 text-slate-300">{file.revisionNumber}</dd>
                        </div>
                      )}
                    </dl>

                    {processing.warning && (
                      <p className="mt-3 rounded-xl border border-amber-800/70 bg-amber-950/30 px-3 py-2 text-xs text-amber-200">
                        {processing.warning}
                      </p>
                    )}
                    <button
                      type="button"
                      onClick={() => void loadDetail(file.id)}
                      className="mt-3 text-xs font-semibold text-blue-300 hover:text-blue-200"
                    >
                      Review source details
                    </button>
                  </div>
                </li>
              );
            })}
            {loading && files.length === 0 && <li className="text-sm text-slate-500">Loading project sources...</li>}
            {!loading && filesAvailable === true && files.length === 0 && (
              <li className="rounded-2xl border border-dashed border-slate-700 p-4 text-sm text-slate-400">
                No project sources are available yet. Upload a drawing, schedule, or supported project file to begin.
              </li>
            )}
            {!loading && filesAvailable === false && files.length === 0 && (
              <li className="rounded-2xl border border-amber-800/70 bg-amber-950/30 p-4 text-sm text-amber-200">
                Project sources could not be verified. Retry before relying on a source count.
              </li>
            )}
          </ul>
        </div>

        <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
          {error && <p className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
          {!selectedFile && (
            <p className="text-sm text-slate-500">
              Select a source to review its processing actions, rendered pages, and extracted tables.
            </p>
          )}
          {selectedFile && (
            <div className="space-y-6">
              <div className="flex flex-col gap-4 border-b border-slate-800 pb-5 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm uppercase tracking-[0.2em] text-slate-500">Selected source</p>
                  <h3 className="mt-2 break-words text-xl font-semibold text-white">{selectedFile.originalName}</h3>
                  <p className="mt-1 text-sm text-slate-400">Source: {getProjectSourceOrigin(selectedFile.metadata)}</p>
                </div>
                <a
                  href={`/api/files/${encodeURIComponent(selectedFile.id)}/download`}
                  className="inline-flex w-fit rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                >
                  Download source
                </a>
              </div>

              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={() => void trigger("classify")} disabled={busy} className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                  Classify
                </button>
                <button type="button" onClick={() => void trigger("preprocess")} disabled={busy} className="rounded-full bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50">
                  Render Pages
                </button>
                <button type="button" onClick={() => void trigger("extract")} disabled={busy} className="rounded-full bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50">
                  Extract Tables
                </button>
              </div>

              {detailWarning && (
                <p className="rounded-xl border border-amber-800/70 bg-amber-950/30 px-4 py-3 text-sm text-amber-200">
                  {detailWarning}
                </p>
              )}

              {(pageResultsAvailable === null || tableResultsAvailable === null) && (
                <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                  Loading captured processing information for this source...
                </p>
              )}

              {pages.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Pages</h3>
                  <div className="flex flex-wrap gap-3">
                    {pages.map((page) => (
                      <div key={page.id} className="w-40 rounded-xl border border-slate-800 bg-slate-900 p-2">
                        {page.hasImage ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={`/api/drawing-pages/${page.id}/image`} alt={`Page ${page.pageNumber}`} className="w-full rounded-lg" />
                        ) : (
                          <div className="flex h-24 items-center justify-center text-xs text-slate-500">No image</div>
                        )}
                        <div className="mt-1 text-center text-xs text-slate-500">Page {page.pageNumber}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {tables.length > 0 && (
                <div>
                  <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-400">Extracted Tables</h3>
                  {tables.map((table) => (
                    <div key={table.id} className="mb-4 overflow-x-auto rounded-xl border border-slate-800">
                      <div className="border-b border-slate-800 bg-slate-900 px-3 py-2 text-xs text-slate-400">
                        {table.tableType} · confidence {table.confidence}% · {formatStatusLabel(table.status)}
                      </div>
                      <table className="min-w-full text-left text-xs text-slate-300">
                        <tbody>
                          {table.rows.map((row) => (
                            <tr key={row.id} className={row.parentRowId ? "bg-slate-950" : "bg-slate-900 font-medium"}>
                              {row.cells.map((cell) => (
                                <td key={cell.columnKey} className="border-t border-slate-800 px-3 py-1.5">
                                  {row.parentRowId ? "↳ " : ""}
                                  {cell.rawValue}
                                </td>
                              ))}
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))}
                </div>
              )}

              {pageResultsAvailable === true && tableResultsAvailable === true && pages.length === 0 && tables.length === 0 && (
                <p className="rounded-xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-400">
                  No rendered pages or extracted tables are available for this source yet. Use only the supported processing actions above.
                </p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
