"use client";

import Link from "next/link";
import { Fragment, useCallback, useEffect, useMemo, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ImportJob = {
  id: string;
  uploadedFileName: string;
  headers: string[];
  sourceType: string;
  destinationType: string;
  status: string;
  totalRows: number;
  validRows: number;
  warningRows: number;
  errorRows: number;
  importedRows: number;
};

type ImportRow = {
  id: string;
  rowNumber: number;
  rawData: Record<string, string>;
  normalizedData: Record<string, string> | null;
  validationErrors: string[] | null;
  validationWarnings: string[] | null;
  status: string;
  destinationEntityId: string | null;
};

const FIELD_KEYS = ["itemCode", "discipline", "category", "description", "specification", "quantity", "unit", "supplier", "cost", "margin", "sellingRate", "manufacturer", "brand", "model"];

type MappingTemplate = {
  id: string;
  name: string;
  sourceType: string;
  destinationType: string;
  mappingJson: Record<string, string | null>;
};

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-slate-400",
  VALID: "text-emerald-300",
  WARNING: "text-amber-300",
  ERROR: "text-rose-300",
  APPROVED: "text-blue-300",
  IMPORTED: "text-emerald-400",
  REJECTED: "text-slate-500",
};

type PageProps = { params: Promise<{ importJobId: string }> };

