"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, CheckCircle2, PlayCircle, RotateCcw, XCircle } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type JobStatus =
  | "REGISTERED" | "VALIDATING" | "DRY_RUN_RUNNING" | "DRY_RUN_COMPLETE" | "AWAITING_CONFIRMATION"
  | "IMPORT_RUNNING" | "PAUSED" | "COMPLETED" | "COMPLETED_WITH_WARNINGS" | "FAILED" | "CANCELLED" | "ROLLED_BACK";

type DryRunReport = {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  warningRows: number;
  toInsert: number;
  toUpdate: number;
  unchanged: number;
  estimatedBatches: number;
};

type JobDTO = {
  id: string;
  datasetId: string;
  datasetVersion: string;
  status: JobStatus;
  sourceChecksum: string;
  dryRunReport: DryRunReport | null;
  batchSize: number;
  totalRows: number;
  processedRows: number;
  insertedCount: number;
  updatedCount: number;
  unchangedCount: number;
  rejectedCount: number;
  warningCount: number;
  itemsCreated: number;
  versionsCreated: number;
  classificationsCreated: number;
  hierarchyNodesCreated: number;
  categoriesCreated: number;
  currentFileName: string | null;
  lastErrorMessage: string | null;
  startedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

type DatasetSummary = {
  datasetId: string;
  datasetVersion: string;
  label: string;
  disciplineKey: string;
  disciplineReady: boolean;
  fileCount: number;
  expectedRowCount: number;
  sourceChecksum: string;
  currentProductionItemCount: number;
  latestJob: JobDTO | null;
};

const TERMINAL: JobStatus[] = ["COMPLETED", "COMPLETED_WITH_WARNINGS", "CANCELLED", "ROLLED_BACK"];
const RUNNABLE: JobStatus[] = ["PAUSED", "IMPORT_RUNNING"];

const panel = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";
const card = "rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-5";

function statusColor(status: JobStatus): string {
  if (TERMINAL.includes(status) && status !== "COMPLETED") return "text-amber-600 dark:text-amber-400";
  if (status === "COMPLETED") return "text-emerald-600 dark:text-emerald-400";
  if (status === "FAILED") return "text-rose-600 dark:text-rose-400";
  return "text-[#0284C7] dark:text-[#22D3EE]";
}

function DatasetCard({ dataset, onChanged }: { dataset: DatasetSummary; onChanged: () => void }) {
  const [job, setJob] = useState<JobDTO | null>(dataset.latestJob);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [confirmChecked, setConfirmChecked] = useState(false);
  const [history, setHistory] = useState<JobDTO[] | null>(null);
  const pollRef = useRef(false);

  useEffect(() => setJob(dataset.latestJob), [dataset.latestJob]);

  const stopPolling = useCallback(() => {
    pollRef.current = false;
  }, []);

  const pollContinue = useCallback(async (jobId: string) => {
    pollRef.current = true;
    while (pollRef.current) {
      try {
        const updated = await apiClient.post<JobDTO>(`/api/admin/master-catalogue/datasets/jobs/${jobId}/continue`, {});
        setJob(updated);
        if (!RUNNABLE.includes(updated.status)) {
          pollRef.current = false;
          onChanged();
          break;
        }
      } catch (err) {
        setError(getApiErrorMessage(err));
        pollRef.current = false;
        break;
      }
    }
  }, [onChanged]);

  useEffect(() => stopPolling, [stopPolling]);

  const runDryRun = useCallback(async () => {
    setBusy(true);
    setError(null);
    try {
      const created = await apiClient.post<JobDTO>(`/api/admin/master-catalogue/datasets/${dataset.datasetId}/dry-run`, {});
      setJob(created);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [dataset.datasetId]);

  const confirmAndExecute = useCallback(async () => {
    if (!job) return;
    setBusy(true);
    setError(null);
    setConfirmOpen(false);
    setConfirmChecked(false);
    try {
      const armed = await apiClient.post<JobDTO>(`/api/admin/master-catalogue/datasets/jobs/${job.id}/confirm`, {});
      setJob(armed);
      void pollContinue(armed.id);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [job, pollContinue]);

  const resume = useCallback(() => {
    if (!job) return;
    setError(null);
    void pollContinue(job.id);
  }, [job, pollContinue]);

  const cancel = useCallback(async () => {
    if (!job) return;
    stopPolling();
    setBusy(true);
    try {
      const cancelled = await apiClient.post<JobDTO>(`/api/admin/master-catalogue/datasets/jobs/${job.id}/cancel`, {});
      setJob(cancelled);
      onChanged();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }, [job, stopPolling, onChanged]);

  const loadHistory = useCallback(async () => {
    try {
      const jobs = await apiClient.get<JobDTO[]>(`/api/admin/master-catalogue/datasets/${dataset.datasetId}/jobs`);
      setHistory(jobs);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, [dataset.datasetId]);

  const progressPct = job && job.totalRows > 0 ? Math.round(((job.processedRows + job.rejectedCount) / job.totalRows) * 100) : 0;
  const currentBatch = job ? Math.ceil(job.processedRows / job.batchSize) : 0;
  const estimatedBatches = job?.dryRunReport?.estimatedBatches ?? 0;

  return (
    <div className={card}>
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[#0B1630] dark:text-white">{dataset.label}</p>
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">
            v{dataset.datasetVersion} · {dataset.fileCount} file{dataset.fileCount === 1 ? "" : "s"} · {dataset.expectedRowCount.toLocaleString()} expected rows · checksum {dataset.sourceChecksum.slice(0, 12)}…
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Production items</p>
          <p className="text-lg font-semibold text-[#0B1630] dark:text-white">{dataset.currentProductionItemCount.toLocaleString()}</p>
        </div>
      </div>

      {!dataset.disciplineReady && (
        <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">The target discipline does not exist yet — run the hierarchy backfill before activating this dataset.</p>
      )}

      {error && <p className="mt-3 text-xs text-rose-600 dark:text-rose-400">{error}</p>}

      {job && (
        <div className="mt-4 rounded-2xl border border-[#D9E2EC] bg-white px-4 py-3 dark:border-[#1E2A42] dark:bg-[#0B1426]">
          <p className={`text-xs font-semibold uppercase tracking-wide ${statusColor(job.status)}`}>{job.status.replace(/_/g, " ")}</p>

          {job.dryRunReport && (
            <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
              Dry run: {job.dryRunReport.validRows.toLocaleString()} valid, {job.dryRunReport.rejectedRows} rejected, {job.dryRunReport.warningRows} warnings — insert {job.dryRunReport.toInsert.toLocaleString()}, update {job.dryRunReport.toUpdate.toLocaleString()}, unchanged {job.dryRunReport.unchanged.toLocaleString()}
            </p>
          )}

          {(job.status === "PAUSED" || job.status === "IMPORT_RUNNING" || TERMINAL.includes(job.status)) && job.startedAt && (
            <>
              <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-[#EEF3F8] dark:bg-[#111D33]">
                <div className="h-full rounded-full bg-[#0EA5E9] transition-all dark:bg-[#22D3EE]" style={{ width: `${progressPct}%` }} />
              </div>
              <p className="mt-2 text-xs text-[#536078] dark:text-[#B8C4D8]">
                Processed: {job.processedRows.toLocaleString()} / {job.totalRows.toLocaleString()} · Inserted: {job.insertedCount.toLocaleString()} · Updated: {job.updatedCount.toLocaleString()} · Unchanged: {job.unchangedCount.toLocaleString()} · Rejected: {job.rejectedCount.toLocaleString()}
              </p>
              <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
                Current source: {job.currentFileName ?? "—"} · Batch {Math.min(currentBatch, estimatedBatches)} / {estimatedBatches}
              </p>
            </>
          )}

          {job.lastErrorMessage && <p className="mt-2 text-xs text-rose-600 dark:text-rose-400">Last error: {job.lastErrorMessage}</p>}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" disabled={busy || !dataset.disciplineReady} onClick={() => void runDryRun()} className="inline-flex items-center gap-1.5 rounded-xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC]">
          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Run dry run
        </button>

        {job?.status === "DRY_RUN_COMPLETE" && (
          <button type="button" disabled={busy} onClick={() => setConfirmOpen(true)} className="inline-flex items-center gap-1.5 rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> Execute import
          </button>
        )}

        {job?.status === "PAUSED" && (
          <button type="button" disabled={busy} onClick={resume} className="inline-flex items-center gap-1.5 rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] px-3 py-1.5 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
            <PlayCircle className="h-3.5 w-3.5" aria-hidden="true" /> Continue
          </button>
        )}

        {job?.status === "FAILED" && (
          <button type="button" disabled={busy} onClick={resume} className="inline-flex items-center gap-1.5 rounded-xl border border-amber-600 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-500 dark:bg-amber-950 dark:text-amber-300">
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" /> Retry from checkpoint
          </button>
        )}

        {job && !TERMINAL.includes(job.status) && job.status !== "DRY_RUN_COMPLETE" && (
          <button type="button" disabled={busy} onClick={() => void cancel()} className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-3 py-1.5 text-xs font-semibold text-rose-600 hover:bg-rose-50 disabled:opacity-50 dark:border-rose-800 dark:bg-[#0B1426] dark:text-rose-300">
            <XCircle className="h-3.5 w-3.5" aria-hidden="true" /> Cancel
          </button>
        )}

        {job && TERMINAL.includes(job.status) && (
          <span className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950 dark:text-emerald-300">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> {job.status.replace(/_/g, " ")}
          </span>
        )}

        <button type="button" onClick={() => void loadHistory()} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC]">
          View batch history
        </button>
      </div>

      {history && (
        <div className="mt-3 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
          <table className="min-w-full text-left text-xs">
            <thead className="bg-white text-[#536078] dark:bg-[#0B1426] dark:text-[#7F8DA6]">
              <tr>
                <th className="px-3 py-2">Started</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2">Inserted</th>
                <th className="px-3 py-2">Updated</th>
                <th className="px-3 py-2">Unchanged</th>
                <th className="px-3 py-2">Rejected</th>
              </tr>
            </thead>
            <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
              {history.map((h) => (
                <tr key={h.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                  <td className="px-3 py-2">{h.startedAt ? new Date(h.startedAt).toLocaleString() : new Date(h.createdAt).toLocaleString()}</td>
                  <td className="px-3 py-2">{h.status}</td>
                  <td className="px-3 py-2">{h.insertedCount}</td>
                  <td className="px-3 py-2">{h.updatedCount}</td>
                  <td className="px-3 py-2">{h.unchangedCount}</td>
                  <td className="px-3 py-2">{h.rejectedCount}</td>
                </tr>
              ))}
              {history.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-[#7B879C] dark:text-[#7F8DA6]">No jobs yet.</td></tr>}
            </tbody>
          </table>
        </div>
      )}

      {confirmOpen && job?.dryRunReport && (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/60 px-4" onClick={() => setConfirmOpen(false)}>
          <div className={`${panel} max-w-lg`} onClick={(event) => event.stopPropagation()}>
            <p className="text-lg font-semibold text-[#0B1630] dark:text-white">Confirm production import</p>
            <dl className="mt-4 space-y-1 text-sm text-[#536078] dark:text-[#B8C4D8]">
              <div className="flex justify-between"><dt>Dataset</dt><dd className="font-semibold text-[#0B1630] dark:text-white">{dataset.label}</dd></div>
              <div className="flex justify-between"><dt>Expected rows</dt><dd>{job.dryRunReport.validRows.toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Will insert</dt><dd>{job.dryRunReport.toInsert.toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Will update</dt><dd>{job.dryRunReport.toUpdate.toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Unchanged</dt><dd>{job.dryRunReport.unchanged.toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Rejected</dt><dd>{job.dryRunReport.rejectedRows.toLocaleString()}</dd></div>
              <div className="flex justify-between"><dt>Target</dt><dd className="font-semibold text-[#0B1630] dark:text-white">Quantara Master Catalogue</dd></div>
            </dl>
            <label className="mt-5 flex items-start gap-2 text-sm text-[#0B1630] dark:text-white">
              <input type="checkbox" checked={confirmChecked} onChange={(event) => setConfirmChecked(event.target.checked)} className="mt-0.5" />
              I understand this will write validated Master Catalogue records to production.
            </label>
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmOpen(false)} className="rounded-xl border border-[#D9E2EC] bg-white px-4 py-2 text-sm font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC]">
                Cancel
              </button>
              <button type="button" disabled={!confirmChecked} onClick={() => void confirmAndExecute()} className="rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]">
                Confirm and execute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function DatasetActivationPanel() {
  const [datasets, setDatasets] = useState<DatasetSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const data = await apiClient.get<DatasetSummary[]>("/api/admin/master-catalogue/datasets");
      setDatasets(data);
    } catch (err) {
      setError(getApiErrorMessage(err));
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className={panel}>
      <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1630] dark:text-white">
        <Boxes className="h-4 w-4" aria-hidden="true" /> Master dataset activation
      </p>
      <p className="mt-2 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
        Approved, code-registered datasets — the server reads its own validated source files, so activation never requires selecting local files. Execution runs in resumable batches; closing this page pauses safely at the last checkpoint.
      </p>

      {error && <p className="mt-3 text-sm text-rose-600 dark:text-rose-400">{error}</p>}
      {!datasets && !error && <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Loading…</p>}

      {datasets && (
        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          {datasets.map((dataset) => (
            <DatasetCard key={dataset.datasetId} dataset={dataset} onChanged={() => void load()} />
          ))}
        </div>
      )}
    </div>
  );
}
