"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { CatalogueItem, CatalogueListResult } from "@/types/catalogue";
import type { Supplier } from "@/types/supplier";
import { formatDate } from "@/lib/formatting/dates";
import { formatCurrency } from "@/lib/formatting/currency";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import CatalogueItemForm from "@/components/catalogue/catalogue-item-form";
import PriceHistoryDrawer from "@/components/catalogue/price-history-drawer";

type IndustryOption = { id: string; key: string; name: string; enabled: boolean };

const STATUS_BADGE: Record<string, string> = {
  ACTIVE: "border-emerald-800 bg-emerald-950 text-emerald-300",
  PENDING: "border-sky-800 bg-sky-950 text-sky-300",
  EXPIRED: "border-rose-800 bg-rose-950 text-rose-300",
  INACTIVE: "border-slate-700 bg-slate-900 text-slate-400",
};

export default function CataloguePage() {
  const [result, setResult] = useState<CatalogueListResult | null>(null);
  const [industries, setIndustries] = useState<IndustryOption[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [search, setSearch] = useState("");
  const [industryFilter, setIndustryFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiredOnly, setExpiredOnly] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingItem, setEditingItem] = useState<CatalogueItem | "new" | null>(null);
  const [historyItem, setHistoryItem] = useState<CatalogueItem | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    apiClient.get<IndustryOption[]>("/api/industries").then((data) => setIndustries(data.filter((i) => i.enabled))).catch(() => undefined);
    apiClient.get<{ items: Supplier[] }>("/api/suppliers?pageSize=200").then((data) => setSuppliers(data.items)).catch(() => undefined);
  }, []);

  const loadCatalogue = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      if (industryFilter) params.set("industryEngineId", industryFilter);
      if (categoryFilter) params.set("category", categoryFilter);
      if (supplierFilter) params.set("supplierId", supplierFilter);
      if (statusFilter) params.set("status", statusFilter);
      if (expiredOnly) params.set("expired", "true");
      params.set("pageSize", "100");
      setResult(await apiClient.get<CatalogueListResult>(`/api/catalogue?${params.toString()}`, signal));
    } catch (loadError) {
      if (loadError instanceof DOMException && loadError.name === "AbortError") return;
      setError(getApiErrorMessage(loadError));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [search, industryFilter, categoryFilter, supplierFilter, statusFilter, expiredOnly]);

  useEffect(() => {
    const controller = new AbortController();
    const timeout = setTimeout(() => void loadCatalogue(controller.signal), 250);
    return () => {
      clearTimeout(timeout);
      controller.abort();
    };
  }, [loadCatalogue]);

  const items = result?.items ?? [];
  const categories = useMemo(() => Array.from(new Set(items.map((item) => item.category))).sort(), [items]);

  const handleDeactivate = async (item: CatalogueItem) => {
    if (!window.confirm(`Deactivate ${item.itemCode}? It will no longer be selectable for new BOQ items.`)) return;
    setActionError(null);
    try {
      await apiClient.delete(`/api/catalogue/${item.id}`);
      void loadCatalogue();
    } catch (deactivateError) {
      setActionError(getApiErrorMessage(deactivateError));
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Catalogue</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Rate catalogue</h1>
            <p className="mt-3 text-slate-400">Maintain supplier-priced rates and apply them to BOQ items.</p>
          </div>
          <button
            type="button"
            onClick={() => setEditingItem("new")}
            className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            Add rate
          </button>
        </div>
      </div>

      <div className="flex flex-wrap gap-3">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search code, description, category"
          className="min-w-[240px] flex-1 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500"
        />
        <select value={industryFilter} onChange={(event) => setIndustryFilter(event.target.value)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500">
          <option value="">All industries</option>
          {industries.map((industry) => (
            <option key={industry.id} value={industry.key}>{industry.name}</option>
          ))}
        </select>
        <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500">
          <option value="">All categories</option>
          {categories.map((category) => (
            <option key={category} value={category}>{category}</option>
          ))}
        </select>
        <select value={supplierFilter} onChange={(event) => setSupplierFilter(event.target.value)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500">
          <option value="">All suppliers</option>
          {suppliers.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>{supplier.name}</option>
          ))}
        </select>
        <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-blue-500">
          <option value="">All statuses</option>
          <option value="ACTIVE">Active</option>
          <option value="PENDING">Pending</option>
          <option value="EXPIRED">Expired</option>
          <option value="INACTIVE">Inactive</option>
        </select>
        <label className="flex items-center gap-2 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-300">
          <input type="checkbox" checked={expiredOnly} onChange={(event) => setExpiredOnly(event.target.checked)} />
          Expired only
        </label>
      </div>

      {actionError && <p className="text-sm text-rose-300">{actionError}</p>}

      {isLoading ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">Loading catalogue</p>
          <p className="mt-2 text-sm text-slate-400">Fetching rate catalogue items...</p>
        </div>
      ) : error ? (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
          <p className="text-lg font-semibold text-white">Catalogue unavailable</p>
          <p className="mt-2 text-sm text-rose-300">{error}</p>
          <button type="button" onClick={() => void loadCatalogue()} className="mt-6 rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500">
            Try again
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-[32px] border border-slate-800 bg-slate-950">
          <table className="min-w-full text-left text-sm text-slate-300">
            <thead className="bg-slate-900 text-slate-400">
              <tr>
                <th className="px-6 py-4">Code</th>
                <th className="px-6 py-4">Description</th>
                <th className="px-6 py-4">Category</th>
                <th className="px-6 py-4">Supplier</th>
                <th className="px-6 py-4 text-right">Base cost</th>
                <th className="px-6 py-4 text-right">Landed cost</th>
                <th className="px-6 py-4 text-right">Margin</th>
                <th className="px-6 py-4 text-right">Selling rate</th>
                <th className="px-6 py-4">Effective</th>
                <th className="px-6 py-4">Expiry</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-t border-slate-800 hover:bg-slate-900">
                  <td className="px-6 py-4 font-semibold text-white">{item.itemCode}</td>
                  <td className="px-6 py-4 text-slate-300">{item.description}</td>
                  <td className="px-6 py-4 text-slate-300">{item.category}</td>
                  <td className="px-6 py-4 text-slate-300">{item.supplierName ?? "—"}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-slate-300">{formatCurrency(item.baseCost, item.currency)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-slate-300">{formatCurrency(item.landedCost, item.currency)}</td>
                  <td className="px-6 py-4 text-right tabular-nums text-slate-300">{item.defaultMargin.toFixed(2)}%</td>
                  <td className="px-6 py-4 text-right tabular-nums text-white">
                    {formatCurrency(item.sellingRate, item.currency)}
                    {item.belowMinimum && (
                      <span className="ml-2 rounded-full border border-amber-800 bg-amber-950 px-2 py-0.5 text-[10px] font-semibold uppercase text-amber-300">Below min</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-slate-300">{formatDate(item.effectiveDate)}</td>
                  <td className="px-6 py-4 text-slate-300">{item.expiryDate ? formatDate(item.expiryDate) : "—"}</td>
                  <td className="px-6 py-4">
                    <span className={`rounded-full border px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_BADGE[item.status]}`}>
                      {item.status}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={() => setEditingItem(item)} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                        Edit
                      </button>
                      <button type="button" onClick={() => setHistoryItem(item)} className="rounded-2xl border border-slate-700 bg-slate-900 px-3 py-2 text-xs text-slate-200 hover:bg-slate-800">
                        History
                      </button>
                      {item.status !== "INACTIVE" && (
                        <button type="button" onClick={() => void handleDeactivate(item)} className="rounded-2xl border border-rose-800 bg-rose-950/40 px-3 py-2 text-xs text-rose-300 hover:bg-rose-950">
                          Deactivate
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {items.length === 0 && (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-slate-400">No catalogue items match these filters.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {editingItem && (
        <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
          <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-6">
            <h3 className="mb-4 text-lg font-semibold text-white">{editingItem === "new" ? "Add catalogue rate" : `Edit ${editingItem.itemCode}`}</h3>
            <CatalogueItemForm
              industries={industries}
              suppliers={suppliers}
              editingItem={editingItem === "new" ? undefined : editingItem}
              onCancel={() => setEditingItem(null)}
              onSaved={() => {
                setEditingItem(null);
                void loadCatalogue();
              }}
            />
          </div>
        </div>
      )}

      {historyItem && (
        <PriceHistoryDrawer itemId={historyItem.id} itemCode={historyItem.itemCode} onClose={() => setHistoryItem(null)} />
      )}
    </div>
  );
}