export default function ImportJobPage(props: PageProps) {
  const params = use(props.params);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);
  const [templates, setTemplates] = useState<MappingTemplate[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  const [saveTemplateName, setSaveTemplateName] = useState("");
  const [saveAsTemplate, setSaveAsTemplate] = useState(false);
  const [editingRowId, setEditingRowId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Record<string, string>>({});

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<{ job: ImportJob; rows: ImportRow[] }>(`/api/imports/${params.importJobId}`, signal);
      setJob(data.job);
      setRows(data.rows);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.importJobId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  // Saved mappings are company-wide, not per-job, so this list isn't scoped to this job — filter
  // client-side to templates that match this job's source/destination type, since a mapping saved
  // for an XLSX-to-RATE_CATALOGUE job isn't meaningful here if this job is a CSV COMPANY_LIBRARY
  // import.
  useEffect(() => {
    if (!job) return;
    const controller = new AbortController();
    (async () => {
      try {
        const all = await apiClient.get<MappingTemplate[]>("/api/import-mapping-templates", controller.signal);
        setTemplates(all.filter((t) => t.sourceType === job.sourceType && t.destinationType === job.destinationType));
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        // Non-fatal: the manual mapping dropdowns below still work without saved templates.
      }
    })();
    return () => controller.abort();
  }, [job]);

  const applyTemplate = useCallback((templateId: string) => {
    setSelectedTemplateId(templateId);
    const template = templates.find((t) => t.id === templateId);
    if (!template || !job) return;
    // Only carry over mappings whose source column actually exists in this file's headers —
    // a saved template built from a differently-shaped file could otherwise point a field at a
    // header that isn't there, silently leaving it unmapped instead of visibly wrong.
    const next: Record<string, string> = {};
    for (const field of FIELD_KEYS) {
      const header = template.mappingJson[field];
      if (header && job.headers.includes(header)) next[field] = header;
    }
    setMapping(next);
  }, [templates, job]);

  const saveMapping = useCallback(async () => {
    setBusy("mapping");
    setMessage(null);
    try {
      await apiClient.put(`/api/imports/${params.importJobId}/mapping`, {
        mappingJson: mapping,
        ...(saveAsTemplate && saveTemplateName.trim() ? { saveAsTemplateName: saveTemplateName.trim() } : {}),
      });
      setMessage(saveAsTemplate && saveTemplateName.trim() ? `Mapping saved and stored as template "${saveTemplateName.trim()}".` : "Mapping saved.");
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [load, mapping, params.importJobId, saveAsTemplate, saveTemplateName]);

  const runValidate = useCallback(async () => {
    setBusy("validate");
    setMessage(null);
    try {
      await apiClient.post(`/api/imports/${params.importJobId}/validate`, {});
      setMessage("Validation complete.");
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [load, params.importJobId]);

  const actOnRows = useCallback(async (action: "CREATE_NEW" | "SKIP" | "REJECT") => {
    if (selectedRowIds.length === 0) return;
    setBusy(`act-${action}`);
    setMessage(null);
    try {
      await apiClient.post(`/api/imports/${params.importJobId}/approve`, { rowIds: selectedRowIds, action });
      setSelectedRowIds([]);
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [load, params.importJobId, selectedRowIds]);

  const execute = useCallback(async () => {
    setBusy("execute");
    setMessage(null);
    try {
      await apiClient.post(`/api/imports/${params.importJobId}/execute`, {});
      setMessage("Import executed.");
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [load, params.importJobId]);

  const deleteThisJob = useCallback(async () => {
    if (!job) return;
    if (!window.confirm(`Delete import job "${job.uploadedFileName}"? This removes the upload and its staged rows only — any items it already imported into your library/catalogue will not be affected.`)) {
      return;
    }
    setBusy("delete");
    setMessage(null);
    try {
      await apiClient.delete(`/api/imports/${params.importJobId}`);
      window.location.href = "/imports";
    } catch (error) {
      setMessage(getApiErrorMessage(error));
      setBusy(null);
    }
  }, [job, params.importJobId]);

  const toggleRow = useCallback((rowId: string) => {
    setSelectedRowIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  }, []);

  // Lets a reviewer fill in a gap (missing item code, unit, etc.) or fix a bad mapping directly
  // on a row instead of re-uploading the whole file. Missing-required-field gaps are WARNINGs, not
  // ERRORs (see import-service.ts), so a row can already be approved as-is with a blank field —
  // this is for when you'd rather fix it in place first.
  const startEdit = useCallback((row: ImportRow) => {
    setEditingRowId(row.id);
    setEditValues({ ...(row.normalizedData ?? {}) });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRowId(null);
    setEditValues({});
  }, []);

  const saveRowEdit = useCallback(async () => {
    if (!editingRowId) return;
    setBusy(`edit-${editingRowId}`);
    setMessage(null);
    try {
      await apiClient.patch(`/api/imports/${params.importJobId}/rows/${editingRowId}`, { normalizedDataJson: editValues });
      setEditingRowId(null);
      setEditValues({});
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [editingRowId, editValues, load, params.importJobId]);

  const reviewableRows = useMemo(() => rows.filter((r) => r.status === "VALID" || r.status === "WARNING"), [rows]);
  const autoSkippedCount = useMemo(() => rows.filter((r) => r.status === "REJECTED").length, [rows]);

  if (isLoading) return <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300"><p className="text-lg font-semibold text-white">Loading import job</p></div>;
  if (loadError || !job) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Import job unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This import job could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Link href="/imports" className="text-xs text-slate-500 hover:text-slate-300">← Back to imports</Link>
            <h1 className="mt-2 text-2xl font-semibold text-white">{job.uploadedFileName}</h1>
            <p className="mt-1 text-sm text-slate-400">{job.destinationType.replace(/_/g, " ")} · {job.status} · {job.totalRows} rows</p>
          </div>
          <button
            type="button"
            onClick={() => void deleteThisJob()}
            disabled={busy === "delete"}
            className="shrink-0 rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50"
          >
            {busy === "delete" ? "Deleting…" : "Delete this import"}
          </button>
        </div>
        {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">1. Map columns</h2>
        <p className="mt-1 text-sm text-slate-400">Match each source column to a Quantara field. Unmapped fields are left blank.</p>

        {templates.length > 0 && (
          <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-slate-800 bg-slate-900/60 px-4 py-3">
            <span className="text-xs text-slate-400">Reuse a saved mapping:</span>
            <select value={selectedTemplateId} onChange={(e) => applyTemplate(e.target.value)} className="rounded-xl border border-slate-800 bg-slate-900 px-3 py-1.5 text-sm text-white outline-none focus:border-blue-500">
              <option value="">— choose a template —</option>
              {templates.map((t) => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>
        )}

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          {FIELD_KEYS.map((field) => (
            <label key={field} className="block text-sm text-slate-300">
              <span className="text-slate-400">{field}</span>
              <select value={mapping[field] ?? ""} onChange={(e) => setMapping({ ...mapping, [field]: e.target.value })} className="mt-1 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white outline-none focus:border-blue-500">
                <option value="">— not mapped —</option>
                {job.headers.map((header) => <option key={header} value={header}>{header}</option>)}
              </select>
            </label>
          ))}
        </div>
        {job.headers.filter((h) => !Object.values(mapping).includes(h)).length > 0 && (
          <p className="mt-3 text-xs text-amber-300">
            Unmapped column(s), will be ignored: {job.headers.filter((h) => !Object.values(mapping).includes(h)).join(", ")}
          </p>
        )}
        <label className="mt-4 flex flex-wrap items-center gap-2 text-xs text-slate-400">
          <input type="checkbox" checked={saveAsTemplate} onChange={(e) => setSaveAsTemplate(e.target.checked)} />
          Save this mapping as a reusable template, named
          <input
            type="text"
            value={saveTemplateName}
            onChange={(e) => setSaveTemplateName(e.target.value)}
            disabled={!saveAsTemplate}
            placeholder="e.g. HVAC company library import"
            className="rounded-lg border border-slate-800 bg-slate-900 px-2 py-1 text-slate-200 outline-none focus:border-blue-500 disabled:opacity-50"
          />
        </label>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => void saveMapping()} disabled={busy === "mapping" || (saveAsTemplate && !saveTemplateName.trim())} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {busy === "mapping" ? "Saving…" : "Save mapping"}
          </button>
          <button type="button" onClick={() => void runValidate()} disabled={busy === "validate"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {busy === "validate" ? "Validating…" : "2. Validate rows"}
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">3. Review rows</h2>
        <p className="mt-1 text-sm text-slate-400">{job.validRows} valid · {job.warningRows} warnings · {job.errorRows} errors · {autoSkippedCount} duplicates skipped automatically · {job.importedRows} imported</p>
        <p className="mt-1 text-xs text-slate-500">Rows with a missing required field show as WARNING, not ERROR — they can be approved as-is (imported with that field blank) or fixed in place with the Edit button below first. Rows whose item code duplicates an existing item or an earlier row in this file are skipped automatically — nothing existing is changed or deleted.</p>

        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => void actOnRows("CREATE_NEW")} disabled={busy === "act-CREATE_NEW" || selectedRowIds.length === 0} className="rounded-2xl border border-emerald-800 bg-emerald-950/30 px-4 py-2 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-50">
            Approve selected
          </button>
          <button type="button" onClick={() => void actOnRows("SKIP")} disabled={busy === "act-SKIP" || selectedRowIds.length === 0} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-300 hover:bg-slate-800 disabled:opacity-50">
            Skip selected
          </button>
          <button type="button" onClick={() => void actOnRows("REJECT")} disabled={busy === "act-REJECT" || selectedRowIds.length === 0} className="rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-xs font-semibold text-rose-300 hover:bg-rose-950/60 disabled:opacity-50">
            Reject selected
          </button>
        </div>

        <div className="mt-4 max-h-96 overflow-y-auto rounded-2xl border border-slate-800">
          <table className="min-w-full text-left text-xs text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-3 py-2"><input type="checkbox" onChange={(e) => setSelectedRowIds(e.target.checked ? reviewableRows.map((r) => r.id) : [])} /></th>
                <th className="px-3 py-2">#</th>
                <th className="px-3 py-2">Item code</th>
                <th className="px-3 py-2">Description</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Issues</th>
                <th className="px-3 py-2">Fix</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <Fragment key={row.id}>
                  <tr className="border-t border-slate-800">
                    <td className="px-3 py-2">
                      {(row.status === "VALID" || row.status === "WARNING") && (
                        <input type="checkbox" checked={selectedRowIds.includes(row.id)} onChange={() => toggleRow(row.id)} />
                      )}
                    </td>
                    <td className="px-3 py-2">{row.rowNumber}</td>
                    <td className="px-3 py-2">{row.normalizedData?.itemCode || <span className="text-slate-600">missing</span>}</td>
                    <td className="px-3 py-2">{row.normalizedData?.description || <span className="text-slate-600">missing</span>}</td>
                    <td className={`px-3 py-2 font-semibold ${STATUS_COLOR[row.status] ?? ""}`}>{row.status}</td>
                    <td className="px-3 py-2">{[...(row.validationErrors ?? []), ...(row.validationWarnings ?? [])].join("; ")}</td>
                    <td className="px-3 py-2">
                      {row.status !== "IMPORTED" && (
                        editingRowId === row.id ? (
                          <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">Cancel</button>
                        ) : (
                          <button type="button" onClick={() => startEdit(row)} className="rounded-lg border border-slate-700 px-2 py-1 text-xs text-slate-300 hover:bg-slate-800">Edit</button>
                        )
                      )}
                    </td>
                  </tr>
                  {editingRowId === row.id && (
                    <tr className="border-t border-slate-800 bg-slate-900/40">
                      <td colSpan={7} className="px-3 py-3">
                        <div className="grid gap-2 sm:grid-cols-3">
                          {FIELD_KEYS.map((field) => (
                            <label key={field} className="block text-xs text-slate-400">
                              {field}
                              <input
                                type="text"
                                value={editValues[field] ?? ""}
                                onChange={(e) => setEditValues({ ...editValues, [field]: e.target.value })}
                                className="mt-1 w-full rounded-lg border border-slate-800 bg-slate-950 px-2 py-1.5 text-slate-100 outline-none focus:border-blue-500"
                              />
                            </label>
                          ))}
                        </div>
                        <div className="mt-3 flex gap-2">
                          <button type="button" onClick={() => void saveRowEdit()} disabled={busy === `edit-${row.id}`} className="rounded-lg border border-emerald-800 bg-emerald-950/30 px-3 py-1.5 text-xs font-semibold text-emerald-300 hover:bg-emerald-950/60 disabled:opacity-50">
                            {busy === `edit-${row.id}` ? "Saving…" : "Save row"}
                          </button>
                          <button type="button" onClick={cancelEdit} className="rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800">Cancel</button>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
        </div>

        <button type="button" onClick={() => void execute()} disabled={busy === "execute"} className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {busy === "execute" ? "Importing…" : "4. Execute import (approved rows only)"}
        </button>
      </div>
    </div>
  );
}
