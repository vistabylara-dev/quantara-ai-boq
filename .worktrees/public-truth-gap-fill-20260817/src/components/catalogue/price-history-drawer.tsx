"use client";

import { useEffect, useState } from "react";
import type { CataloguePriceHistoryEntry } from "@/types/catalogue";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { formatDate } from "@/lib/formatting/dates";

type PriceHistoryDrawerProps = {
  itemId: string;
  itemCode: string;
  onClose: () => void;
};

export default function PriceHistoryDrawer({ itemId, itemCode, onClose }: PriceHistoryDrawerProps) {
  const [entries, setEntries] = useState<CataloguePriceHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const controller = new AbortController();
    apiClient
      .get<CataloguePriceHistoryEntry[]>(`/api/catalogue/${itemId}/history`, controller.signal)
      .then(setEntries)
      .catch((loadError) => {
        if (loadError instanceof DOMException && loadError.name === "AbortError") return;
        setError(getApiErrorMessage(loadError));
      });
    return () => controller.abort();
  }, [itemId]);

  return (
    <div className="fixed inset-0 z-30 flex items-center justify-center bg-black/60 px-4">
      <div className="max-h-[85vh] w-full max-w-4xl overflow-y-auto rounded-[32px] border border-slate-800 bg-slate-950 p-6">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-white">Price history — {itemCode}</h3>
          <button type="button" onClick={onClose} className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-sm text-slate-200 hover:bg-slate-800">
            Close
          </button>
        </div>

        {error && <p className="text-sm text-rose-300">{error}</p>}
        {!error && entries === null && <p className="text-sm text-slate-400">Loading price history...</p>}
        {entries && entries.length === 0 && (
          <p className="text-sm text-slate-400">No pricing changes recorded yet for this item.</p>
        )}
        {entries && entries.length > 0 && (
          <div className="overflow-x-auto rounded-3xl border border-slate-800">
            <table className="min-w-full text-left text-sm text-slate-300">
              <thead className="bg-slate-900 text-slate-400">
                <tr>
                  <th className="px-4 py-3">Changed</th>
                  <th className="px-4 py-3">By</th>
                  <th className="px-4 py-3 text-right">Base cost</th>
                  <th className="px-4 py-3 text-right">Landed cost</th>
                  <th className="px-4 py-3 text-right">Margin</th>
                  <th className="px-4 py-3 text-right">Selling rate</th>
                  <th className="px-4 py-3">Reason</th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-800">
                    <td className="px-4 py-3">{formatDate(entry.createdAt)}</td>
                    <td className="px-4 py-3">{entry.changedByName ?? "—"}</td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {entry.previousBaseCost.toFixed(2)} → {entry.newBaseCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {entry.previousLandedCost.toFixed(2)} → {entry.newLandedCost.toFixed(2)}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {entry.previousMargin.toFixed(2)}% → {entry.newMargin.toFixed(2)}%
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">
                      {entry.previousSellingRate.toFixed(2)} → {entry.newSellingRate.toFixed(2)}
                    </td>
                    <td className="px-4 py-3">{entry.changeReason ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
