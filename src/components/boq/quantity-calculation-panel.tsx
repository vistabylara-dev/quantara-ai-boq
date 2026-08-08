"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { QuantityCalculationType } from "@prisma/client";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";

/**
 * Guided BOQ measurement workflow (Release 1), spec sections 2-6 — the
 * reusable dimension-entry + visible-equation + confirm panel. Deliberately
 * framework-agnostic about WHERE it's mounted: the manual "Add measurement
 * calculation" flow (spec section 8) uses it directly; a future
 * extraction-review page (owned by another agent) can mount the same
 * component against an extractedEntityId without any change here.
 */

type DimensionValueState = {
  key: string;
  label: string;
  unit: string | null;
  required: boolean;
  value: number | null;
  source: "extracted_entity" | "detected_room" | "manual_professional_input" | null;
  confidence: number | null;
  reviewStatus: "PREFILLED" | "MANUAL_ENTRY" | "MISSING";
};

type CalculationDTO = {
  id: string;
  status: string;
  resultValue: number;
  resultUnit: string;
  formula: string;
};

export type QuantityCalculationPanelProps = {
  projectId: string;
  calculationType: QuantityCalculationType;
  extractedEntityId?: string | null;
  onConfirmed?: (calculation: CalculationDTO) => void;
  onCancel?: () => void;
};

