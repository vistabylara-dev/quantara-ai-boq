"use client";

import { useCallback, useEffect, useState, use } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type PackageDetail = {
  id: string;
  key: string;
  name: string;
  description: string;
  disciplineId: string;
  packageType: string;
  itemCount: number;
  monthlyPrice: number;
  annualPrice: number;
  currency: string;
  hasAccess: boolean;
};

type ItemRow = { id: string; itemCode: string; name: string; shortDescription: string; defaultUnit: string; locked?: boolean; packageNames?: string[] };

type PageProps = { params: Promise<{ packageKey: string }> };

export default function MarketplacePackagePage(props: PageProps) {
  const params = use(props.params);
  const [pkg, setPkg] = useState<PackageDetail | null>(null);
  const [items, setItems] = useState<ItemRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const pkgData = await apiClient.get<PackageDetail>(`/api/data-packages/${params.packageKey}`, signal);
      setPkg(pkgData);
      const itemsData = await apiClient.get<{ items: ItemRow[] }>(`/api/master-data/items?disciplineId=${pkgData.disciplineId}&pageSize=50`, signal);
      setItems(itemsData.items);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setLoadError(getApiErrorMessage(error));
    } finally {
      if (!signal?.aborted) setIsLoading(false);
    }
  }, [params.packageKey]);

  useEffect(() => {
    const controller = new AbortController();
    void load(controller.signal);
    return () => controller.abort();
  }, [load]);

  const activate = useCallback(async () => {
    if (!pkg) return;
    setBusy(true);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.post("/api/entitlements/activate-development-package", { packageKeyOrId: pkg.key });
      setActionMessage("Package activated (development). Full item detail and copying are now unlocked.");
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusy(false);
    }
  }, [load, pkg]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading package</p>
      </div>
    );
  }

  if (loadError || !pkg) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Package unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This package could not be loaded."}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href="/marketplace" className="text-xs text-slate-500 hover:text-slate-300">← Back to marketplace</Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{pkg.packageType}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{pkg.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{pkg.description}</p>
            <p className="mt-2 text-xs text-slate-500">{pkg.itemCount} items</p>
          </div>
          {pkg.hasAccess ? (
            <span className="inline-flex rounded-2xl border border-emerald-900 bg-emerald-950/30 px-4 py-2 text-sm font-semibold text-emerald-300">Active</span>
          ) : (
            <button type="button" onClick={() => void activate()} disabled={busy} className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {busy ? "Activating…" : "Activate (development)"}
            </button>
          )}
        </div>
        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <h2 className="text-xl font-semibold text-white">Items</h2>
        <p className="mt-1 text-sm text-slate-400">{pkg.hasAccess ? "Full technical detail is available for each item." : "Preview only — activate the package to unlock full technical specifications and copying."}</p>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {items.map((item) => (
            <div key={item.id} className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <p className="text-white">{item.name}</p>
                {item.locked && <span className="rounded-full bg-slate-800 px-2 py-0.5 text-[0.6rem] uppercase tracking-[0.2em] text-slate-400">Locked</span>}
              </div>
              <p className="mt-1 text-xs text-slate-500">{item.itemCode} · {item.defaultUnit}</p>
              <p className="mt-1 text-xs text-slate-400">{item.shortDescription}</p>
            </div>
          ))}
          {items.length === 0 && <p className="text-sm text-slate-500">No items in this discipline yet.</p>}
        </div>
      </div>
    </div>
  );
}
