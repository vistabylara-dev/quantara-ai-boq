"use client";

import { useCallback, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";

/**
 * CANVA-HUMAN-JOURNEY-FINAL — the "we did not guess" recovery panel for a
 * single page none of the three deterministic table-recovery fallbacks
 * could safely resolve. Every action here is explicit and reviewable:
 * a manually-typed row is saved as SOURCE REVIEW evidence (NEEDS_REVIEW),
 * never auto-imported into the BOQ.
 */

type Props = {
  projectId: string;
  fileId: string;
  pageNumber: number;
};

type PanelState = "closed" | "manual-form" | "saved" | "no-data-confirmed";

export function PageRecoveryPanel({ projectId, fileId, pageNumber }: Props) {
  const [state, setState] = useState<PanelState>("closed");
  const [itemCode, setItemCode] = useState("");
  const [description, setDescription] = useState("");
  const [quantity, setQuantity] = useState("");
  const [unit, setUnit] = useState("");
  const [notes, setNotes] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = `/api/projects/${encodeURIComponent(projectId)}/files/${encodeURIComponent(fileId)}/pages/${pageNumber}`;

  const saveManualRow = useCallback(async () => {
    if (!itemCode.trim() || !description.trim()) {
      setError("Item code and description are required.");
      return;
    }
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`${basePath}/manual-row`, {
        itemCode: itemCode.trim(),
        description: description.trim(),
        quantity: quantity.trim() ? Number(quantity) : undefined,
        unit: unit.trim() || undefined,
        notes: notes.trim() || undefined,
      });
      setState("saved");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [basePath, description, itemCode, notes, quantity, unit]);

  const markNoData = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      await apiClient.post(`${basePath}/mark-no-data`, {});
      setState("no-data-confirmed");
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [basePath]);

  if (state === "saved") {
    return (
      <div role="status" className="rounded-2xl border border-emerald-900 bg-emerald-950/20 p-4 text-sm text-emerald-200">
        <p className="font-semibold text-white">Added. Please check this information before using it in your BOQ.</p>
        <a
          href={`/projects/${encodeURIComponent(projectId)}/extractions`}
          className="mt-3 inline-flex rounded-2xl border border-emerald-800 bg-emerald-900/40 px-4 py-2 text-xs font-semibold text-emerald-200 hover:bg-emerald-900/60"
        >
          Check My Information
        </a>
      </div>
    );
  }

  if (state === "no-data-confirmed") {
    return (
      <div role="status" className="rounded-2xl border border-slate-800 bg-slate-900 p-4 text-sm text-slate-300">
        Marked — page {pageNumber} has no BOQ information.
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-amber-900/70 bg-amber-950/10 p-4">
      <p className="text-sm font-semibold text-amber-200">Page {pageNumber} needs your help</p>
      <p className="mt-1 text-xs text-slate-400">We couldn&apos;t safely rebuild this table. We did not guess.</p>

      {state === "closed" && (
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setState("manual-form")}
            className="rounded-2xl border border-blue-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500"
          >
            Type The Missing Information
          </button>
          <a
            href={`/projects/${encodeURIComponent(projectId)}/files`}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
          >
            Use Excel/CSV Instead
          </a>
          <button
            type="button"
            onClick={() => void markNoData()}
            disabled={isSaving}
            className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800 disabled:opacity-50"
          >
            Mark As No BOQ Information
          </button>
          <button
            type="button"
            onClick={() => setState("closed")}
            className="rounded-2xl border border-slate-800 px-4 py-2 text-xs font-semibold text-slate-400 hover:text-slate-200"
          >
            Continue With The Other Information
          </button>
        </div>
      )}

      {state === "manual-form" && (
        <div className="mt-3 space-y-2">
          <input
            value={itemCode}
            onChange={(e) => setItemCode(e.target.value)}
            placeholder="Item code"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Description"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          <div className="flex gap-2">
            <input
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="Quantity"
              type="number"
              className="w-1/2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
            <input
              value={unit}
              onChange={(e) => setUnit(e.target.value)}
              placeholder="Unit"
              className="w-1/2 rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
            />
          </div>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Notes"
            className="w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
          />
          {error && <p className="text-xs text-rose-300">{error}</p>}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => void saveManualRow()}
              disabled={isSaving}
              className="rounded-2xl border border-blue-700 bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            >
              {isSaving ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => setState("closed")}
              className="rounded-2xl border border-slate-700 bg-slate-900 px-4 py-2 text-xs font-semibold text-slate-200 hover:bg-slate-800"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default PageRecoveryPanel;
