"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuantityCalculationType } from "@prisma/client";
import { apiClient, getApiErrorMessage } from "@/lib/api/client";
import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";
import type { VoiceCommandProposal } from "@/lib/voice/voice-types";
import { VoiceCommandButton } from "@/components/voice/voice-command-button";
import { applyConfirmedDimensionVoiceProposal, VoiceProposalCard } from "@/components/voice/voice-proposal-card";

/**
 * Guided BOQ measurement workflow (Release 1), spec sections 2-6 — the
 * reusable dimension-entry + visible-equation + confirm panel. Deliberately
 * framework-agnostic about WHERE it's mounted: the manual "Add measurement
 * calculation" flow (spec section 8) uses it directly; a future
 * extraction-review page (owned by another agent) can mount the same
 * component against an extractedEntityId without any change here.
 */

export type DimensionValueState = {
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

type PendingDimensionVoiceProposal = {
  proposal: VoiceCommandProposal;
  dimensionKey: string;
  expectedOldValue: number | null;
  proposedValues: DimensionValueState[];
  oldResult: FormulaResult | null;
  newResult: FormulaResult | null;
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
  const [isVoiceBusy, setIsVoiceBusy] = useState(false);
  const [pendingVoiceProposal, setPendingVoiceProposal] = useState<PendingDimensionVoiceProposal | null>(null);
  const [voiceProposalError, setVoiceProposalError] = useState<string | null>(null);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!definition) {
      setIsLoadingPrefill(false);
      return;
    }
    const controller = new AbortController();
    setIsLoadingPrefill(true);
    setError(null);
    const query = new URLSearchParams({ calculationType, projectId });
    if (extractedEntityId) query.set("extractedEntityId", extractedEntityId);
    apiClient
      .get<DimensionValueState[]>(`/api/quantity-calculations/prefill?${query.toString()}`, controller.signal)
      .then((values) => {
        setDimensionValues(values);
        setPendingVoiceProposal(null);
        setSavedCalculation(null);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setError(getApiErrorMessage(err));
      })
      .finally(() => setIsLoadingPrefill(false));
    return () => controller.abort();
  }, [calculationType, definition, extractedEntityId, projectId]);

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
    // Invalidate the stale preview immediately — otherwise the "Yes — Use
    // {value}" button can transiently show the PREVIOUS dimensions' result
    // while the fresh preview request for the new dimensions is in flight.
    setPreview({ result: null, missing: [] });
    setSavedCalculation(null);
    setPendingVoiceProposal(null);
    setVoiceProposalError(null);
  }, []);

  const dimensionVoiceContext = useMemo(() => ({
    type: "DIMENSION_CALCULATION" as const,
    calculationType,
    dimensionValues,
  }), [calculationType, dimensionValues]);

  const handleDimensionVoiceProposal = useCallback(async (proposal: VoiceCommandProposal) => {
    if (proposal.commandType !== "SET_DIMENSION" || !proposal.dimensionKey) {
      throw new Error("This voice instruction did not resolve to a supported dimension change.");
    }
    if (typeof proposal.newValue !== "number" || !Number.isFinite(proposal.newValue) || proposal.newValue < 0) {
      throw new Error("The proposed dimension must be a valid non-negative number.");
    }

    const target = dimensionValues.find((dimension) => dimension.key === proposal.dimensionKey);
    if (!target) {
      throw new Error("The proposed dimension is not valid for this calculation type.");
    }

    const proposedValues = applyConfirmedDimensionVoiceProposal(
      dimensionValues,
      proposal.dimensionKey,
      proposal.newValue,
    );
    try {
      const previewRequest = (values: DimensionValueState[]) => apiClient.post<{
        result: FormulaResult | null;
        missingRequiredDimensions: DimensionValueState[];
      }>("/api/quantity-calculations/preview", {
        calculationType,
        dimensionValues: values,
      });
      const [currentPreview, proposedPreview] = await Promise.all([
        previewRequest(dimensionValues),
        previewRequest(proposedValues),
      ]);
      setVoiceProposalError(null);
      setPendingVoiceProposal({
        proposal: {
          ...proposal,
          oldValue: target.value,
          unit: target.unit ?? proposal.unit,
        },
        dimensionKey: proposal.dimensionKey,
        expectedOldValue: target.value,
        proposedValues,
        oldResult: currentPreview.result,
        newResult: proposedPreview.result,
      });
    } catch (caught) {
      throw new Error(getApiErrorMessage(caught));
    }
  }, [calculationType, dimensionValues]);

  const confirmDimensionVoiceProposal = useCallback(() => {
    if (!pendingVoiceProposal) return;
    const currentValue = dimensionValues.find(
      (dimension) => dimension.key === pendingVoiceProposal.dimensionKey,
    )?.value ?? null;
    if (currentValue !== pendingVoiceProposal.expectedOldValue) {
      setVoiceProposalError("This dimension changed after the proposal was prepared. Cancel it and record a new instruction.");
      return;
    }

    // This is deliberately local form state only. It never creates or confirms
    // a QuantityCalculation and never writes a BOQ item.
    setDimensionValues(pendingVoiceProposal.proposedValues);
    setSavedCalculation(null);
    setVoiceProposalError(null);
    setPendingVoiceProposal(null);
    requestAnimationFrame(() => voiceButtonRef.current?.focus());
  }, [dimensionValues, pendingVoiceProposal]);

  const voiceInteractionLocked = isVoiceBusy || pendingVoiceProposal !== null;

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
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{definition.label}</p>
          <p className="mt-1 text-xs text-slate-500">Result unit: {definition.resultUnit}</p>
        </div>
        <VoiceCommandButton
          ref={voiceButtonRef}
          projectId={projectId}
          context={dimensionVoiceContext}
          onProposal={handleDimensionVoiceProposal}
          onBusyChange={setIsVoiceBusy}
          disabled={isLoadingPrefill || pendingVoiceProposal !== null}
          disabledReason={pendingVoiceProposal ? "Review or cancel the current voice proposal first." : "Wait for known evidence to load."}
          ariaLabel={`Record a voice instruction for ${definition.label} dimensions`}
        />
      </div>

      {isLoadingPrefill ? (
        <p className="text-sm text-slate-400">Loading known evidence…</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">Now let&apos;s calculate the quantity.</p>
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
                disabled={voiceInteractionLocked}
                placeholder="Enter value"
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
              />
            </div>
          ))}
        </div>
      )}

      {pendingVoiceProposal ? (
        <VoiceProposalCard
          proposal={pendingVoiceProposal.proposal}
          fieldLabel={dimensionValues.find((dimension) => dimension.key === pendingVoiceProposal.dimensionKey)?.label}
          confirmationScope="LOCAL_DIMENSION"
          affectedCalculation={{
            oldValue: pendingVoiceProposal.oldResult?.resultValue ?? null,
            newValue: pendingVoiceProposal.newResult?.resultValue ?? null,
            unit: pendingVoiceProposal.newResult?.resultUnit ?? pendingVoiceProposal.oldResult?.resultUnit ?? definition.resultUnit,
            oldFormula: pendingVoiceProposal.oldResult?.formula,
            newFormula: pendingVoiceProposal.newResult?.formula,
          }}
          error={voiceProposalError}
          onConfirm={confirmDimensionVoiceProposal}
          onCancel={() => {
            setPendingVoiceProposal(null);
            setVoiceProposalError(null);
          }}
          returnFocusRef={voiceButtonRef}
        />
      ) : null}

      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Engineering calculation</p>
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
            {!savedCalculation && (
              <p className="mt-2 text-sm text-slate-300">Does this look correct?</p>
            )}
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
            disabled={!preview.result || isSaving || voiceInteractionLocked}
            className="rounded-2xl border border-slate-700 bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSaving
              ? "Calculating…"
              : preview.result
                ? `Yes — Use ${preview.result.resultValue} ${preview.result.resultUnit}`
                : "Calculate"}
          </button>
        ) : savedCalculation.status !== "CONFIRMED" ? (
          <button
            type="button"
            onClick={() => void confirmCalculation()}
            disabled={isConfirming || voiceInteractionLocked}
            className="rounded-2xl border border-slate-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? "Confirming…" : `Yes — Use ${savedCalculation.resultValue} ${savedCalculation.resultUnit}`}
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
