"use client";

import { useEffect, useMemo, useState } from "react";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import {
  calculateRateOnlyAmount,
  parseUnitRateInput,
} from "@/lib/boq/rate-only-editor";
import { formatCurrency } from "@/lib/formatting/currency";
import type { BOQ, BOQItem } from "@/types/boq";

type RateDraft = {
  value: string;
  savedValue: string;
  saving: boolean;
  error: string | null;
};

type QuantityOverrideReceipt = {
  originalSystemQuantity: string;
  quantity: string;
  unit: string;
  reason: string;
  actorName: string;
  overriddenAt: string;
};

export type RateOnlyBOQEditorProps = {
  boq: BOQ;
  currency?: string;
  readOnly?: boolean;
  onBoqUpdated?: (boq: BOQ) => void;
  onDirtyChange?: (dirty: boolean) => void;
};

function rateText(item: BOQItem): string {
  return Number.isFinite(item.sellingRate) ? String(item.sellingRate) : "0";
}

function initialDrafts(boq: BOQ): Record<string, RateDraft> {
  return Object.fromEntries(
    boq.sections.flatMap((section) => section.items).map((item) => {
      const value = rateText(item);
      return [item.id, { value, savedValue: value, saving: false, error: null }];
    }),
  );
}

function itemFromBOQ(boq: BOQ, itemId: string): BOQItem | undefined {
  return boq.sections.flatMap((section) => section.items).find((item) => item.id === itemId);
}

function categoryPathFromNotes(notes: string): string | null {
  return notes.split("\n").find((line) => line.startsWith("Category path: "))?.slice("Category path: ".length) ?? null;
}