export function QuantityCalculationPanel({ projectId, calculationType, extractedEntityId, onConfirmed, onCancel }: QuantityCalculationPanelProps) {
  const definition = useMemo(() => getRequiredDimensions(calculationType), [calculationType]);
  const [dimensionValues, setDimensionValues] = useState<DimensionValueState[]>([]);
  const [isLoadingPrefill, setIsLoadingPrefill] = useState(true);
  const [preview, setPreview] = useState<{ result: FormulaResult | null; missing: DimensionValueState[] }>({ result: null, missing: [] });
  const [error, setError] = useState<string | null>(null);
  const [savedCalculation, setSavedCalculation] = useState<CalculationDTO | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);

  useEffect(() => {
    if (!definition) {
      setIsLoadingPrefill(false);
      return;
    }
    const controller = new AbortController();
    setIsLoadingPrefill(true);
    setError(null);
    const query = new URLSearchParams({ calculationType });
    if (extractedEntityId) query.set("extractedEntityId", extractedEntityId);
    apiClient
      .get<DimensionValueState[]>(`/api/quantity-calculations/prefill?${query.toString()}`, controller.signal)
      .then((values) => setDimensionValues(values))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(getApiErrorMessage(err));
      })
      .finally(() => setIsLoadingPrefill(false));
    return () => controller.abort();
  }, [calculationType, definition, extractedEntityId]);

  useEffect(() => {
    if (!definition || dimensionValues.length === 0) return;
    const controller = new AbortController();
    apiClient
      .post<{ result: FormulaResult | null; missingRequiredDimensions: DimensionValueState[] }>(
        "/api/quantity-calculations/preview",
        { calculationType, dimensionValues },
        controller.signal,
      )
      .then((data) => setPreview({ result: data.result, missing: data.missingRequiredDimensions }))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(getApiErrorMessage(err));
      });
    return () => controller.abort();
  }, [calculationType, definition, dimensionValues]);

  const updateValue = useCallback((key: string, rawValue: string) => {
    setDimensionValues((current) =>
      current.map((dim) =>
        dim.key === key
          ? {
              ...dim,
              value: rawValue.trim() === "" ? null : Number(rawValue),
              source: rawValue.trim() === "" ? dim.source : "manual_professional_input",
              confidence: rawValue.trim() === "" ? dim.confidence : 100,
              reviewStatus: rawValue.trim() === "" ? "MISSING" : "MANUAL_ENTRY",
            }
          : dim,
      ),
    );
    setSavedCalculation(null);
  }, []);

  const saveCalculation = useCallback(async () => {
    setIsSaving(true);
    setError(null);
    try {
      const created = await apiClient.post<CalculationDTO>(`/api/projects/${encodeURIComponent(projectId)}/quantity-calculations`, {
        projectId,
        calculationType,
        extractedEntityId: extractedEntityId ?? null,
        dimensionValues,
      });
      setSavedCalculation(created);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsSaving(false);
    }
  }, [calculationType, dimensionValues, extractedEntityId, projectId]);

  const confirmCalculation = useCallback(async () => {
    if (!savedCalculation) return;
    setIsConfirming(true);
    setError(null);
    try {
      const confirmed = await apiClient.post<CalculationDTO>(`/api/quantity-calculations/${encodeURIComponent(savedCalculation.id)}/confirm`);
      setSavedCalculation(confirmed);
      onConfirmed?.(confirmed);
    } catch (err) {
      setError(getApiErrorMessage(err));
    } finally {
      setIsConfirming(false);
    }
  }, [onConfirmed, savedCalculation]);

  if (!definition) {
    return (
      <div className="rounded-3xl border border-amber-900 bg-amber-950/30 p-5 text-sm text-amber-200">
        No deterministic formula is available for calculation type &quot;{calculationType}&quot; yet. Enter the quantity directly.
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <div>
        <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{definition.label}</p>
        <p className="mt-1 text-xs text-slate-500">Result unit: {definition.resultUnit}</p>
      </div>

      {isLoadingPrefill ? (
        <p className="text-sm text-slate-400">Loading known evidence…</p>
      ) : (
        <div className="space-y-3">
          {dimensionValues.map((dim) => (
            <div key={dim.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`dim-${dim.key}`} className="text-sm font-semibold text-white">
                  {dim.label} {dim.unit ? <span className="text-slate-500">({dim.unit})</span> : null}
                  {!dim.required && <span className="ml-2 text-[0.65rem] uppercase tracking-wide text-slate-500">Optional</span>}
                </label>
                {dim.reviewStatus === "MISSING" && dim.required ? (
                  <span className="rounded-full bg-rose-950/60 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-300">
                    Required — Not Found
                  </span>
                ) : dim.source === "extracted_entity" ? (
                  <span className="rounded-full bg-blue-950/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-blue-300">
                    From extracted data {dim.confidence !== null ? `(${dim.confidence.toFixed(0)}%)` : ""}
                  </span>
                ) : dim.source === "detected_room" ? (
                  <span className="rounded-full bg-purple-950/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-purple-300">From detected room</span>
                ) : dim.source === "manual_professional_input" ? (
                  <span className="rounded-full bg-emerald-950/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-emerald-300">
                    Manual professional input
                  </span>
                ) : null}
              </div>
              <input
                id={`dim-${dim.key}`}
                type="number"
                inputMode="decimal"
                value={dim.value ?? ""}
                onChange={(e) => updateValue(dim.key, e.target.value)}
                placeholder="Enter value"
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500"
              />
            </div>
          ))}
        </div>
      )}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Equation</p>
        {preview.missing.length > 0 ? (
          <p className="mt-2 text-sm text-amber-300">Missing: {preview.missing.map((m) => m.label).join(", ")}</p>
        ) : preview.result ? (
          <div className="mt-2 space-y-2">
            <p className="font-mono text-sm text-slate-200">{preview.result.formula}</p>
            {preview.result.deductions && Object.keys(preview.result.deductions).length > 0 && (
              <p className="text-xs text-slate-400">Deductions: {JSON.stringify(preview.result.deductions)}</p>
            )}
            {preview.result.allowances && Object.keys(preview.result.allowances).length > 0 && (
              <p className="text-xs text-slate-400">Allowances: {JSON.stringify(preview.result.allowances)}</p>
            )}
            <p className="text-lg font-semibold text-white">
              Result: {preview.result.resultValue} {preview.result.resultUnit}
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">Enter all required dimensions to see the calculation.</p>
        )}
      </div>

      {error && <p className="text-sm text-rose-300">{error}</p>}

      <div className="flex flex-wrap items-center gap-3">
        {!savedCalculation ? (
          <button
            type="button"
            onClick={() => void saveCalculation()}
            disabled={!preview.result || isSaving}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving ? "Calculating…" : "Calculate"}
          </button>
        ) : savedCalculation.status !== "CONFIRMED" ? (
          <button
            type="button"
            onClick={() => void confirmCalculation()}
            disabled={isConfirming}
            className="rounded-2xl border border-slate-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? "Confirming…" : "Confirm calculation"}
          </button>
        ) : (
          <span className="rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm font-semibold text-emerald-300">
            Confirmed: {savedCalculation.resultValue} {savedCalculation.resultUnit}
          </span>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900">
            Cancel
          </button>
        )}
      </div>
    </div>
  );
}
