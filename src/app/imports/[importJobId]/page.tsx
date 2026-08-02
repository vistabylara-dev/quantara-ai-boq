"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
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

const STATUS_COLOR: Record<string, string> = {
  PENDING: "text-slate-400",
  VALID: "text-emerald-300",
  WARNING: "text-amber-300",
  ERROR: "text-rose-300",
  APPROVED: "text-blue-300",
  IMPORTED: "text-emerald-400",
  REJECTED: "text-slate-500",
};

type PageProps = { params: { importJobId: string } };

export default function ImportJobPage({ params }: PageProps) {
  const [job, setJob] = useState<ImportJob | null>(null);
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<string[]>([]);

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

  const saveMapping = useCallback(async () => {
    setBusy("mapping");
    setMessage(null);
    try {
      await apiClient.put(`/api/imports/${params.importJobId}/mapping`, { mappingJson: mapping });
      setMessage("Mapping saved.");
      await load();
    } catch (error) {
      setMessage(getApiErrorMessage(error));
    } finally {
      setBusy(null);
    }
  }, [load, mapping, params.importJobId]);

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

  const toggleRow = useCallback((rowId: string) => {
    setSelectedRowIds((current) => (current.includes(rowId) ? current.filter((id) => id !== rowId) : [...current, rowId]));
  }, []);

  const reviewableRows = useMemo(() => rows.filter((r) => r.status === "VALID" || r.status === "WARNING"), [rows]);

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
        <Link href="/imports" className="text-xs text-slate-500 hover:text-slate-300">← Back to imports</Link>
        <h1 className="mt-2 text-2xl font-semibold text-white">{job.uploadedFileName}</h1>
        <p className="mt-1 text-sm text-slate-400">{job.destinationType.replace(/_/g, " ")} · {job.status} · {job.totalRows} rows</p>
        {message && <p className="mt-3 text-xs text-emerald-300">{message}</p>}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">1. Map columns</h2>
        <p className="mt-1 text-sm text-slate-400">Match each source column to a Quantara field. Unmapped fields are left blank.</p>
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
        <div className="mt-4 flex gap-3">
          <button type="button" onClick={() => void saveMapping()} disabled={busy === "mapping"} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50">
            {busy === "mapping" ? "Saving…" : "Save mapping"}
          </button>
          <button type="button" onClick={() => void runValidate()} disabled={busy === "validate"} className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
            {busy === "validate" ? "Validating…" : "2. Validate rows"}
          </button>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">3. Review rows</h2>
        <p className="mt-1 text-sm text-slate-400">{job.validRows} valid · {job.warningRows} warnings · {job.errorRows} errors · {job.importedRows} imported</p>

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
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id} className="border-t border-slate-800">
                  <td className="px-3 py-2">
                    {(row.status === "VALID" || row.status === "WARNING") && (
                      <input type="checkbox" checked={selectedRowIds.includes(row.id)} onChange={() => toggleRow(row.id)} />
                    )}
                  </td>
                  <td className="px-3 py-2">{row.rowNumber}</td>
                  <td className="px-3 py-2">{row.normalizedData?.itemCode ?? "—"}</td>
                  <td className="px-3 py-2">{row.normalizedData?.description ?? "—"}</td>
                  <td className={`px-3 py-2 font-semibold ${STATUS_COLOR[row.status] ?? ""}`}>{row.status}</td>
                  <td className="px-3 py-2">{[...(row.validationErrors ?? []), ...(row.validationWarnings ?? [])].join("; ")}</td>
                </tr>
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
