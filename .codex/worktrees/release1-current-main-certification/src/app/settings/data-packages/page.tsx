"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type PackageSubscription = {
  subscriptionId: string;
  status: string;
  startsAt: string | null;
  expiresAt: string | null;
  cancelledAt: string | null;
  source: string;
  package: { id: string; key: string; name: string; packageType: string; itemCount: number };
};

export default function DataPackagesSettingsPage() {
  const [packages, setPackages] = useState<PackageSubscription[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<{ packages: PackageSubscription[] }>("/api/entitlements", signal);
      setPackages(data.packages);
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

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">Settings</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">Data packages</h1>
            <p className="mt-2 text-sm text-slate-400">Industry data packages purchased separately from your software plan.</p>
          </div>
          <Link href="/marketplace" className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500">
            Browse marketplace
          </Link>
        </div>
      </div>

      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        {isLoading && <p className="text-sm text-slate-500">Loading…</p>}
        {loadError && <p className="text-sm text-rose-300">{loadError}</p>}
        {!isLoading && !loadError && (
          <div className="space-y-2">
            {packages.map((sub) => (
              <div key={sub.subscriptionId} className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm">
                <div>
                  <p className="text-white">{sub.package.name}</p>
                  <p className="text-xs text-slate-500">{sub.package.packageType} · {sub.package.itemCount} items · source: {sub.source}</p>
                </div>
                <div className="text-right">
                  <span className={`text-xs font-semibold uppercase tracking-wide ${sub.status === "ACTIVE" ? "text-emerald-300" : sub.status === "EXPIRED" ? "text-slate-500" : "text-amber-300"}`}>{sub.status}</span>
                  <p className="text-xs text-slate-500">{sub.expiresAt ? `Expires ${formatDate(sub.expiresAt)}` : "No expiry set"}</p>
                </div>
              </div>
            ))}
            {packages.length === 0 && (
              <p className="text-sm text-slate-500">No data packages yet. Visit the marketplace to explore available industry packages.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
