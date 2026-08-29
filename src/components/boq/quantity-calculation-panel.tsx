"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuantityCalculationType } from "@prisma/client";
import { apiClient } from "@/lib/api/client";
import { getRequiredDimensions } from "@/lib/calculations/required-dimensions-registry";
import type { FormulaResult } from "@/lib/calculations/quantity-formulas";
import type { VoiceCommandProposal } from "@/lib/voice/voice-types";
import { VoiceCommandButton } from "@/components/voice/voice-command-button";
import { applyConfirmedDimensionVoiceProposal, VoiceProposalCard } from "@/components/voice/voice-proposal-card";
import { useLocale } from "@/lib/i18n/locale-provider";
import { translateCalculationType, translateDimensionLabel } from "@/lib/i18n/engineering-labels";
import { getLocalizedApiErrorMessage } from "@/lib/i18n/api-error-message";

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
  calculationType: QuantityCalculationType;
  extractedEntityId: string | null;
  inputValues: Record<string, number>;
  resultValue: number;
  resultUnit: string;
  formula: string;
};

export function findReusableConfirmedCalculation(
  calculations: readonly CalculationDTO[],
  calculationType: QuantityCalculationType,
  extractedEntityId: string,
  dimensionValues: readonly DimensionValueState[],
): CalculationDTO | null {
  const currentInputValues = Object.fromEntries(
    dimensionValues
      .filter((dimension): dimension is DimensionValueState & { value: number } => dimension.value !== null)
      .map((dimension) => [dimension.key, dimension.value]),
  );
  const currentEntries = Object.entries(currentInputValues);

  return calculations.find((calculation) => {
    if (
      calculation.status !== "CONFIRMED"
      || calculation.calculationType !== calculationType
      || calculation.extractedEntityId !== extractedEntityId
    ) {
      return false;
    }

    const savedEntries = Object.entries(calculation.inputValues);
    return savedEntries.length === currentEntries.length
      && currentEntries.every(([key, value]) => calculation.inputValues[key] === value);
  }) ?? null;
}

type DetectedRoomDTO = {
  id: string;
  roomName: string;
  roomNumber: string | null;
  status: string;
};

