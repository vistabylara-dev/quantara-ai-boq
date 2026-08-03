"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, use } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type LibraryItem = {
  id: string;
  companyItemCode: string;
  name: string;
  description: string;
  unit: string;
  sourceType: string;
  defaultCost: number;
  defaultMargin: number;
  defaultSellingRate: number;
  usageCount: number;
  lastUsedAt: string | null;
  isFavorite: boolean;
  isActive: boolean;
};

type Version = { id: string; version: number; changeReason: string; createdAt: string };
type Usage = { id: string; projectName: string | null; projectReference: string | null; usedAt: string };
type Variant = { id: string; name: string; variantCode: string; defaultSellingRate: number; isActive: boolean };

type PageProps = { params: Promise<{ itemId: string }> };

export default function CompanyLibraryItemPage(props: PageProps) {
  const params = use(props.params);
  const [item, setItem] = useState<LibraryItem | null>(null);
  const [versions, setVersions] = useState<Version[]>([]);
  const [usage, setUsage] = useState<Usage[]>([]);
  const [variants, setVariants] = useState<Variant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const [showVariantForm, setShowVariantForm] = useState(false);
  const [variantDraft, setVariantDraft] = useState({ name: "", variantCode: "", defaultSellingRate: 0 });

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const [itemData, versionsData, usageData, variantsData] = await Promise.all([
        apiClient.get<LibraryItem>(`/api/company-library/${params.itemId}`, signal),
        apiClient.get<Version[]>(`/api/company-library/${params.itemId}/versions`, signal),
        apiClient.get<Usage[]>(`/api/company-library/${params.itemId}/usage`, signal),
        apiClient.get<Variant[]>(`/api/company-library/${params.itemId}/variants`, signal),
      ]);
      setItem(itemData);
      setVersions(versionsData);
      setUsage(usageData);
      setVariants(variantsData);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.itemId]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const saveItem = useCallback(async () => {
    if (!item) return;
    setIsSaving(true);
    setActionMessage(null);
    try {
      const updated = await apiClient.put<LibraryItem>(`/api/company-library/${params.itemId}`, {
        name: item.name,
        description: item.description,
        unit: item.unit,
        defaultCost: item.defaultCost,
        defaultMargin: item.defaultMargin,
        defaultSellingRate: item.defaultSellingRate,
        changeReason: "Manual edit from company library",
      });
      setItem(updated);
      setActionMessage("Saved.");
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [item, load, params.itemId]);

  const toggleFavorite = useCallback(async () => {
    if (!item) return;
    const updated = await apiClient.post<LibraryItem>(`/api/company-library/${params.itemId}/favorite`, { isFavorite: !item.isFavorite });
    setItem(updated);
  }, [item, params.itemId]);

  const toggleArchive = useCallback(async () => {
    if (!item) return;
    if (item.isActive && !window.confirm("Archive this item? It stays in your library but won't appear in default search results.")) return;
    await apiClient.put(`/api/company-library/${params.itemId}`, { isActive: !item.isActive });
    await load();
  }, [item, load, params.itemId]);

  const createVariant = useCallback(async () => {
    setIsSaving(true);
    try {
      await apiClient.post(`/api/company-library/${params.itemId}/variants`, variantDraft);
      setShowVariantForm(false);
      setVariantDraft({ name: "", variantCode: "", defaultSellingRate: 0 });
      await load();
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [load, params.itemId, variantDraft]);

  if (isLoading) {
    return <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300"><p className="text-lg font-semibold text-white">Loading item</p></div>;
  }
  if (loadError || !item) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Item unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This item could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href="/company-library" className="text-xs text-slate-500 hover:text-slate-300">← Back to Company Library</Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{item.companyItemCode} · {item.sourceType.replace(/_/g, " ")}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{item.name}</h1>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => void toggleFavorite()} className={`rounded-2xl border px-4 py-2 text-sm font-semibold ${item.isFavorite ? "border-amber-700 bg-amber-950/30 text-amber-300" : "border-slate-700 bg-slate-900 text-slate-300 hover:bg-slate-800"}`}>
              {item.isFavorite ? "★ Favorited" : "☆ Favorite"}
            </button>
            <button type="button" onClick={() => void toggleArchive()} className="rounded-2xl border border-rose-900 bg-rose-950/30 px-4 py-2 text-sm font-semibold text-rose-300 hover:bg-rose-950/60">
              {item.isActive ? "Archive" : "Restore"}
            </button>
          </div>
        </div>
        {actionMessage && <p className="mt-4 text-xs text-emerald-300">{actionMessage}</p>}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Edit</h2>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <label className="block text-sm text-slate-300 sm:col-span-2">
            <span className="text-slate-400">Name</span>
            <input value={item.name} onChange={(e) => setItem({ ...item, name: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm text-slate-300 sm:col-span-2">
            <span className="text-slate-400">Description</span>
            <textarea value={item.description} onChange={(e) => setItem({ ...item, description: e.target.value })} rows={3} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Unit</span>
            <input value={item.unit} onChange={(e) => setItem({ ...item, unit: e.target.value })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Default cost</span>
            <input type="number" value={item.defaultCost} onChange={(e) => setItem({ ...item, defaultCost: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Default margin (%)</span>
            <input type="number" value={item.defaultMargin} onChange={(e) => setItem({ ...item, defaultMargin: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
          <label className="block text-sm text-slate-300">
            <span className="text-slate-400">Default selling rate</span>
            <input type="number" value={item.defaultSellingRate} onChange={(e) => setItem({ ...item, defaultSellingRate: Number(e.target.value) })} className="mt-2 w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500" />
          </label>
        </div>
        <button type="button" onClick={() => void saveItem()} disabled={isSaving} className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-white">Variants</h2>
          <button type="button" onClick={() => setShowVariantForm((v) => !v)} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
            New variant
          </button>
        </div>
        {showVariantForm && (
          <div className="mt-4 space-y-3 rounded-2xl border border-slate-800 bg-slate-900 p-4">
            <input value={variantDraft.name} onChange={(e) => setVariantDraft({ ...variantDraft, name: e.target.value })} placeholder="Variant name (e.g. 15,000 CFM)" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input value={variantDraft.variantCode} onChange={(e) => setVariantDraft({ ...variantDraft, variantCode: e.target.value })} placeholder="Variant code" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
            <input type="number" value={variantDraft.defaultSellingRate} onChange={(e) => setVariantDraft({ ...variantDraft, defaultSellingRate: Number(e.target.value) })} placeholder="Selling rate" className="w-full rounded-xl border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white" />
            <button type="button" onClick={() => void createVariant()} disabled={isSaving || !variantDraft.name || !variantDraft.variantCode} className="rounded-xl bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              Create variant
            </button>
          </div>
        )}
        <div className="mt-4 space-y-2">
          {variants.map((variant) => (
            <div key={variant.id} className="flex items-center justify-between rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
              <span>{variant.name} <span className="text-xs text-slate-500">({variant.variantCode})</span></span>
              <span>{variant.defaultSellingRate.toLocaleString()}</span>
            </div>
          ))}
          {variants.length === 0 && <p className="text-sm text-slate-500">No variants yet.</p>}
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-xl font-semibold text-white">Version history</h2>
          <div className="mt-4 space-y-2">
            {versions.map((version) => (
              <div key={version.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                <p>Version {version.version}{version.changeReason ? ` — ${version.changeReason}` : ""}</p>
                <p className="text-xs text-slate-500">{formatDate(version.createdAt)}</p>
              </div>
            ))}
            {versions.length === 0 && <p className="text-sm text-slate-500">No changes recorded yet.</p>}
          </div>
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-xl font-semibold text-white">Usage history</h2>
          <div className="mt-4 space-y-2">
            {usage.map((row) => (
              <div key={row.id} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm text-slate-300">
                <p>{row.projectName ? `${row.projectName} (${row.projectReference})` : "Used"}</p>
                <p className="text-xs text-slate-500">{formatDate(row.usedAt)}</p>
              </div>
            ))}
            {usage.length === 0 && <p className="text-sm text-slate-500">Not used in any BOQ yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
