"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Boxes, ClipboardList, Layers, Search, UploadCloud } from "lucide-react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type HierarchyNode = {
  id: string;
  code: string;
  name: string;
  nodeType: string;
  isActive: boolean;
  children: HierarchyNode[];
};

type ItemRow = {
  id: string;
  itemCode: string;
  name: string;
  shortDescription: string;
  defaultUnit: string;
  status: string;
  isPremium: boolean;
};

type VersionDTO = {
  id: string;
  versionNumber: number;
  status: string;
  effectiveDate: string | null;
  name: string;
  primaryUnit: string;
};

type AdminDetail = {
  item: ItemRow & { disciplineId: string; categoryId: string; hierarchyNodeId: string | null; replacementItemId: string | null };
  versions: VersionDTO[];
  classifications: { system: string; code: string; label: string; isPrimary: boolean }[];
  regionalApplicability: { scope: string; countryCode: string }[];
  drawingProfile: { quantityMethod: string | null; ifcClass: string | null; revitCategory: string | null } | null;
  attributeValues: { id: string; valueText: string | null; valueNumber: number | null; unit: string | null; fieldDefinition: { label: string } }[];
  hierarchyBreadcrumb: { id: string; name: string; nodeType: string }[];
};

const panel = "rounded-[28px] border border-[#D9E2EC] dark:border-[#1E2A42] bg-white dark:bg-[#0B1426] p-6 sm:p-8";
const subtlePanel = "rounded-3xl border border-[#D9E2EC] dark:border-[#1E2A42] bg-[#EEF3F8] dark:bg-[#111D33] p-4";

function HierarchyTree({ nodes, selectedId, onSelect }: { nodes: HierarchyNode[]; selectedId: string | null; onSelect: (node: HierarchyNode) => void }) {
  return (
    <ul className="space-y-0.5">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node)}
            className={`flex w-full items-center justify-between rounded-xl px-3 py-1.5 text-left text-sm ${
              selectedId === node.id ? "bg-[#0EA5E9] text-white dark:bg-[#22D3EE] dark:text-[#050B18]" : "text-[#0B1630] hover:bg-[#EEF3F8] dark:text-[#F7FAFC] dark:hover:bg-[#111D33]"
            } ${!node.isActive ? "opacity-50" : ""}`}
          >
            <span>{node.name}</span>
            <span className="ml-2 shrink-0 text-[0.6rem] uppercase tracking-widest opacity-70">{node.nodeType}</span>
          </button>
          {node.children.length > 0 && (
            <div className="ml-3 border-l border-[#D9E2EC] pl-2 dark:border-[#1E2A42]">
              <HierarchyTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} />
            </div>
          )}
        </li>
      ))}
    </ul>
  );
}

type HvacSummary = {
  itemCount: number;
  familyCount: number;
  variantCount: number;
  publishedCount: number;
  draftCount: number;
  hierarchyNodeCount: number;
  categoryCount: number;
  classificationCount: number;
  recentBatches: {
    id: string;
    uploadedFileName: string;
    status: string;
    totalRows: number;
    insertedCount: number;
    updatedCount: number;
    unchangedCount: number;
    rejectedCount: number;
    warningRows: number;
    executedAt: string | null;
  }[];
};

function SummaryStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-3 dark:border-[#1E2A42] dark:bg-[#111D33]">
      <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">{label}</p>
      <p className="mt-1 text-xl font-semibold text-[#0B1630] dark:text-white">{value}</p>
    </div>
  );
}

type CatalogueDataset = { key: string; label: string; disciplineKey: string; expectedFiles: string[] };

type ImportLogEntry = {
  fileName: string;
  mode: "dry-run" | "execute";
  status: "running" | "done" | "error";
  message: string;
};