export function listProfessionallyReviewedRooms(
  rooms: readonly DetectedRoomDTO[],
): DetectedRoomDTO[] {
  return rooms.filter((room) => room.status === "CONFIRMED" || room.status === "CORRECTED");
}

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
  const { locale, t } = useLocale();
  const localizationRef = useRef({ locale, t });
  localizationRef.current = { locale, t };
  const onConfirmedRef = useRef(onConfirmed);
  onConfirmedRef.current = onConfirmed;
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
  const [reviewedRooms, setReviewedRooms] = useState<DetectedRoomDTO[]>([]);
  const [selectedRoomId, setSelectedRoomId] = useState("");
  const [roomEvidenceError, setRoomEvidenceError] = useState(false);
  const voiceButtonRef = useRef<HTMLButtonElement>(null);
  const calculationLabel = translateCalculationType(calculationType, t);

  useEffect(() => {
    if (extractedEntityId) {
      setReviewedRooms([]);
      setSelectedRoomId("");
      setRoomEvidenceError(false);
      return;
    }
    const controller = new AbortController();
    setRoomEvidenceError(false);
    apiClient
      .get<DetectedRoomDTO[]>(
        `/api/projects/${encodeURIComponent(projectId)}/rooms`,
        controller.signal,
      )
      .then((rooms) => setReviewedRooms(listProfessionallyReviewedRooms(rooms)))
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setReviewedRooms([]);
        setSelectedRoomId("");
        setRoomEvidenceError(true);
      });
    return () => controller.abort();
  }, [extractedEntityId, projectId]);

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
    if (selectedRoomId) query.set("detectedRoomId", selectedRoomId);
    const prefillRequest = apiClient.get<DimensionValueState[]>(
      `/api/quantity-calculations/prefill?${query.toString()}`,
      controller.signal,
    );
    const existingCalculationsRequest = extractedEntityId
      ? apiClient.get<CalculationDTO[]>(
          `/api/extractions/${encodeURIComponent(extractedEntityId)}/quantity-calculations`,
          controller.signal,
        )
      : Promise.resolve([]);

    Promise.all([prefillRequest, existingCalculationsRequest])
      .then(([values, calculations]) => {
        const reusableCalculation = extractedEntityId
          ? findReusableConfirmedCalculation(calculations, calculationType, extractedEntityId, values)
          : null;
        setDimensionValues(values);
        setPendingVoiceProposal(null);
        setSavedCalculation(reusableCalculation);
        if (reusableCalculation) onConfirmedRef.current?.(reusableCalculation);
      })
      .catch((err) => {
        if (err instanceof DOMException && err.name === "AbortError") return;
        const current = localizationRef.current;
        setError(getLocalizedApiErrorMessage(err, current.t, current.locale));
      })
      .finally(() => setIsLoadingPrefill(false));
    return () => controller.abort();
  }, [calculationType, definition, extractedEntityId, projectId, selectedRoomId]);

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
        const current = localizationRef.current;
        setError(getLocalizedApiErrorMessage(err, current.t, current.locale));
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
      throw new Error(t("measurement.voiceUnsupportedDimensionAction"));
    }
    if (typeof proposal.newValue !== "number" || !Number.isFinite(proposal.newValue) || proposal.newValue < 0) {
      throw new Error(t("measurement.voiceInvalidDimensionValue"));
    }

    const target = dimensionValues.find((dimension) => dimension.key === proposal.dimensionKey);
    if (!target) {
      throw new Error(t("measurement.voiceDimensionNotApplicable"));
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
      throw new Error(getLocalizedApiErrorMessage(caught, t, locale));
    }
  }, [calculationType, dimensionValues, locale, t]);

  const confirmDimensionVoiceProposal = useCallback(() => {
    if (!pendingVoiceProposal) return;
    const currentValue = dimensionValues.find(
      (dimension) => dimension.key === pendingVoiceProposal.dimensionKey,
    )?.value ?? null;
    if (currentValue !== pendingVoiceProposal.expectedOldValue) {
      setVoiceProposalError(t("measurement.voiceDimensionChanged"));
      return;
    }

    // This is deliberately local form state only. It never creates or confirms
    // a QuantityCalculation and never writes a BOQ item.
    setDimensionValues(pendingVoiceProposal.proposedValues);
    setSavedCalculation(null);
    setVoiceProposalError(null);
    setPendingVoiceProposal(null);
    requestAnimationFrame(() => voiceButtonRef.current?.focus());
  }, [dimensionValues, pendingVoiceProposal, t]);

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
      setError(getLocalizedApiErrorMessage(err, t, locale));
    } finally {
      setIsSaving(false);
    }
  }, [calculationType, dimensionValues, extractedEntityId, locale, projectId, t]);

  const confirmCalculation = useCallback(async () => {
    if (!savedCalculation) return;
    setIsConfirming(true);
    setError(null);
    try {
      const confirmed = await apiClient.post<CalculationDTO>(`/api/quantity-calculations/${encodeURIComponent(savedCalculation.id)}/confirm`);
      setSavedCalculation(confirmed);
      onConfirmed?.(confirmed);
    } catch (err) {
      setError(getLocalizedApiErrorMessage(err, t, locale));
    } finally {
      setIsConfirming(false);
    }
  }, [locale, onConfirmed, savedCalculation, t]);

  if (!definition) {
    return (
      <div className="rounded-3xl border border-amber-900 bg-amber-950/30 p-5 text-sm text-amber-200">
        {t("measurement.noFormulaAvailable", { type: calculationLabel })}
      </div>
    );
  }

  return (
    <div className="space-y-5 rounded-3xl border border-slate-800 bg-slate-950 p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-sm uppercase tracking-[0.24em] text-slate-500">{calculationLabel}</p>
          <p className="mt-1 text-xs text-slate-500">{t("measurement.resultUnit", { unit: definition.resultUnit })}</p>
        </div>
        <VoiceCommandButton
          ref={voiceButtonRef}
          projectId={projectId}
          context={dimensionVoiceContext}
          onProposal={handleDimensionVoiceProposal}
          onBusyChange={setIsVoiceBusy}
          disabled={isLoadingPrefill || pendingVoiceProposal !== null}
          disabledReason={pendingVoiceProposal ? t("measurement.voiceReviewOrCancel") : t("measurement.voiceWaitForEvidence")}
          ariaLabel={t("measurement.voiceRecordInstruction", { label: calculationLabel })}
        />
      </div>

      {!extractedEntityId && (
        <label className="block text-sm text-slate-300">
          <span className="text-slate-400">
            {locale === "ar" ? "دليل الغرفة المؤكد (اختياري)" : "Confirmed room evidence (optional)"}
          </span>
          <select
            value={selectedRoomId}
            onChange={(event) => {
              setSelectedRoomId(event.target.value);
              setSavedCalculation(null);
              setPreview({ result: null, missing: [] });
              setPendingVoiceProposal(null);
            }}
            className="mt-2 w-full rounded-xl border border-slate-800 bg-slate-900 px-3 py-2 text-white outline-none focus:border-blue-500"
          >
            <option value="">
              {locale === "ar" ? "إدخال القياسات يدوياً" : "Enter dimensions manually"}
            </option>
            {reviewedRooms.map((room) => (
              <option key={room.id} value={room.id}>
                {room.roomNumber ? `${room.roomNumber} · ` : ""}{room.roomName}
              </option>
            ))}
          </select>
          {roomEvidenceError && (
            <span className="mt-1 block text-xs text-amber-300">
              {locale === "ar"
                ? "تعذر تحميل دليل الغرفة المؤكد. لا يزال الإدخال اليدوي متاحاً."
                : "Confirmed room evidence is unavailable. Manual entry remains available."}
            </span>
          )}
        </label>
      )}

      {isLoadingPrefill ? (
        <p className="text-sm text-slate-400">{t("measurement.loadingKnownEvidence")}</p>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-semibold text-white">{t("measurement.nowLetsCalculate")}</p>
          {dimensionValues.map((dim) => (
            <div key={dim.key} className="rounded-2xl border border-slate-800 bg-slate-900 p-4">
              <div className="flex items-center justify-between gap-3">
                <label htmlFor={`dim-${dim.key}`} className="text-sm font-semibold text-white">
                  {translateDimensionLabel(dim.key, t, dim.label)} {dim.unit ? <span className="text-slate-500">({dim.unit})</span> : null}
                  {!dim.required && <span className="ms-2 text-[0.65rem] uppercase tracking-wide text-slate-500">{t("measurement.optional")}</span>}
                </label>
                {dim.reviewStatus === "MISSING" && dim.required ? (
                  <span className="rounded-full bg-rose-950/60 px-2 py-1 text-[0.65rem] font-semibold uppercase tracking-wide text-rose-300">
                    {t("measurement.requiredNotFound")}
                  </span>
                ) : dim.source === "extracted_entity" ? (
                  <span className="rounded-full bg-blue-950/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-blue-300">
                    {t("measurement.fromExtractedData")} {dim.confidence !== null ? `(${dim.confidence.toFixed(0)}%)` : ""}
                  </span>
                ) : dim.source === "detected_room" ? (
                  <span className="rounded-full bg-purple-950/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-purple-300">{t("measurement.fromDetectedRoom")}</span>
                ) : dim.source === "manual_professional_input" ? (
                  <span className="rounded-full bg-emerald-950/60 px-2 py-1 text-[0.65rem] uppercase tracking-wide text-emerald-300">
                    {t("measurement.manualProfessionalInput")}
                  </span>
                ) : null}
              </div>
              <input
                id={`dim-${dim.key}`}
                type="number"
                inputMode="decimal"
                dir="ltr"
                value={dim.value ?? ""}
                onChange={(e) => updateValue(dim.key, e.target.value)}
                disabled={voiceInteractionLocked}
                placeholder={t("measurement.enterValue")}
                className="mt-3 w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-sm text-white outline-none focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-60 text-start"
              />
            </div>
          ))}
        </div>
      )}

      {pendingVoiceProposal ? (
        <VoiceProposalCard
          proposal={pendingVoiceProposal.proposal}
          fieldLabel={(() => {
            const dimension = dimensionValues.find((candidate) => candidate.key === pendingVoiceProposal.dimensionKey);
            return dimension ? translateDimensionLabel(dimension.key, t, dimension.label) : undefined;
          })()}
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
        <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{t("measurement.engineeringCalculation")}</p>
        {preview.missing.length > 0 ? (
          <p className="mt-2 text-sm text-amber-300">{t("measurement.missing", { fields: preview.missing.map((dimension) => translateDimensionLabel(dimension.key, t, dimension.label)).join(", ") })}</p>
        ) : preview.result ? (
          <div className="mt-2 space-y-2">
            <p dir="ltr" className="font-mono text-sm text-slate-200 text-start">{preview.result.formula}</p>
            {preview.result.deductions && Object.keys(preview.result.deductions).length > 0 && (
              <p className="text-xs text-slate-400">{t("measurement.deductions", { value: JSON.stringify(preview.result.deductions) })}</p>
            )}
            {preview.result.allowances && Object.keys(preview.result.allowances).length > 0 && (
              <p className="text-xs text-slate-400">{t("measurement.allowances", { value: JSON.stringify(preview.result.allowances) })}</p>
            )}
            <p className="text-lg font-semibold text-white">
              {t("measurement.result", { value: preview.result.resultValue, unit: preview.result.resultUnit })}
            </p>
            {!savedCalculation && (
              <p className="mt-2 text-sm text-slate-300">{t("measurement.doesThisLookCorrect")}</p>
            )}
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-500">{t("measurement.enterAllRequired")}</p>
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
              ? t("measurement.calculating")
              : preview.result
                ? t("measurement.useValue", { value: preview.result.resultValue, unit: preview.result.resultUnit })
                : t("measurement.calculate")}
          </button>
        ) : savedCalculation.status !== "CONFIRMED" ? (
          <button
            type="button"
            onClick={() => void confirmCalculation()}
            disabled={isConfirming || voiceInteractionLocked}
            className="rounded-2xl border border-slate-700 bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-500 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isConfirming ? t("measurement.confirming") : t("measurement.useValue", { value: savedCalculation.resultValue, unit: savedCalculation.resultUnit })}
          </button>
        ) : (
          <span className="rounded-2xl border border-emerald-800 bg-emerald-950/50 px-4 py-2 text-sm font-semibold text-emerald-300">
            {t("measurement.confirmed", { value: savedCalculation.resultValue, unit: savedCalculation.resultUnit })}
          </span>
        )}
        {onCancel && (
          <button type="button" onClick={onCancel} className="rounded-2xl border border-slate-700 px-4 py-2 text-sm font-semibold text-slate-300 hover:bg-slate-900">
            {t("common.cancel")}
          </button>
        )}
      </div>
    </div>
  );
}
