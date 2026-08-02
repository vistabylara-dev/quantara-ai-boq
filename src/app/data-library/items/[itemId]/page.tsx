"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

type ItemDetail = {
  id: string;
  itemCode: string;
  name: string;
  shortDescription: string;
  fullDescription?: string;
  defaultUnit: string;
  technicalFieldsJson?: unknown;
  synonymsJson?: unknown;
  isPremium: boolean;
  locked: boolean;
  packageNames?: string[];
};

type PageProps = { params: { itemId: string } };

export default function DataLibraryItemPage({ params }: PageProps) {
  const [item, setItem] = useState<ItemDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [actionMessage, setActionMessage] = useState<string | null>(null);

  const load = useCallback(async (signal?: AbortSignal) => {
    setIsLoading(true);
    setLoadError(null);
    try {
      const data = await apiClient.get<ItemDetail>(`/api/master-data/items/${params.itemId}`, signal);
      setItem(data);
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

  const addToLibrary = useCallback(async () => {
    setIsSaving(true);
    setActionMessage(null);
    try {
      await apiClient.post("/api/company-library/from-master", { masterItemId: params.itemId });
      setActionMessage("Added to your company library.");
    } catch (error) {
      setActionMessage(getApiErrorMessage(error));
    } finally {
      setIsSaving(false);
    }
  }, [params.itemId]);

  if (isLoading) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Loading item</p>
      </div>
    );
  }

  if (loadError || !item) {
    return (
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8 text-slate-300">
        <p className="text-lg font-semibold text-white">Item unavailable</p>
        <p className="mt-2 text-sm text-rose-300">{loadError ?? "This item could not be loaded."}</p>
      </div>
    );
  }

  const technicalFields = item.technicalFieldsJson && typeof item.technicalFieldsJson === "object" ? (item.technicalFieldsJson as Record<string, unknown>) : null;

  return (
    <div className="space-y-6">
      <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
        <Link href="/data-library" className="text-xs text-slate-500 hover:text-slate-300">← Back to Data Library</Link>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm uppercase tracking-[0.28em] text-slate-500">{item.itemCode}</p>
            <h1 className="mt-2 text-3xl font-semibold text-white">{item.name}</h1>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">{item.shortDescription}</p>
          </div>
          {!item.locked && (
            <button type="button" onClick={() => void addToLibrary()} disabled={isSaving} className="inline-flex rounded-2xl border border-slate-700 bg-blue-600 px-5 py-3 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50">
              {isSaving ? "Adding…" : "Add to Company Library"}
            </button>
          )}
        </div>
        {actionMessage && <p className="mt-4 text-xs text-emerald-300">{actionMessage}</p>}
      </div>

      {item.locked ? (
        <div className="rounded-[32px] border border-amber-900 bg-amber-950/20 p-8 text-center">
          <p className="text-lg font-semibold text-white">This is a premium item</p>
          <p className="mt-2 text-sm text-amber-200">
            {item.packageNames && item.packageNames.length > 0 ? `Part of: ${item.packageNames.join(", ")}. ` : ""}
            Purchase the package or use a trial premium allowance to unlock full specifications.
          </p>
          <Link href="/marketplace" className="mt-4 inline-flex rounded-2xl border border-amber-700 bg-amber-900/40 px-5 py-2.5 text-sm font-semibold text-white hover:bg-amber-900/60">
            View packages
          </Link>
        </div>
      ) : (
        <div className="rounded-[32px] border border-slate-800 bg-slate-950 p-8">
          <h2 className="text-xl font-semibold text-white">Technical specification</h2>
          <p className="mt-2 whitespace-pre-line text-sm text-slate-400">{item.fullDescription || "No additional description."}</p>
          <p className="mt-3 text-xs text-slate-500">Default unit: {item.defaultUnit}</p>

          {technicalFields && Object.keys(technicalFields).length > 0 && (
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              {Object.entries(technicalFields).map(([key, value]) => (
                <div key={key} className="rounded-xl border border-slate-800 bg-slate-900 px-4 py-2 text-sm">
                  <p className="text-xs uppercase tracking-wide text-slate-500">{key}</p>
                  <p className="text-slate-200">{String(value)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
