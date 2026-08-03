"use client";

import { useCallback, useEffect, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type FileView = {
  id: string;
  originalName: string;
  extension: string;
  fileSize: number;
  classification: string;
  classificationConfidence: number | null;
  status: string;
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
  rows: Array<{ id: string; parentRowId: string | null; cells: Array<{ columnKey: string; rawValue: string | null }> }>;
};

export default function ProjectFilesPage(props: { params: Promise<{ projectId: string }> }) {
  const params = use(props.params);
  const [files, setFiles] = useState<FileView[]>([]);
  const [selectedFileId, setSelectedFileId] = useState<string | null>(null);
  const [pages, setPages] = useState<PageView[]>([]);
  const [tables, setTables] = useState<TableView[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFiles = useCallback(async () => {
    try {
      const data = await apiClient.get<FileView[]>(`/api/projects/${encodeURIComponent(params.projectId)}/files`);
      setFiles(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [params.projectId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const loadDetail = useCallback(async (fileId: string) => {
    setSelectedFileId(fileId);
    try {
      const [pagesData, tablesData] = await Promise.all([
        apiClient.get<PageView[]>(`/api/files/${fileId}/pages`).catch(() => []),
        apiClient.get<TableView[]>(`/api/files/${fileId}/tables`).catch(() => []),
      ]);
      setPages(pagesData);
      setTables(tablesData);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, []);

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
      await apiClient.post(`/api/files/${selectedFileId}/${action}`, {});
      await new Promise((resolve) => setTimeout(resolve, 800));
      await Promise.all([loadFiles(), loadDetail(selectedFileId)]);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[320px_1fr]">
      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-400">Files</h2>
          <label className="cursor-pointer rounded-full border border-slate-700 bg-slate-900 px-3 py-1 text-xs text-slate-200 hover:bg-slate-800">
            Upload
            <input type="file" className="hidden" onChange={handleUpload} disabled={busy} />
          </label>
        </div>
        <ul className="mt-4 space-y-2">
          {files.map((file) => (
            <li key={file.id}>
              <button
                onClick={() => void loadDetail(file.id)}
                className={`w-full rounded-xl border px-3 py-2 text-left text-sm transition ${
                  selectedFileId === file.id ? "border-blue-500 bg-blue-500/10 text-white" : "border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"
                }`}
              >
                <div className="truncate font-medium">{file.originalName}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {file.classification} {file.classificationConfidence ? `(${file.classificationConfidence}%)` : ""} · {file.status}
                </div>
              </button>
            </li>
          ))}
          {files.length === 0 && <li className="text-sm text-slate-500">No files uploaded yet.</li>}
        </ul>
      </div>

      <div className="rounded-2xl border border-slate-800 bg-slate-950 p-6">
        {error && <p className="mb-4 rounded-lg border border-red-900 bg-red-950/50 p-3 text-sm text-red-300">{error}</p>}
        {!selectedFileId && <p className="text-sm text-slate-500">Select a file to view classification, extracted tables, and rendered pages.</p>}
        {selectedFileId && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              <button onClick={() => void trigger("classify")} disabled={busy} className="rounded-full bg-blue-600 px-4 py-2 text-sm text-white hover:bg-blue-500 disabled:opacity-50">
                Classify
              </button>
              <button onClick={() => void trigger("preprocess")} disabled={busy} className="rounded-full bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50">
                Render Pages
              </button>
              <button onClick={() => void trigger("extract")} disabled={busy} className="rounded-full bg-slate-700 px-4 py-2 text-sm text-white hover:bg-slate-600 disabled:opacity-50">
                Extract Tables
              </button>
            </div>

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
                      {table.tableType} · confidence {table.confidence}% · {table.status}
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
          </div>
        )}
      </div>
    </div>
  );
}
