"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type PackageListing = {
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
  isFeatured: boolean;
  hasAccess: boolean;
};

export default function MarketplacePage() {
  const [packages, setPackages] = useState<PackageListing[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [actionMessage, setActionMessage] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<PackageListing[]>("/api/data-packages", signal);
      setPackages(data);
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

  const activate = useCallback(async (packageKeyOrId: string) => {
    setBusyKey(packageKeyOrId);
    setActionError(null);
    setActionMessage(null);
    try {
      await apiClient.post("/api/entitlements/activate-development-package", { packageKeyOrId });
      setActionMessage("Package activated (development).");
      await load();
    } catch (error) {
      setActionError(getApiErrorMessage(error));
    } finally {
      setBusyKey(null);
    }
  }, [load]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading marketplace</p>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Marketplace unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError}</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Marketplace</p>
        <h1 className="mt-2 text-3xl font-semibold text-white">Industry data packages</h1>
        <p className="mt-2 max-w-2xl text-sm text-slate-400">
          Full searchable technical libraries by discipline. Billing is not connected — activation below is a development
          control for evaluation, and enterprise packages route to contact sales.
        </p>
        {(actionMessage || actionError) && (
          <div className={`mt-4 rounded-2xl border p-3 text-xs ${actionError ? "border-rose-900 bg-rose-950/30 text-rose-300" : "border-emerald-900 bg-emerald-950/30 text-emerald-300"}`}>
            {actionError ?? actionMessage}
          </div>
        )}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {packages.map((pkg) => (
          <div key={pkg.id} className="rounded-[32px] border border-slate-800 bg-slate-900 p-6 text-slate-300">
            <div className="flex items-start justify-between gap-2">
              <div>
                <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{pkg.packageType}</p>
                <h3 className="mt-2 text-lg font-semibold text-white">{pkg.name}</h3>
              </div>
              {pkg.isFeatured && <span className="rounded-full bg-blue-950/60 px-2 py-0.5 text-[0.65rem] uppercase tracking-[0.2em] text-blue-300">Featured</span>}
            </div>
            <p className="mt-3 text-sm text-slate-400">{pkg.description}</p>
            <p className="mt-3 text-xs text-slate-500">{pkg.itemCount} items</p>
            <p className="mt-2 text-sm text-white">{pkg.monthlyPrice === 0 ? "Contact sales" : `${pkg.currency} ${pkg.monthlyPrice}/mo · ${pkg.currency} ${pkg.annualPrice}/yr`}</p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Link href={`/marketplace/${pkg.key}`} className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800">
                View items
              </Link>
              {pkg.hasAccess ? (
                <span className="rounded-2xl border border-emerald-900 bg-emerald-950/30 px-3 py-2 text-xs font-semibold text-emerald-300">Active</span>
              ) : pkg.monthlyPrice === 0 ? (
                <span className="rounded-2xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs font-semibold text-slate-400">Contact sales</span>
              ) : (
                <button
                  type="button"
                  onClick={() => void activate(pkg.key)}
                  disabled={busyKey === pkg.key}
                  className="rounded-2xl border border-slate-700 bg-blue-600 px-3 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  {busyKey === pkg.key ? "Activating…" : "Activate (development)"}
                </button>
              )}
            </div>
          </div>
        ))}
        {packages.length === 0 && <p className="text-sm text-slate-500">No packages published yet.</p>}
      </div>
    </div>
  );
}
