"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type Discipline = { id: string; key: string; name: string; description: string };
type CategoryNode = { id: string; key: string; name: string; depth: number; children: CategoryNode[] };
type ItemRow = { id: string; itemCode: string; name: string; shortDescription: string; defaultUnit: string; isPremium: boolean; locked?: boolean; packageNames?: string[] };
type HierarchyNode = { id: string; code: string; name: string; nodeType: string; children: HierarchyNode[] };

/** Flattens the tree and keeps only SYSTEM-type nodes (Industry -> Discipline -> System), for the optional deep-hierarchy filter. */
function collectSystemNodes(nodes: HierarchyNode[]): HierarchyNode[] {
  const result: HierarchyNode[] = [];
  for (const node of nodes) {
    if (node.nodeType === "SYSTEM") result.push(node);
    if (node.children.length > 0) result.push(...collectSystemNodes(node.children));
  }
  return result;
}

function CategoryTree({ nodes, selectedId, onSelect }: { nodes: CategoryNode[]; selectedId: string | null; onSelect: (id: string) => void }) {
  return (
    <ul className="space-y-1">
      {nodes.map((node) => (
        <li key={node.id}>
          <button
            type="button"
            onClick={() => onSelect(node.id)}
            className={`w-full rounded-xl px-3 py-1.5 text-left text-sm ${selectedId === node.id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
            style={{ paddingLeft: `${12 + node.depth * 14}px` }}
          >
            {node.name}
          </button>
          {node.children.length > 0 && <CategoryTree nodes={node.children} selectedId={selectedId} onSelect={onSelect} />}
        </li>
      ))}
    </ul>
  );
}

export default function DataLibraryPage() {
  const [disciplines, setDisciplines] = useState<Discipline[]>([]);
  const [selectedDisciplineId, setSelectedDisciplineId] = useState<string | null>(null);
  const [categoryTree, setCategoryTree] = useState<CategoryNode[]>([]);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null);
  const [systemNodes, setSystemNodes] = useState<HierarchyNode[]>([]);
  const [selectedSystemId, setSelectedSystemId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [items, setItems] = useState<ItemRow[]>([]);
  const [total, setTotal] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<Discipline[]>("/api/master-data/disciplines", controller.signal)
      .then((data) => {
        setDisciplines(data);
        setSelectedDisciplineId((current) => current || data[0]?.id || null);
      })
      .catch((error) => setLoadError(getApiErrorMessage(error)));
    apiClient
      .get<HierarchyNode[]>("/api/master-data/hierarchy", controller.signal)
      .then((tree) => setSystemNodes(collectSystemNodes(tree)))
      .catch(() => setSystemNodes([]));
    return () => controller.abort();
  }, []);

  useEffect(() => {
    if (!selectedDisciplineId) return;
    const controller = new AbortController();
    apiClient
      .get<CategoryNode[]>(`/api/master-data/categories?disciplineId=${selectedDisciplineId}&tree=1`, controller.signal)
      .then(setCategoryTree)
      .catch(() => setCategoryTree([]));
    setSelectedCategoryId(null);
    return () => controller.abort();
  }, [selectedDisciplineId]);

  const loadItems = useCallback(async (signal?: AbortSignal) => {
    if (!selectedDisciplineId) return;
    setIsLoading(true);
    setLoadError(null);
    try {
      const params = new URLSearchParams({ disciplineId: selectedDisciplineId, pageSize: "30" });
      if (selectedCategoryId) params.set("categoryId", selectedCategoryId);
      if (selectedSystemId) params.set("hierarchyNodeId", selectedSystemId);
      if (search.trim()) params.set("search", search.trim());
      const data = await apiClient.get<{ items: ItemRow[]; total: number }>(`/api/master-data/items?${params.toString()}`, signal);
      setItems(data.items);
      setTotal(data.total);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [selectedDisciplineId, selectedCategoryId, selectedSystemId, search]);

  useEffect(() => {
    const controller = new AbortController();
    void loadItems(controller.signal);
    return () => controller.abort();
  }, [loadItems]);

  const addToLibrary = useCallback(async (itemId: string) => {
    setBusyItemId(itemId);
    setActionMessage(null);
    try {
      await apiClient.post("/api/company-library/from-master", { masterItemId: itemId });
      setActionMessage("Added to your company library.");
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setBusyItemId(null);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Data Library</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Quantara industry technical reference</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Search professionally structured technical items, add them to your company library, or insert directly into a BOQ.
        </p>
      </div>

      <div className="grid gap-4 lg:grid-cols-[240px_1fr]">
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-5">
          <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Disciplines</p>
          <div className="mt-3 space-y-1">
            {disciplines.map((discipline) => (
              <button
                key={discipline.id}
                type="button"
                onClick={() => setSelectedDisciplineId(discipline.id)}
                className={`w-full rounded-xl px-3 py-2 text-left text-sm ${selectedDisciplineId === discipline.id ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
              >
                {discipline.name}
              </button>
            ))}
          </div>

          {systemNodes.length > 0 && (
            <>
              <p className="mt-6 text-xs uppercase tracking-[0.24em] text-slate-500">System</p>
              <select
                value={selectedSystemId ?? ""}
                onChange={(event) => setSelectedSystemId(event.target.value || null)}
                className="mt-3 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-slate-200 outline-none focus:border-blue-500"
              >
                <option value="">All systems</option>
                {systemNodes.map((node) => (
                  <option key={node.id} value={node.id}>{node.name}</option>
                ))}
              </select>
            </>
          )}

          {categoryTree.length > 0 && (
            <>
              <p className="mt-6 text-xs uppercase tracking-[0.24em] text-slate-500">Categories</p>
              <div className="mt-3">
                <button
                  type="button"
                  onClick={() => setSelectedCategoryId(null)}
                  className={`mb-1 w-full rounded-xl px-3 py-1.5 text-left text-sm ${selectedCategoryId === null ? "bg-blue-600 text-white" : "text-slate-300 hover:bg-slate-800"}`}
                >
                  All categories
                </button>
                <CategoryTree nodes={categoryTree} selectedId={selectedCategoryId} onSelect={setSelectedCategoryId} />
              </div>
            </>
          )}
        </div>

        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-6">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search items by name, code, or description…"
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-white outline-none focus:border-blue-500"
          />

          {actionMessage && <p className="mt-3 text-xs text-emerald-300">{actionMessage}</p>}
          {loadError && <p className="mt-3 text-xs text-rose-300">{loadError}</p>}

          <p className="mt-4 text-xs text-slate-500">{isLoading ? "Loading…" : `${total} item${total === 1 ? "" : "s"}`}</p>

          <div className="mt-3 grid gap-2 sm:grid-cols-2">
            {items.map((item) => (
              <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
                <div className="flex items-center justify-between gap-2">
                  <Link href={`/data-library/items/${item.id}`} className="font-medium text-white hover:text-blue-300">
                    {item.name}
                  </Link>
                  {item.locked ? (
                    <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">Locked</span>
                  ) : item.isPremium ? (
                    <span className="rounded-full bg-blue-950/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-blue-300">Premium</span>
                  ) : (
                    <span className="rounded-full bg-emerald-950/60 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-emerald-300">Free</span>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">{item.itemCode} · {item.defaultUnit}</p>
                <p className="mt-1 text-xs text-slate-400">{item.shortDescription}</p>
                {item.locked && item.packageNames && item.packageNames.length > 0 && (
                  <p className="mt-1 text-[0.65rem] text-amber-300">Part of: {item.packageNames.join(", ")}</p>
                )}
                <div className="mt-3 flex gap-2">
                  <Link href={`/data-library/items/${item.id}`} className="rounded-xl border border-slate-700 bg-slate-950 px-3 py-1.5 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                    View
                  </Link>
                  {!item.locked && (
                    <button
                      type="button"
                      onClick={() => void addToLibrary(item.id)}
                      disabled={busyItemId === item.id}
                      className="rounded-xl border border-slate-700 bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                    >
                      {busyItemId === item.id ? "Adding…" : "Add to library"}
                    </button>
                  )}
                </div>
              </div>
            ))}
            {items.length === 0 && !isLoading && <p className="text-sm text-slate-500">No items found.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
