"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
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

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export default function ImportsPage() {
  const [jobs, setJobs] = useState<ImportJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [destinationType, setDestinationType] = useState<"COMPANY_LIBRARY" | "RATE_CATALOGUE" | "DRAFT_BOQ" | "STAGING_REVIEW">("COMPANY_LIBRARY");
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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

  const upload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadError(null);
    try {
      const base64 = await readFileAsBase64(file);
      const sourceType = file.name.toLowerCase().endsWith(".csv") ? "CSV" : "XLSX";
      const job = await apiClient.post<ImportJob>("/api/imports", {
        uploadedFileName: file.name,
        fileContentBase64: base64,
        sourceType,
        destinationType,
      });
      window.location.href = `/imports/${job.id}`;
    } catch (error) {
      setUploadError(getApiErrorMessage(error));
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [destinationType]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Structured Import</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">CSV / XLSX import</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Upload a supplier price list, historical catalogue, or BOQ spreadsheet. Nothing is imported until you map columns,
          validate rows, and explicitly approve what to bring in.
        </p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <select value={destinationType} onChange={(e) => setDestinationType(e.target.value as typeof destinationType)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500">
            <option value="COMPANY_LIBRARY">Destination: Company Library</option>
            <option value="RATE_CATALOGUE">Destination: Rate Catalogue</option>
            <option value="DRAFT_BOQ">Destination: Draft BOQ</option>
            <option value="STAGING_REVIEW">Destination: Staging review only</option>
          </select>
          <input ref={fileInputRef} type="file" accept=".csv,.xlsx" onChange={(e) => e.target.files?.[0] && void upload(e.target.files[0])} className="text-sm text-slate-300" />
          {isUploading && <span className="text-xs text-slate-500">Uploading…</span>}
        </div>
        {uploadError && <p className="mt-3 text-xs text-rose-300">{uploadError}</p>}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Recent import jobs</h2>
        {isLoading && <p className="mt-4 text-sm text-slate-500">Loading…</p>}
        {loadError && <p className="mt-4 text-sm text-rose-300">{loadError}</p>}
        <div className="mt-4 space-y-2">
          {jobs.map((job) => (
            <Link key={job.id} href={`/imports/${job.id}`} className="block rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm hover:border-slate-700">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-white">{job.uploadedFileName}</span>
                <span className="text-xs uppercase tracking-wide text-slate-500">{job.status}</span>
              </div>
              <p className="mt-1 text-xs text-slate-500">
                {job.destinationType.replace(/_/g, " ")} · {job.totalRows} rows · {job.validRows} valid · {job.warningRows} warnings · {job.errorRows} errors · {job.importedRows} imported · {formatDate(job.createdAt)}
              </p>
            </Link>
          ))}
          {jobs.length === 0 && !isLoading && <p className="text-sm text-slate-500">No import jobs yet.</p>}
        </div>
      </div>
    </div>
  );
}
