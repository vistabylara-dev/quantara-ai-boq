"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type LibraryItem = {
  id: string;
  companyItemCode: string;
  name: string;
  unit: string;
  sourceType: string;
  defaultCost: number;
  defaultSellingRate: number;
  usageCount: number;
  lastUsedAt: string | null;
  isFavorite: boolean;
  isActive: boolean;
};

export default function CompanyLibraryPage() {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState("");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ companyItemCode: "", name: "", description: "", unit: "", defaultCost: 0, defaultSellingRate: 0 });
  const [isSaving, setIsSaving] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ pageSize: "50" });
      if (search.trim()) params.set("search", search.trim());
      if (favoritesOnly) params.set("favoritesOnly", "true");
      const data = await apiClient.get<{ items: LibraryItem[]; total: number }>(`/api/company-library?${params.toString()}`, signal);
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [search, favoritesOnly]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const toggleFavorite = useCallback(async (item: LibraryItem) => {
    await apiClient.post(`/api/company-library/${item.id}/favorite`, { isFavorite: !item.isFavorite }).catch(() => undefined);
    await load();
  }, [load]);

  const createManual = useCallback(async () => {
    setIsSaving(true);
    setCreateError(null);
    try {
      await apiClient.post("/api/company-library", draft);
      setShowCreate(false);
      setDraft({ companyItemCode: "", name: "", description: "", unit: "", defaultCost: 0, defaultSellingRate: 0 });
      await load();
    } catch (error) {
      setCreateError(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [draft, load]);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Company Library</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Your reusable item library</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">Items you have created manually or copied from master data, supplier catalogue, or previous BOQs — customized to your company.</p>
          </div>
          <button type="button" onClick={() => setShowCreate(true)} className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
            Create item manually
          </button>
        </div>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search…" className="w-64 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-sm text-white outline-none focus:border-blue-500" />
          <button type="button" onClick={() => setFavoritesOnly((v) => !v)} className={`rounded-full px-4 py-2 text-sm ${favoritesOnly ? "bg-blue-600 text-white" : "border border-slate-800 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>
            Favorites only
          </button>
          <p className="text-xs text-slate-500">{total} item{total === 1 ? "" : "s"}</p>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {loadError && <p className="text-sm text-rose-300">{loadError}</p>}
        {!isLoading && !loadError && (
          <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-900">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-950 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Code</th>
                  <th className="px-4 py-3">Item</th>
                  <th className="px-4 py-3">Unit</th>
                  <th className="px-4 py-3">Source</th>
                  <th className="px-4 py-3">Selling rate</th>
                  <th className="px-4 py-3">Usage</th>
                  <th className="px-4 py-3">Favorite</th>
                  <th className="px-4 py-3">Action</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">{item.companyItemCode}</td>
                    <td className="px-4 py-3">
                      <Link href={`/company-library/${item.id}`} className="text-white hover:text-blue-300">{item.name}</Link>
                    </td>
                    <td className="px-4 py-3">{item.unit}</td>
                    <td className="px-4 py-3 text-xs">{item.sourceType.replace(/_/g, " ")}</td>
                    <td className="px-4 py-3">{item.defaultSellingRate.toLocaleString()}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">{item.usageCount}×</td>
                    <td className="px-4 py-3">
                      <button type="button" onClick={() => void toggleFavorite(item)} className={item.isFavorite ? "text-amber-300" : "text-slate-600 hover:text-slate-400"}>★</button>
                    </td>
                    <td className="px-4 py-3">
                      <Link href={`/company-library/${item.id}`} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">Open</Link>
                    </td>
                  </tr>
                ))}
                {items.length === 0 && (
                  <tr><td colSpan={8} className="px-4 py-10 text-center text-slate-400">No company library items yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="max-h-[85vh] w-full max-w-lg overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-8">
            <h3 className="text-xl font-semibold text-white">Create item manually</h3>
            <div className="mt-5 space-y-4">
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Item code</span>
                <input value={draft.companyItemCode} onChange={(e) => setDraft({ ...draft, companyItemCode: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Name</span>
                <input value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Description</span>
                <textarea value={draft.description} onChange={(e) => setDraft({ ...draft, description: e.target.value })} rows={3} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
              <label className="block text-sm text-slate-300">
                <span className="text-slate-400">Unit</span>
                <input value={draft.unit} onChange={(e) => setDraft({ ...draft, unit: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
              </label>
              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm text-slate-300">
                  <span className="text-slate-400">Default cost</span>
                  <input type="number" value={draft.defaultCost} onChange={(e) => setDraft({ ...draft, defaultCost: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
                </label>
                <label className="block text-sm text-slate-300">
                  <span className="text-slate-400">Default selling rate</span>
                  <input type="number" value={draft.defaultSellingRate} onChange={(e) => setDraft({ ...draft, defaultSellingRate: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
                </label>
              </div>
            </div>
            {createError && <p className="mt-4 rounded-2xl border border-rose-900 bg-rose-950/30 p-3 text-xs text-rose-300">{createError}</p>}
            <div className="mt-6 flex justify-end gap-3">
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm font-semibold text-slate-200 hover:bg-slate-800">Cancel</button>
              <button
                type="button"
                onClick={() => void createManual()}
                disabled={isSaving || !draft.companyItemCode || !draft.name || !draft.unit}
                className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                {isSaving ? "Saving…" : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