type BulkImportResult = {
  totalRows: number;
  validRows: number;
  rejectedRows: number;
  warningRows: number;
  inserted?: number;
  updated?: number;
  unchanged?: number;
  insertedCount?: number;
  updatedCount?: number;
  unchangedCount?: number;
  rejectedCount?: number;
};

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(reader.error ?? new Error("Failed to read file."));
    reader.readAsText(file);
  });
}

/**
 * CATALOGUE-CLOSE — the production-safe way real catalogue data gets
 * activated: the platform owner uploads validated CSVs here, while
 * authenticated in whichever environment (local or production) they're
 * looking at. No production database credential is ever handed to an agent.
 */
function BulkImportPanel() {
  const [datasets, setDatasets] = useState<CatalogueDataset[] | null>(null);
  const [datasetsError, setDatasetsError] = useState<string | null>(null);
  const [selectedDatasetKey, setSelectedDatasetKey] = useState<string>("");
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [log, setLog] = useState<ImportLogEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<CatalogueDataset[]>("/api/admin/master-catalogue/bulk-import", controller.signal)
      .then((data) => {
        setDatasets(data);
        if (data.length > 0) setSelectedDatasetKey(data[0].key);
      })
      .catch((error) => setDatasetsError(getApiErrorMessage(error)));
    return () => controller.abort();
  }, []);

  const selectedDataset = datasets?.find((d) => d.key === selectedDatasetKey) ?? null;

  const runImport = useCallback(async (mode: "dry-run" | "execute") => {
    if (!selectedDatasetKey || selectedFiles.length === 0) return;
    if (mode === "execute" && !window.confirm(`Execute import for ${selectedFiles.length} file(s) against this environment's database? This writes real records.`)) return;

    setIsRunning(true);
    setLog(selectedFiles.map((f) => ({ fileName: f.name, mode, status: "running", message: "Running…" })));

    const nextLog: ImportLogEntry[] = [];
    for (const file of selectedFiles) {
      try {
        const csvText = await readFileAsText(file);
        const result = await apiClient.post<BulkImportResult>(`/api/admin/master-catalogue/bulk-import/${selectedDatasetKey}/${mode}`, { uploadedFileName: file.name, csvText });
        const inserted = result.inserted ?? result.insertedCount ?? 0;
        const updated = result.updated ?? result.updatedCount ?? 0;
        const unchanged = result.unchanged ?? result.unchangedCount ?? 0;
        const rejected = result.rejectedRows ?? result.rejectedCount ?? 0;
        nextLog.push({ fileName: file.name, mode, status: "done", message: `${result.totalRows} rows — insert ${inserted}, update ${updated}, unchanged ${unchanged}, rejected ${rejected}, warnings ${result.warningRows}` });
      } catch (error) {
        nextLog.push({ fileName: file.name, mode, status: "error", message: getApiErrorMessage(error) });
      }
      setLog([...nextLog]);
    }
    setIsRunning(false);
  }, [selectedDatasetKey, selectedFiles]);

  return (
    <div className={panel}>
      <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1630] dark:text-white">
        <UploadCloud className="h-4 w-4" aria-hidden="true" /> Bulk dataset import (production-safe)
      </p>
      <p className="mt-2 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
        Upload validated CSVs to activate them in whichever environment you are logged into. Dry run makes no changes; execute writes real records and is idempotent on rerun.
      </p>

      {datasetsError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{datasetsError}</p>}

      {datasets && (
        <div className="mt-4 flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs text-[#7B879C] dark:text-[#7F8DA6]" htmlFor="dataset-select">Dataset</label>
            <select
              id="dataset-select"
              value={selectedDatasetKey}
              onChange={(event) => setSelectedDatasetKey(event.target.value)}
              className="mt-1 rounded-xl border border-[#D9E2EC] bg-white px-3 py-2 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC]"
            >
              {datasets.map((d) => (
                <option key={d.key} value={d.key}>{d.label} ({d.expectedFiles.length} file{d.expectedFiles.length === 1 ? "" : "s"})</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-[#7B879C] dark:text-[#7F8DA6]" htmlFor="dataset-files">CSV file(s)</label>
            <input
              id="dataset-files"
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              multiple
              onChange={(event) => setSelectedFiles(Array.from(event.target.files ?? []))}
              className="mt-1 block text-xs text-[#0B1630] dark:text-[#F7FAFC]"
            />
          </div>
          <button
            type="button"
            disabled={isRunning || selectedFiles.length === 0}
            onClick={() => void runImport("dry-run")}
            className="rounded-xl border border-[#D9E2EC] bg-white px-4 py-2 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC] dark:hover:bg-[#111D33]"
          >
            Dry run selected files
          </button>
          <button
            type="button"
            disabled={isRunning || selectedFiles.length === 0}
            onClick={() => void runImport("execute")}
            className="rounded-xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
          >
            Execute selected files
          </button>
        </div>
      )}

      {selectedDataset && selectedFiles.length > 0 && selectedFiles.length !== selectedDataset.expectedFiles.length && (
        <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
          {selectedDataset.label} normally has {selectedDataset.expectedFiles.length} source file(s); {selectedFiles.length} selected. That&apos;s fine for a partial run — just confirm this is intentional.
        </p>
      )}

      {log.length > 0 && (
        <ul className="mt-4 space-y-1">
          {log.map((entry, index) => (
            <li key={`${entry.fileName}-${index}`} className={`rounded-xl border px-3 py-2 text-xs ${entry.status === "error" ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-800 dark:bg-rose-950 dark:text-rose-300" : "border-[#D9E2EC] bg-[#EEF3F8] text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#F7FAFC]"}`}>
              <span className="font-semibold">{entry.fileName}</span> [{entry.mode}] — {entry.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function MasterBoqAdmin() {
  const [tree, setTree] = useState<HierarchyNode[] | null>(null);
  const [hvacSummary, setHvacSummary] = useState<HvacSummary | null>(null);
  const [hvacSummaryError, setHvacSummaryError] = useState<string | null>(null);
  const [selectedNode, setSelectedNode] = useState<HierarchyNode | null>(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [detail, setDetail] = useState<AdminDetail | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<HierarchyNode[]>("/api/admin/master-catalogue/hierarchy", controller.signal)
      .then(setTree)
      .catch((error) => setLoadError(getApiErrorMessage(error)));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<HvacSummary>("/api/admin/master-catalogue/hvac-summary", controller.signal)
      .then(setHvacSummary)
      .catch((error) => setHvacSummaryError(getApiErrorMessage(error)));
    return () => controller.abort();
  }, []);

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ pageSize: "30" });
      if (selectedNode) params.set("hierarchyNodeId", selectedNode.id);
      if (search.trim()) params.set("search", search.trim());
      const data = await apiClient.get<{ items: ItemRow[]; total: number }>(`/api/admin/master-catalogue/items?${params.toString()}`, signal);
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [selectedNode, search]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void loadItems(controller.signal), 200);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [loadItems]);

  const openDetail = useCallback(async (itemId: string) => {
    setDetail(null);
    setDetailError(null);
    try {
      const data = await apiClient.get<AdminDetail>(`/api/admin/master-catalogue/items/${itemId}`);
      setDetail(data);
    } catch (error) {
      setDetailError(getApiErrorMessage(error));
    }
  }, []);

  const toggleStatus = useCallback(async (item: ItemRow) => {
    const nextStatus = item.status === "ACTIVE" ? "DEPRECATED" : "ACTIVE";
    setBusy(true);
    setActionMessage(null);
    try {
      await apiClient.patch(`/api/admin/master-catalogue/items/${item.id}/status`, { status: nextStatus });
      setActionMessage(`${item.itemCode} set to ${nextStatus}.`);
      await loadItems();
      if (detail?.item.id === item.id) await openDetail(item.id);
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [loadItems, detail, openDetail]);

  return (
    <div className="space-y-6">
      <header className={panel}>
        <div className="flex items-center gap-3">
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-[#0EA5E9]/40 bg-[#0EA5E9]/10 dark:border-[#22D3EE]/40 dark:bg-[#22D3EE]/10">
            <Layers className="h-5 w-5 text-[#0284C7] dark:text-[#22D3EE]" aria-hidden="true" />
          </span>
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-[#536078] dark:text-[#7F8DA6]">Quantara Platform Administration</p>
            <h1 className="mt-1 text-2xl font-semibold text-[#0B1630] dark:text-white">Master BOQ hierarchy</h1>
          </div>
        </div>
        <p className="mt-3 text-sm text-[#536078] dark:text-[#B8C4D8]">
          Owner-only. Browse the Industry → Discipline → System → Category → Subcategory → Item Family tree, search the master catalogue, and inspect item governance state.
        </p>
      </header>

      {actionMessage && (
        <div className="rounded-2xl border border-[#D9E2EC] bg-white p-4 text-sm text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-white">{actionMessage}</div>
      )}

      <BulkImportPanel />

      <div className={panel}>
        <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1630] dark:text-white">
          <ClipboardList className="h-4 w-4" aria-hidden="true" /> HVAC master data — import summary
        </p>
        {hvacSummaryError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{hvacSummaryError}</p>}
        {!hvacSummary && !hvacSummaryError && <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Loading…</p>}
        {hvacSummary && (
          <>
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-8">
              <SummaryStat label="Items" value={hvacSummary.itemCount} />
              <SummaryStat label="Categories" value={hvacSummary.categoryCount} />
              <SummaryStat label="Families" value={hvacSummary.familyCount} />
              <SummaryStat label="Variants" value={hvacSummary.variantCount} />
              <SummaryStat label="Published versions" value={hvacSummary.publishedCount} />
              <SummaryStat label="Draft/review versions" value={hvacSummary.draftCount} />
              <SummaryStat label="Hierarchy nodes" value={hvacSummary.hierarchyNodeCount} />
              <SummaryStat label="Classifications" value={hvacSummary.classificationCount} />
            </div>
            {hvacSummary.familyCount === 0 && hvacSummary.variantCount === 0 && (
              <p className="mt-3 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
                No item families or variants exist yet — the imported source data is flat (one row per item), so none were fabricated.
              </p>
            )}
            <p className="mt-5 text-sm font-semibold text-[#0B1630] dark:text-white">Recent import batches</p>
            {hvacSummary.recentBatches.length === 0 ? (
              <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">No import batches yet.</p>
            ) : (
              <div className="mt-2 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
                    <tr>
                      <th className="px-4 py-2">File</th>
                      <th className="px-4 py-2">Status</th>
                      <th className="px-4 py-2">Rows</th>
                      <th className="px-4 py-2">Inserted</th>
                      <th className="px-4 py-2">Updated</th>
                      <th className="px-4 py-2">Unchanged</th>
                      <th className="px-4 py-2">Rejected</th>
                      <th className="px-4 py-2">Warnings</th>
                      <th className="px-4 py-2">Executed</th>
                    </tr>
                  </thead>
                  <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                    {hvacSummary.recentBatches.map((batch) => (
                      <tr key={batch.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                        <td className="px-4 py-2">{batch.uploadedFileName}</td>
                        <td className="px-4 py-2">{batch.status}</td>
                        <td className="px-4 py-2">{batch.totalRows}</td>
                        <td className="px-4 py-2">{batch.insertedCount}</td>
                        <td className="px-4 py-2">{batch.updatedCount}</td>
                        <td className="px-4 py-2">{batch.unchangedCount}</td>
                        <td className="px-4 py-2">{batch.rejectedCount}</td>
                        <td className="px-4 py-2">{batch.warningRows}</td>
                        <td className="px-4 py-2">{batch.executedAt ? new Date(batch.executedAt).toLocaleString() : "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[280px_1fr]">
        <div className={panel}>
          <p className="flex items-center gap-2 text-sm font-semibold text-[#0B1630] dark:text-white">
            <Boxes className="h-4 w-4" aria-hidden="true" /> Hierarchy
          </p>
          <div className="mt-4">
            <button
              type="button"
              onClick={() => setSelectedNode(null)}
              className={`mb-2 w-full rounded-xl px-3 py-1.5 text-left text-sm ${selectedNode === null ? "bg-[#0EA5E9] text-white dark:bg-[#22D3EE] dark:text-[#050B18]" : "text-[#0B1630] hover:bg-[#EEF3F8] dark:text-[#F7FAFC] dark:hover:bg-[#111D33]"}`}
            >
              All industries
            </button>
            {tree ? <HierarchyTree nodes={tree} selectedId={selectedNode?.id ?? null} onSelect={setSelectedNode} /> : <p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Loading…</p>}
          </div>
        </div>

        <div className={panel}>
          <div className="flex items-center gap-2 rounded-2xl border border-[#D9E2EC] bg-[#EEF3F8] px-4 py-2 dark:border-[#1E2A42] dark:bg-[#111D33]">
            <Search className="h-4 w-4 text-[#7B879C] dark:text-[#7F8DA6]" aria-hidden="true" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search item code, name, description…"
              className="w-full bg-transparent text-sm text-[#0B1630] outline-none dark:text-[#F7FAFC]"
            />
          </div>
          {selectedNode && <p className="mt-2 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Filtered by: {selectedNode.name} (and everything beneath it)</p>}
          {loadError && <p className="mt-3 text-sm text-[#D84A4A] dark:text-rose-300">{loadError}</p>}
          <p className="mt-4 text-xs text-[#7B879C] dark:text-[#7F8DA6]">{isLoading ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}</p>

          <div className="mt-3 overflow-x-auto rounded-2xl border border-[#D9E2EC] dark:border-[#1E2A42]">
            <table className="min-w-full text-left text-sm">
              <thead className="bg-[#EEF3F8] text-[#536078] dark:bg-[#111D33] dark:text-[#7F8DA6]">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Name</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Premium</th>
                  <th className="px-4 py-3">Actions</th>
                </tr>
              </thead>
              <tbody className="text-[#0B1630] dark:text-[#F7FAFC]">
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-[#D9E2EC] dark:border-[#1E2A42]">
                    <td className="px-4 py-3 font-semibold">{item.itemCode}</td>
                    <td className="px-4 py-3">{item.name}</td>
                    <td className="px-4 py-3">{item.defaultUnit}</td>
                    <td className="px-4 py-3">{item.status}</td>
                    <td className="px-4 py-3">{item.isPremium ? "Yes" : "No"}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button type="button" onClick={() => void openDetail(item.id)} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC] dark:hover:bg-[#111D33]">
                          Details
                        </button>
                        <button type="button" disabled={busy} onClick={() => void toggleStatus(item)} className="rounded-xl border border-[#D9E2EC] bg-white px-3 py-1.5 text-xs font-semibold text-[#0B1630] hover:bg-[#EEF3F8] disabled:opacity-50 dark:border-[#1E2A42] dark:bg-[#0B1426] dark:text-[#F7FAFC] dark:hover:bg-[#111D33]">
                          {item.status === "ACTIVE" ? "Deactivate" : "Activate"}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && !isLoading && (
                  <tr><td colSpan={6} className="px-4 py-8 text-center text-[#7B879C] dark:text-[#7F8DA6]">No items match these filters.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {(detail || detailError) && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4" onClick={() => { setDetail(null); setDetailError(null); }}>
          <div className={`${panel} max-h-[85vh] w-full max-w-2xl overflow-y-auto`} onClick={(event) => event.stopPropagation()}>
            {detailError ? (
              <p className="text-sm text-[#D84A4A] dark:text-rose-300">{detailError}</p>
            ) : detail ? (
              <>
                <p className="text-xs uppercase tracking-[0.2em] text-[#7B879C] dark:text-[#7F8DA6]">{detail.item.itemCode}</p>
                <h2 className="mt-1 text-xl font-semibold text-[#0B1630] dark:text-white">{detail.item.name}</h2>
                <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">
                  {detail.hierarchyBreadcrumb.map((n) => n.name).join(" → ") || "No deep-hierarchy link yet"}
                </p>

                <div className="mt-4 grid gap-2 sm:grid-cols-2">
                  <div className={subtlePanel}><p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Status</p><p className="font-semibold text-[#0B1630] dark:text-white">{detail.item.status}</p></div>
                  <div className={subtlePanel}><p className="text-xs text-[#7B879C] dark:text-[#7F8DA6]">Unit</p><p className="font-semibold text-[#0B1630] dark:text-white">{detail.item.defaultUnit}</p></div>
                </div>

                <p className="mt-5 text-sm font-semibold text-[#0B1630] dark:text-white">Versions</p>
                {detail.versions.length === 0 ? (
                  <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">No versions yet — item still uses its legacy default fields.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {detail.versions.map((v) => (
                      <li key={v.id} className="text-xs text-[#536078] dark:text-[#B8C4D8]">
                        v{v.versionNumber} — {v.status}{v.effectiveDate ? ` (effective ${new Date(v.effectiveDate).toLocaleDateString()})` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                <p className="mt-5 text-sm font-semibold text-[#0B1630] dark:text-white">Classification</p>
                {detail.classifications.length === 0 ? (
                  <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Not defined.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.classifications.map((c) => (
                      <span key={`${c.system}-${c.code}`} className="rounded-full border border-[#D9E2EC] bg-[#EEF3F8] px-3 py-1 text-xs text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#F7FAFC]">
                        {c.system.replace(/_/g, " ")}: {c.code}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-5 text-sm font-semibold text-[#0B1630] dark:text-white">Regional applicability</p>
                {detail.regionalApplicability.length === 0 ? (
                  <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Not defined.</p>
                ) : (
                  <div className="mt-2 flex flex-wrap gap-2">
                    {detail.regionalApplicability.map((r) => (
                      <span key={`${r.scope}-${r.countryCode}`} className="rounded-full border border-[#D9E2EC] bg-[#EEF3F8] px-3 py-1 text-xs text-[#0B1630] dark:border-[#1E2A42] dark:bg-[#111D33] dark:text-[#F7FAFC]">
                        {r.scope}{r.countryCode ? ` (${r.countryCode})` : ""}
                      </span>
                    ))}
                  </div>
                )}

                <p className="mt-5 text-sm font-semibold text-[#0B1630] dark:text-white">Key attributes</p>
                {detail.attributeValues.length === 0 ? (
                  <p className="mt-1 text-xs text-[#7B879C] dark:text-[#7F8DA6]">Not defined.</p>
                ) : (
                  <ul className="mt-2 space-y-1">
                    {detail.attributeValues.map((a) => (
                      <li key={a.id} className="text-xs text-[#536078] dark:text-[#B8C4D8]">
                        {a.fieldDefinition.label}: {a.valueText ?? a.valueNumber ?? "—"}{a.unit ? ` ${a.unit}` : ""}
                      </li>
                    ))}
                  </ul>
                )}

                <button
                  type="button"
                  onClick={() => { setDetail(null); setDetailError(null); }}
                  className="mt-6 rounded-2xl border border-[#0EA5E9] bg-[#0EA5E9] px-4 py-2 text-sm font-semibold text-white hover:opacity-90 dark:border-[#22D3EE] dark:bg-[#22D3EE] dark:text-[#050B18]"
                >
                  Close
                </button>
              </>
            ) : null}
          </div>
        </div>
      )}
    </div>
  );
}
