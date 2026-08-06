"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type Section = { id: string; title: string };

type SearchResultItem = {
  source: string;
  id: string;
  itemCode: string;
  name: string;
  description: string;
  unit: string;
  locked: boolean;
  packageNames?: string[];
};

type Tab = "search" | "manual";

type Props = {
  boqId: string;
  sections: Section[];
  nextItemNumber: number;
  onClose: () => void;
  onAdded: () => void;
};

const SOURCE_TYPE_BY_RESULT_SOURCE: Record<string, string> = {
  COMPANY_LIBRARY: "COMPANY_LIBRARY",
  RECENT: "COMPANY_LIBRARY",
  FAVORITE: "COMPANY_LIBRARY",
  MASTER_PACKAGE: "MASTER_ITEM",
  PREVIOUS_PROJECT: "PREVIOUS_BOQ",
  SUPPLIER_CATALOGUE: "RATE_CATALOGUE",
};

export default function AddItemFromSourceModal({ boqId, sections, nextItemNumber, onClose, onAdded }: Props) {
  const [tab, setTab] = useState<Tab>("search");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResultItem[]>([]);
  const [sectionId, setSectionId] = useState(sections[0]?.id ?? "");
  const [selected, setSelected] = useState<SearchResultItem | null>(null);
  const [quantity, setQuantity] = useState("1");
  const [isSearching, setIsSearching] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [manualDraft, setManualDraft] = useState({ itemCode: "", category: "", description: "", specification: "", unit: "", unitCost: "0", marginPercentage: "0" });

  const switchToManualFromLocked = useCallback((item: SearchResultItem) => {
    setManualDraft((current) => ({ ...current, description: item.name, unit: item.unit }));
    setTab("manual");
  }, []);

  const search = useCallback(async (signal?: AbortSignal) => {
    setIsSearching(true);
    try {
      const data = await apiClient.get<{ items: SearchResultItem[] }>(`/api/items/search?q=${encodeURIComponent(query)}`, signal);
      setResults(data.items);
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") return;
      setError(getApiErrorMessage(err));
    } finally {
      setIsSearching(false);
    }
  }, [query]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void search(controller.signal), 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [search]);

  const addFromSearch = useCallback(async () => {
    if (!selected || selected.locked) return;
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`/api/boqs/${boqId}/items/from-source`, {
        sourceType: SOURCE_TYPE_BY_RESULT_SOURCE[selected.source] ?? "MANUAL",
        sourceId: selected.id,
        sectionId,
        itemNumber: nextItemNumber,
        quantity,
      });
      onAdded();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [boqId, nextItemNumber, onAdded, quantity, sectionId, selected]);

  const addManual = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`/api/boqs/${boqId}/items/from-source`, {
        sourceType: "MANUAL",
        sectionId,
        itemNumber: nextItemNumber,
        quantity,
        overrides: manualDraft,
      });
      onAdded();
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [boqId, manualDraft, nextItemNumber, onAdded, quantity, sectionId]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[85vh] w-full max-w-2xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex items-center justify-between">
          <h3 className="text-xl font-semibold text-white">Add item</h3>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-300 hover:bg-slate-800">Close</button>
        </div>

        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setTab("search")} className={`rounded-full px-4 py-2 text-sm ${tab === "search" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>
            Search all sources
          </button>
          <button type="button" onClick={() => setTab("manual")} className={`rounded-full px-4 py-2 text-sm ${tab === "manual" ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300"}`}>
            Create manually
          </button>
        </div>

        <label className="mt-4 block text-sm text-slate-300">
          <span className="text-slate-400">Section</span>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500">
            {sections.map((section) => <option key={section.id} value={section.id}>{section.title}</option>)}
          </select>
        </label>

        {tab === "search" && (
          <div className="mt-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search company library, master data, previous projects, supplier catalogue…"
              className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
            />
            <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
              {isSearching && <p className="text-xs text-slate-500">Searching…</p>}
              {results.map((item) =>
                item.locked ? (
                  <div key={`${item.source}-${item.id}`} className="w-full rounded-2xl border border-amber-900/60 bg-amber-950/20 px-4 py-3 text-left text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-amber-100">{item.name}</span>
                      <span className="text-[0.65rem] uppercase tracking-wide text-amber-500">locked</span>
                    </div>
                    <p className="mt-1 text-xs text-amber-400">Package: {item.packageNames?.[0] ?? "Industry Library"}</p>
                    <p className="mt-2 text-xs text-amber-200">
                      Request access to the full {item.packageNames?.[0] ?? "Industry"} Library, or enter this item manually.
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Link href="/marketplace" className="rounded-xl border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/70">
                        View Library
                      </Link>
                      <Link href="/marketplace" className="rounded-xl border border-amber-700 bg-amber-900/40 px-3 py-1.5 text-xs font-semibold text-amber-200 hover:bg-amber-900/70">
                        Request Access
                      </Link>
                      <button
                        type="button"
                        onClick={() => switchToManualFromLocked(item)}
                        className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800"
                      >
                        Enter Manually
                      </button>
                    </div>
                  </div>
                ) : (
                  <button
                    key={`${item.source}-${item.id}`}
                    type="button"
                    onClick={() => setSelected(item)}
                    className={`w-full rounded-2xl border px-4 py-3 text-left text-sm ${selected?.id === item.id ? "border-blue-500 bg-blue-950/40" : "border-slate-800 bg-slate-900 hover:border-slate-700"}`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-white">{item.name}</span>
                      <span className="text-[0.65rem] uppercase tracking-wide text-slate-500">{item.source.replace(/_/g, " ")}</span>
                    </div>
                    <p className="text-xs text-slate-500">{item.itemCode} · {item.unit}</p>
                  </button>
                ),
              )}
              {!isSearching && results.length === 0 && <p className="text-xs text-slate-500">No results.</p>}
            </div>

            <label className="mt-4 block text-sm text-slate-300">
              <span className="text-slate-400">Quantity</span>
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} className="mt-2 w-full max-w-xs rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            </label>

            {error && <p className="mt-3 text-xs text-rose-300">{error}</p>}
            <button
              type="button"
              onClick={() => void addFromSearch()}
              disabled={isSaving || !selected || selected.locked || !sectionId}
              className="mt-4 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? "Adding…" : "Add to BOQ"}
            </button>
          </div>
        )}

        {tab === "manual" && (
          <div className="mt-4 space-y-3">
            <input value={manualDraft.itemCode} onChange={(e) => setManualDraft({ ...manualDraft, itemCode: e.target.value })} placeholder="Item code" className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <input value={manualDraft.category} onChange={(e) => setManualDraft({ ...manualDraft, category: e.target.value })} placeholder="Category" className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <input value={manualDraft.description} onChange={(e) => setManualDraft({ ...manualDraft, description: e.target.value })} placeholder="Description" className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <input value={manualDraft.specification} onChange={(e) => setManualDraft({ ...manualDraft, specification: e.target.value })} placeholder="Specification" className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            <div className="grid grid-cols-3 gap-3">
              <input value={manualDraft.unit} onChange={(e) => setManualDraft({ ...manualDraft, unit: e.target.value })} placeholder="Unit" className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              <input value={quantity} onChange={(e) => setQuantity(e.target.value)} placeholder="Quantity" className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              <input value={manualDraft.unitCost} onChange={(e) => setManualDraft({ ...manualDraft, unitCost: e.target.value })} placeholder="Unit cost" className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
            </div>
            {error && <p className="text-xs text-rose-300">{error}</p>}
            <button
              type="button"
              onClick={() => void addManual()}
              disabled={isSaving || !manualDraft.itemCode || !manualDraft.description || !manualDraft.unit || !sectionId}
              className="rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? "Adding…" : "Add to BOQ"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