export function RateOnlyBOQEditor({
  boq,
  currency = "AED",
  readOnly = false,
  onBoqUpdated,
  onDirtyChange,
}: RateOnlyBOQEditorProps) {
  const [drafts, setDrafts] = useState<Record<string, RateDraft>>(() => initialDrafts(boq));
  const [overrideItemId, setOverrideItemId] = useState<string | null>(null);
  const [overrideQuantity, setOverrideQuantity] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [overrideError, setOverrideError] = useState<string | null>(null);
  const [overrideSaving, setOverrideSaving] = useState(false);
  const [overrideOriginalQuantity, setOverrideOriginalQuantity] = useState<number | null>(null);
  const [overrideReceipts, setOverrideReceipts] = useState<Record<string, QuantityOverrideReceipt>>({});
  const items = useMemo(
    () => boq.sections.flatMap((section) => section.items),
    [boq.sections],
  );
  const immutable = readOnly || Boolean(boq.isLocked) || boq.status === "locked" || boq.status === "approved";
  const dirtyCount = useMemo(
    () => items.filter((item) => {
      const draft = drafts[item.id];
      return Boolean(draft && draft.value !== draft.savedValue);
    }).length,
    [drafts, items],
  );
  const draftStorageKey = `quantara:rate-drafts:${boq.id}`;
  const missingRateCount = useMemo(() => items.filter((item) => {
    const parsed = parseUnitRateInput(drafts[item.id]?.value ?? rateText(item));
    return !parsed.ok || parsed.value <= 0;
  }).length, [drafts, items]);
  const estimatedTotal = useMemo(() => items.reduce((total, item) => {
    const parsed = parseUnitRateInput(drafts[item.id]?.value ?? rateText(item));
    return parsed.ok ? total + calculateRateOnlyAmount(item.quantity, parsed.value) : total;
  }, 0), [drafts, items]);

  // Server refreshes update clean rows while preserving anything the user has
  // typed but not saved. Switching to a different revision naturally resets
  // because copied revision items have different ids.
  useEffect(() => {
    setDrafts((current) => {
      const next: Record<string, RateDraft> = {};
      for (const item of items) {
        const serverValue = rateText(item);
        const existing = current[item.id];
        const locallyDirty = existing && existing.value !== existing.savedValue;
        next[item.id] = locallyDirty
          ? existing
          : { value: serverValue, savedValue: serverValue, saving: false, error: null };
      }
      return next;
    });
  }, [items]);

  useEffect(() => {
    try {
      const serialized = window.sessionStorage.getItem(draftStorageKey);
      if (!serialized) return;
      const recovered = JSON.parse(serialized) as Record<string, string>;
      setDrafts((current) => Object.fromEntries(Object.entries(current).map(([itemId, draft]) => [
        itemId,
        typeof recovered[itemId] === "string" ? { ...draft, value: recovered[itemId], error: null } : draft,
      ])));
    } catch {
      window.sessionStorage.removeItem(draftStorageKey);
    }
  }, [draftStorageKey]);

  useEffect(() => {
    const unsaved = Object.fromEntries(Object.entries(drafts)
      .filter(([, draft]) => draft.value !== draft.savedValue)
      .map(([itemId, draft]) => [itemId, draft.value]));
    if (Object.keys(unsaved).length === 0) {
      window.sessionStorage.removeItem(draftStorageKey);
      return;
    }
    window.sessionStorage.setItem(draftStorageKey, JSON.stringify(unsaved));
  }, [draftStorageKey, drafts]);

  useEffect(() => {
    onDirtyChange?.(dirtyCount > 0);
  }, [dirtyCount, onDirtyChange]);

  useEffect(() => {
    if (dirtyCount === 0) return undefined;
    const warnBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warnBeforeUnload);
    return () => window.removeEventListener("beforeunload", warnBeforeUnload);
  }, [dirtyCount]);

  function updateDraft(itemId: string, value: string) {
    setDrafts((current) => ({
      ...current,
      [itemId]: {
        ...(current[itemId] ?? { savedValue: "0", saving: false }),
        value,
        error: null,
      },
    }));
  }

  async function saveRate(item: BOQItem) {
    const draft = drafts[item.id];
    if (!draft || draft.saving || immutable) return;

    const parsed = parseUnitRateInput(draft.value);
    if (!parsed.ok) {
      setDrafts((current) => ({
        ...current,
        [item.id]: { ...current[item.id], error: parsed.message },
      }));
      return;
    }

    setDrafts((current) => ({
      ...current,
      [item.id]: { ...current[item.id], saving: true, error: null },
    }));

    try {
      const updated = await apiClient.put<BOQ>(
        `/api/items/${encodeURIComponent(item.id)}/unit-rate`,
        { unitRate: parsed.serialized },
      );
      const updatedItem = itemFromBOQ(updated, item.id);
      if (!updatedItem) {
        throw new Error("The saved BOQ response did not include this item. Reload and try again.");
      }
      const savedValue = rateText(updatedItem);
      setDrafts((current) => ({
        ...current,
        [item.id]: { value: savedValue, savedValue, saving: false, error: null },
      }));
      onBoqUpdated?.(updated);
    } catch (error) {
      setDrafts((current) => ({
        ...current,
        [item.id]: {
          ...current[item.id],
          saving: false,
          error: getApiErrorMessage(error),
        },
      }));
    }
  }

  function openQuantityOverride(item: BOQItem) {
    setOverrideItemId(item.id);
    setOverrideOriginalQuantity(item.quantity);
    setOverrideQuantity(String(item.quantity));
    setOverrideReason("");
    setOverrideError(null);
  }

  async function submitQuantityOverride(item: BOQItem) {
    const quantityCalculationId = item.integrity?.quantity.quantityCalculationId;
    if (!quantityCalculationId || !boq.version || !boq.revisionNumber || overrideSaving) return;
    if (!overrideReason.trim()) {
      setOverrideError("A reason is required for an audited quantity override.");
      return;
    }
    setOverrideSaving(true);
    setOverrideError(null);
    try {
      const result = await apiClient.post<{ override: QuantityOverrideReceipt; boq: BOQ }>(
        `/api/items/${encodeURIComponent(item.id)}/quantity-override`,
        {
          quantityCalculationId,
          quantity: overrideQuantity,
          reason: overrideReason,
          expected: {
            boqId: boq.id,
            boqVersion: boq.version,
            boqRevisionNumber: boq.revisionNumber,
            itemQuantity: item.quantity,
            itemUnit: item.unit,
            calculationResultValue: item.quantity,
          },
        },
      );
      setOverrideReceipts((current) => ({ ...current, [item.id]: result.override }));
      setOverrideItemId(null);
      onBoqUpdated?.(result.boq);
    } catch (error) {
      setOverrideError(getApiErrorMessage(error));
    } finally {
      setOverrideSaving(false);
    }
  }

  if (items.length === 0) {
    return (
      <section aria-labelledby="rate-only-heading" className="rounded-3xl border border-slate-800 bg-slate-950 p-6">
        <h2 id="rate-only-heading" className="text-lg font-semibold text-white">Add unit rates</h2>
        <p className="mt-2 text-sm text-slate-400">Quantara has not generated any measurable BOQ items yet.</p>
      </section>
    );
  }

  return (
    <section aria-labelledby="rate-only-heading" className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 id="rate-only-heading" className="text-xl font-semibold text-white">Optional unit rates</h2>
          <p className="mt-1 text-sm text-slate-400">
            Quantara generated the scope, descriptions, units and quantities. Add rates only when you need a priced estimate or quotation.
          </p>
        </div>
        <div className="text-end text-sm text-slate-300" role="status" aria-live="polite">
          <p>{missingRateCount} items remain unpriced</p>
          <p className="mt-1 font-semibold text-white">Estimated total from entered rates: {formatCurrency(estimatedTotal, currency)}</p>
          <p className="mt-1 text-xs text-slate-400">
            {immutable
              ? "This revision is read-only."
              : dirtyCount > 0
                ? `${dirtyCount} unsaved rate ${dirtyCount === 1 ? "change" : "changes"}`
                : "All rate changes saved"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-3xl border border-slate-800 bg-slate-950">
        <table className="min-w-full border-collapse text-left text-sm">
          <thead className="border-b border-slate-800 bg-slate-900/70 text-xs uppercase tracking-wide text-slate-400">
            <tr>
              <th scope="col" className="px-4 py-3">Item</th>
              <th scope="col" className="px-4 py-3">Generated description</th>
              <th scope="col" className="px-4 py-3 text-right">Quantity</th>
              <th scope="col" className="px-4 py-3">Unit</th>
              <th scope="col" className="px-4 py-3 text-right">Unit rate</th>
              <th scope="col" className="px-4 py-3 text-right">Amount</th>
              <th scope="col" className="px-4 py-3"><span className="sr-only">Save</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800">
            {boq.sections.flatMap((section) => section.items.map((item) => {
              const draft = drafts[item.id] ?? {
                value: rateText(item),
                savedValue: rateText(item),
                saving: false,
                error: null,
              };
              const parsed = parseUnitRateInput(draft.value);
              const amount = parsed.ok ? calculateRateOnlyAmount(item.quantity, parsed.value) : null;
              const inputId = `unit-rate-${item.id}`;
              const errorId = `${inputId}-error`;
              const dirty = draft.value !== draft.savedValue;
              const categoryPath = categoryPathFromNotes(item.notes);
              const quantityCalculationId = item.integrity?.quantity.quantityCalculationId;
              const canRequestOverride = !immutable && Boolean(quantityCalculationId && boq.version && boq.revisionNumber);
              const overrideReceipt = overrideReceipts[item.id];

              return (
                <tr key={item.id} className="align-top text-slate-200">
                  <th scope="row" className="whitespace-nowrap px-4 py-4 font-medium">
                    {item.itemCode || item.itemNumber}
                  </th>
                  <td className="min-w-72 px-4 py-4">
                    <p className="font-medium text-white">{item.description}</p>
                    {item.specification ? <p className="mt-1 text-xs text-slate-400">{item.specification}</p> : null}
                    <details className="mt-2 text-xs text-slate-400">
                      <summary className="cursor-pointer rounded focus:outline-none focus:ring-2 focus:ring-blue-500">
                        View quantity evidence
                      </summary>
                      <dl className="mt-2 grid grid-cols-[max-content_1fr] gap-x-2 gap-y-1 border-l border-slate-700 pl-3">
                        <dt>Provenance</dt>
                        <dd>{item.integrity?.quantity.sourceType ?? "Not available"}</dd>
                        <dt>Drawing</dt>
                        <dd>{item.drawingReference || "Not provided"}</dd>
                        <dt>Source</dt>
                        <dd>{item.sourceReference || "Not provided"}</dd>
                        <dt>Room or zone</dt>
                        <dd>{item.roomOrZone || "Not provided"}</dd>
                        <dt>Category path</dt>
                        <dd>{categoryPath ?? "Not available"}</dd>
                      </dl>
                      {overrideReceipt ? (
                        <div className="mt-3 rounded-xl border border-amber-700/50 bg-amber-950/30 p-3 text-amber-100" role="status">
                          <p className="font-semibold">Quantity override recorded</p>
                          <p className="mt-1">Original calculated quantity: {overrideReceipt.originalSystemQuantity} {overrideReceipt.unit}</p>
                          <p>Replacement quantity: {overrideReceipt.quantity} {overrideReceipt.unit}</p>
                          <p>Audit: {overrideReceipt.actorName} · {new Date(overrideReceipt.overriddenAt).toLocaleString()}</p>
                          <p>Reason: {overrideReceipt.reason}</p>
                        </div>
                      ) : null}
                      {canRequestOverride ? (
                        <div className="mt-3 border-t border-slate-700 pt-3">
                          {overrideItemId === item.id ? (
                            <div className="space-y-3">
                              <p className="font-semibold text-slate-200">Original calculated quantity: {overrideOriginalQuantity} {item.unit}</p>
                              <label className="block">
                                <span className="text-slate-300">Replacement quantity</span>
                                <input
                                  name={`overrideQuantity-${item.id}`}
                                  type="text"
                                  inputMode="decimal"
                                  value={overrideQuantity}
                                  onChange={(event) => setOverrideQuantity(event.target.value)}
                                  className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </label>
                              <label className="block">
                                <span className="text-slate-300">Mandatory reason</span>
                                <textarea
                                  name={`overrideReason-${item.id}`}
                                  value={overrideReason}
                                  onChange={(event) => setOverrideReason(event.target.value)}
                                  aria-invalid={Boolean(overrideError)}
                                  aria-describedby={overrideError ? `override-error-${item.id}` : undefined}
                                  className="mt-1 min-h-20 w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-2 text-white outline-none focus:ring-2 focus:ring-blue-500"
                                />
                              </label>
                              {overrideError ? <p id={`override-error-${item.id}`} role="alert" className="text-red-300">{overrideError}</p> : null}
                              <div className="flex flex-wrap gap-2">
                                <button type="button" onClick={() => void submitQuantityOverride(item)} disabled={overrideSaving} className="rounded-lg bg-amber-600 px-3 py-2 font-semibold text-white focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-50">
                                  {overrideSaving ? "Saving override…" : "Save audited override"}
                                </button>
                                <button type="button" onClick={() => setOverrideItemId(null)} className="rounded-lg border border-slate-700 px-3 py-2 font-semibold text-slate-200 focus:outline-none focus:ring-2 focus:ring-blue-500">Cancel</button>
                              </div>
                            </div>
                          ) : (
                            <button type="button" onClick={() => openQuantityOverride(item)} className="font-semibold text-amber-300 underline decoration-amber-500/60 underline-offset-4 focus:outline-none focus:ring-2 focus:ring-amber-400">
                              Request quantity override
                            </button>
                          )}
                        </div>
                      ) : null}
                    </details>
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right tabular-nums">{item.quantity}</td>
                  <td className="whitespace-nowrap px-4 py-4">{item.unit}</td>
                  <td className="min-w-44 px-4 py-4">
                    <label className="sr-only" htmlFor={inputId}>Unit rate for {item.description}</label>
                    <div className="flex items-center gap-2">
                      <span aria-hidden="true" className="text-xs text-slate-500">{currency}</span>
                      <input
                        id={inputId}
                        name={`unitRate-${item.id}`}
                        type="text"
                        inputMode="decimal"
                        autoComplete="off"
                        value={draft.value}
                        onChange={(event) => updateDraft(item.id, event.target.value)}
                        disabled={immutable || draft.saving}
                        aria-invalid={Boolean(draft.error)}
                        aria-describedby={draft.error ? errorId : undefined}
                        className="w-28 rounded-xl border border-slate-700 bg-slate-900 px-3 py-2 text-right tabular-nums text-white outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                      />
                    </div>
                    {draft.error ? <p id={errorId} className="mt-2 text-xs text-red-300" role="alert">{draft.error}</p> : null}
                  </td>
                  <td className="whitespace-nowrap px-4 py-4 text-right font-medium tabular-nums">
                    {amount === null ? "—" : formatCurrency(amount, currency)}
                  </td>
                  <td className="px-4 py-4">
                    <button
                      type="button"
                      onClick={() => void saveRate(item)}
                      disabled={immutable || draft.saving || !dirty || !parsed.ok}
                      className="whitespace-nowrap rounded-xl bg-blue-600 px-3 py-2 font-semibold text-white transition hover:bg-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-400 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {draft.saving ? "Saving…" : "Save rate"}
                    </button>
                  </td>
                </tr>
              );
            }))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
